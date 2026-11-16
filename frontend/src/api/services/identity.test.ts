/** @description 通过领域 Service 验证响应校验、统一超时及会话失效边界，不访问真实账号服务。 */
import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, onSessionExpired } from '../client'
import { ContractError } from '../decoder'
import { currentUser, login } from './identity'
import { readCase } from './cases'

const { send } = vi.hoisted(() => ({
  send: vi.fn<
    (config: AxiosRequestConfig<unknown>) => Promise<{ status: number; data: unknown }>
  >(),
}))
vi.mock('axios', async (importOriginal) => {
  const original = await importOriginal<typeof import('axios')>()
  return { ...original, default: { ...original.default, create: () => ({ request: send }) } }
})
const user = {
  id: 'user-1',
  email: 'tester@example.com',
  name: '测试同事',
  role: 'member',
  businesses: ['订单售后'],
}
function failure(status: number, data: unknown): AxiosError<unknown> {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: 'failed',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}
beforeEach(() => {
  send.mockReset()
})

describe('身份 Service 的传输与契约', () => {
  it('仅返回符合生成契约的公开身份', async () => {
    send.mockResolvedValue({ status: 200, data: user })
    await expect(currentUser()).resolves.toEqual(user)
    send.mockResolvedValue({ status: 200, data: { ...user, role: 'unknown-role' } })
    await expect(currentUser()).rejects.toBeInstanceOf(ContractError)
  })
  it('把取消信号交给 Axios，并归一化取消及超时', async () => {
    const controller = new AbortController()
    send.mockResolvedValue({ status: 200, data: user })
    await currentUser(controller.signal)
    expect(send.mock.calls[0]?.[0].signal).toBe(controller.signal)
    send.mockRejectedValue(new CanceledError())
    await expect(currentUser()).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' })
    send.mockRejectedValue(new AxiosError('timeout', 'ECONNABORTED'))
    await expect(currentUser()).rejects.toMatchObject({ code: 'TIMEOUT' })
  })
  it('认证失败保留服务端错误码和请求编号，不将错误响应伪装成身份', async () => {
    const expired = vi.fn()
    const unsubscribe = onSessionExpired(expired)
    send.mockRejectedValue(
      failure(401, {
        code: 'INVALID_CREDENTIALS',
        message: '邮箱或密码不正确',
        detail: '邮箱或密码不正确',
        request_id: 'request-1',
      }),
    )
    await expect(login({ email: 'tester@example.com', password: 'invalid' })).rejects.toMatchObject(
      { code: 'INVALID_CREDENTIALS', requestId: 'request-1' },
    )
    expect(expired).not.toHaveBeenCalled()
    await expect(readCase('protected-case')).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
    unsubscribe()
  })
  it('无法解码的服务端错误仍保持失败', async () => {
    send.mockRejectedValue(failure(500, { unexpected: 'payload' }))
    await expect(currentUser()).rejects.toBeInstanceOf(ApiError)
    await expect(currentUser()).rejects.toMatchObject({ status: 500, code: 'HTTP_ERROR' })
  })
})
