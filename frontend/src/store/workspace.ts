/** @description Zustand 维护账号范围内的业务选择和跨页面复用意图，不持久化服务端数据或认证秘密。 */
import { create } from 'zustand'
import type { Business, User } from '../types'

/** 跨页面复用输入，nonce 用于明确重新开始一条问题。 */
interface ReuseInput {
  /** 原案例所属业务，其他业务页面不得消费这份输入。 */
  business: Business
  /** 用户主动复用的排查内容，仅保存在当前浏览器会话。 */
  text: string
  /** 区分连续两次复用同一内容，触发页面重新开始输入。 */
  nonce: string
}
/** 工作台仅保存客户端选择，服务端资源由各页面查询。 */
interface WorkspaceState {
  /** 当前账号可访问的客户端业务选择，账号切换时重置。 */
  business: Business | null
  /** 待问题助手消费的复用意图，不代替服务端案例事实。 */
  reuse: ReuseInput | null
  /** 写入成功后递增，使概览及页面查询重新加载。 */
  revision: number
  /** 建立新账号范围并清空上一账号的草稿。 */
  activate: (user: User) => void
  /** 切换业务同时撤销未消费的复用输入。 */
  selectBusiness: (business: Business) => void
  /** 记录一次明确的跨页面案例复用。 */
  reuseCase: (text: string, business: Business) => void
  /** 通知依赖业务写入结果的查询失效。 */
  refresh: () => void
  /** 会话退出或失效时清除账号范围内容。 */
  reset: () => void
}

/** 账号建立或失效时必须调用 activate/reset，避免业务和草稿跨账号保留。 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  business: null,
  reuse: null,
  revision: 0,
  activate: (user) => set({ business: user.businesses[0] ?? null, reuse: null, revision: 0 }),
  selectBusiness: (business) => set({ business, reuse: null }),
  reuseCase: (text, business) =>
    set({ business, reuse: { text, business, nonce: crypto.randomUUID() } }),
  refresh: () => set((state) => ({ revision: state.revision + 1 })),
  reset: () => set({ business: null, reuse: null, revision: 0 }),
}))
