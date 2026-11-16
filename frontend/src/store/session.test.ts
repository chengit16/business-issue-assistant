/** @description 验证账号切换时旧身份响应及跨页面草稿不会泄漏到新会话。 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as identity from '../api/services/identity'
import type { User } from '../types'
import { useSessionStore } from './session'
import { useWorkspaceStore } from './workspace'

vi.mock('../api/services/identity', () => ({
  currentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))
const firstUser: User = {
  id: 'first',
  email: 'first@example.com',
  name: '甲',
  role: 'member',
  businesses: ['订单售后'],
}
const secondUser: User = {
  id: 'second',
  email: 'second@example.com',
  name: '乙',
  role: 'maintainer',
  businesses: ['营销活动'],
}
beforeEach(() => {
  useSessionStore.getState().expire()
  vi.clearAllMocks()
})

describe('会话状态隔离', () => {
  it('旧会话恢复晚到时不能覆盖已登录的新账号', async () => {
    let finish: ((user: User) => void) | undefined
    vi.mocked(identity.currentUser).mockImplementation(
      () =>
        new Promise<User>((resolve) => {
          finish = resolve
        }),
    )
    const restore = useSessionStore.getState().restore()
    vi.mocked(identity.login).mockResolvedValue(secondUser)
    await useSessionStore.getState().login({ email: secondUser.email, password: 'test-only' })
    if (!finish) throw new Error('恢复请求尚未创建')
    finish(firstUser)
    await restore
    expect(useSessionStore.getState().user?.id).toBe(secondUser.id)
    expect(useWorkspaceStore.getState().business).toBe('营销活动')
  })
  it('退出成功后清理业务选择及复用内容', async () => {
    vi.mocked(identity.login).mockResolvedValue(firstUser)
    await useSessionStore.getState().login({ email: firstUser.email, password: 'test-only' })
    useWorkspaceStore.getState().reuseCase('仅属于甲的草稿', '订单售后')
    vi.mocked(identity.logout).mockResolvedValue(undefined)
    await useSessionStore.getState().logout()
    expect(useSessionStore.getState().user).toBeNull()
    expect(useWorkspaceStore.getState().reuse).toBeNull()
    expect(useWorkspaceStore.getState().business).toBeNull()
  })
})
