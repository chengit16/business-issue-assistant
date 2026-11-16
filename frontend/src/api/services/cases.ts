/** @description 案例与草稿领域接口，统一转换方法、路径、幂等键与响应契约。 */
import type { components } from '../generated'
import { request } from '../client'
import { decode } from '../decoder'
import type { Business } from '../../types'

/** 人工完整编辑请求，必须携带读取时的预期版本。 */
export type CaseUpdate = components['schemas']['CaseUpdate']
/** 原始材料关联的新增草稿，验证与发布状态由服务端初始化。 */
export type DraftInput = components['schemas']['DraftInput']

/** 查询指定业务的可见案例，支持调用方取消旧筛选请求。 */
export async function listCases(business: Business, query = '', signal?: AbortSignal) {
  const parameters = new URLSearchParams({ business, q: query })
  return decode('CaseList', await request(`/cases?${parameters}`, { signal }))
}

/** 读取案例安全投影，草稿及业务权限由后台校验。 */
export async function readCase(id: string, signal?: AbortSignal) {
  return decode('CaseRead', await request(`/cases/${encodeURIComponent(id)}`, { signal }))
}

/** 保存新版本，冲突由调用方保留草稿并提示重新核对。 */
export async function updateCase(id: string, data: CaseUpdate, signal?: AbortSignal) {
  return decode(
    'CaseRead',
    await request(`/cases/${encodeURIComponent(id)}`, { method: 'PUT', data, signal }),
  )
}

/** 提交待确认草稿，相同内容重试时复用 key。 */
export async function createDraft(data: DraftInput, key: string, signal?: AbortSignal) {
  return decode(
    'CaseRead',
    await request('/drafts', { method: 'POST', data, idempotencyKey: key, signal }),
  )
}

/** 返回历史版本，旧版本字段由服务端兼容投影补足。 */
export async function listRevisions(id: string, signal?: AbortSignal) {
  return decode(
    'RevisionList',
    await request(`/cases/${encodeURIComponent(id)}/revisions`, { signal }),
  )
}
