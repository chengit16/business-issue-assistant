/**
 * @description Axios 统一维护同源 Cookie、超时、取消和错误归一化。写操作不自动重试。
 */
import axios from 'axios'
import { decode } from './decoder'

/** 传输层只暴露业务请求需要的选项，不允许调用方覆盖认证策略。 */
export interface RequestOptions {
  /** HTTP 方法，省略时读取资源。 */
  method?: 'GET' | 'POST' | 'PUT'
  /** JSON 对象或 FormData，上传时由 Axios 和浏览器设置 multipart 边界。 */
  data?: unknown
  /** 取消本地等待，不能作为服务端写入已经撤销的证明。 */
  signal?: AbortSignal
  /** 相同内容重试时复用原键，服务端使用此键去重。 */
  idempotencyKey?: string
}

/** 归一化可展示错误，保留状态、稳定错误码与请求编号供调用方恢复。 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId = '',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const transport = axios.create({ baseURL: '/api', withCredentials: true, timeout: 60000 })
const events = new EventTarget()

/** 订阅服务端确认的会话失效，返回清理函数，避免多次挂载重复处理。 */
export function onSessionExpired(listener: () => void): () => void {
  events.addEventListener('expired', listener)
  return () => events.removeEventListener('expired', listener)
}

/** 发送一次请求并返回未知值，领域 Service 必须通过契约校验后使用。 */
export async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  try {
    const response = await transport.request<unknown>({
      url: path,
      method: options.method ?? 'GET',
      data: options.data,
      signal: options.signal,
      headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {},
    })
    return response.status === 204 ? null : response.data
  } catch (reason: unknown) {
    if (axios.isCancel(reason)) throw new ApiError(0, 'REQUEST_CANCELLED', '请求已取消')
    if (!axios.isAxiosError<unknown>(reason)) throw reason
    if (!reason.response) {
      throw new ApiError(
        0,
        reason.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR',
        reason.code === 'ECONNABORTED'
          ? '请求超时，输入已保留，请重试'
          : '暂时无法连接服务，请检查网络后重试',
      )
    }
    const status = reason.response.status
    if (status === 401 && !['/auth/me', '/auth/login'].includes(path))
      events.dispatchEvent(new Event('expired'))
    try {
      const error = decode('ErrorRead', reason.response.data)
      throw new ApiError(status, error.code, error.message, error.request_id)
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error
      throw new ApiError(status, 'HTTP_ERROR', '服务返回错误，请稍后重试')
    }
  }
}

/** 从未知异常中取得可展示消息，不把任意对象断言成 Error。 */
export function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : '操作未完成，请重试'
}

/** 查询取消属于生命周期清理，页面不应把它展示为业务失败。 */
export function isCancelled(reason: unknown): boolean {
  return reason instanceof ApiError && reason.code === 'REQUEST_CANCELLED'
}
