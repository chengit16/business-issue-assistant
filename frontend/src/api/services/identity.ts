/** @description 身份领域接口，所有账号响应通过后端生成的安全投影契约校验。 */
import type { components } from '../generated'
import { request } from '../client'
import { decode } from '../decoder'

/** 登录输入只交给同源后台，客户端不保存口令或 Cookie。 */
export type LoginInput = components['schemas']['LoginInput']

/** 恢复服务端会话，401 由应用入口显示登录页。 */
export async function currentUser(signal?: AbortSignal) {
  return decode('UserRead', await request('/auth/me', { signal }))
}

/** 认证成功后返回公开身份，HttpOnly Cookie 由浏览器处理。 */
export async function login(data: LoginInput) {
  return decode('UserRead', await request('/auth/login', { method: 'POST', data }))
}

/** 服务端确认退出后才允许界面清理会话状态。 */
export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' })
}
