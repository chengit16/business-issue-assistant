/** @description Zustand 管理可信会话的恢复和切换，旧恢复请求不能覆盖新登录，身份仅来自后台。 */
import { create } from 'zustand'
import { ApiError, errorMessage, isCancelled } from '../api/client'
import * as identity from '../api/services/identity'
import type { User } from '../types'
import { useWorkspaceStore } from './workspace'

interface SessionState {
  /** 后台确认的公开账号，未认证时为空。 */
  user: User | null
  /** 区分恢复中、可继续操作和可重试故障。 */
  status: 'loading' | 'ready' | 'error'
  /** 恢复失败时面向用户展示的脱敏说明。 */
  error: string
  /** 恢复同源 Cookie 会话，晚到响应不能覆盖新身份。 */
  restore: () => Promise<void>
  /** 认证成功后建立新的工作台范围。 */
  login: (values: identity.LoginInput) => Promise<void>
  /** 后台撤销成功后才清除本地身份，失败仍可重试。 */
  logout: () => Promise<void>
  /** 后台明确返回会话失效时立即清理账号数据。 */
  expire: () => void
}
let generation = 0
let pending: AbortController | null = null

/** 会话动作集中清理账号范围状态，口令及令牌不进入 Store。 */
export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  status: 'loading',
  error: '',
  restore: async () => {
    const version = ++generation
    pending?.abort()
    pending = new AbortController()
    set({ status: 'loading', error: '' })
    try {
      const user = await identity.currentUser(pending.signal)
      if (generation !== version) return
      useWorkspaceStore.getState().activate(user)
      set({ user, status: 'ready' })
    } catch (reason: unknown) {
      if (generation !== version || isCancelled(reason)) return
      useWorkspaceStore.getState().reset()
      set(
        reason instanceof ApiError && reason.status === 401
          ? { user: null, status: 'ready' }
          : { user: null, status: 'error', error: errorMessage(reason) },
      )
    }
  },
  login: async (values) => {
    const version = ++generation
    pending?.abort()
    const user = await identity.login(values)
    if (generation !== version) return
    useWorkspaceStore.getState().activate(user)
    set({ user, status: 'ready', error: '' })
  },
  logout: async () => {
    await identity.logout()
    generation += 1
    pending?.abort()
    useWorkspaceStore.getState().reset()
    set({ user: null, status: 'ready', error: '' })
  },
  expire: () => {
    generation += 1
    pending?.abort()
    useWorkspaceStore.getState().reset()
    set({ user: null, status: 'ready', error: '' })
  },
}))
