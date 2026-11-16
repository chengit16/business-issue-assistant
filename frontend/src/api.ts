/**
 * @description 集中处理同源 Cookie、请求编码与后端错误。写请求由调用方提供幂等键，不自动重试。
 */
/** 保留 HTTP 状态，便于入口区分会话失效与业务错误。 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** 发送同源请求，失败时抛出保留状态码的 ApiError，不自动重放写操作。 */
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail =
      typeof body.detail === 'string' ? body.detail : '请检查输入内容后重试'
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

/** 用指定幂等键构造写请求，重试相同内容时应复用原键。 */
export function writeOptions(
  data: unknown,
  key: string,
  method = 'POST',
): RequestInit {
  return {
    method,
    body: JSON.stringify(data),
    headers: { 'Idempotency-Key': key },
  }
}
