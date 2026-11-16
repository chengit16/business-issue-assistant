/** @description 问题分析、预览和实际反馈接口，未知响应经统一契约解码。 */
import type { components } from '../generated'
import { request } from '../client'
import { decode } from '../decoder'

/** 分析输入，关联材料必须属于当前账号和所选业务。 */
export type AnalysisInput = components['schemas']['AnalysisInput']
/** 实际处理反馈，结果不会自动验证案例。 */
export type FeedbackInput = components['schemas']['FeedbackInput']

/** 分析并保存提问，重试保留原幂等键，不重复创建运行记录。 */
export async function analyze(data: AnalysisInput, key: string, signal?: AbortSignal) {
  return decode(
    'AnalysisRead',
    await request('/analyses', { method: 'POST', data, idempotencyKey: key, signal }),
  )
}

/** 生成可编辑预览，失败时不将空结果覆盖用户原始输入。 */
export async function previewDraft(data: AnalysisInput, signal?: AbortSignal) {
  return decode('DraftPreview', await request('/drafts/preview', { method: 'POST', data, signal }))
}

/** 获取本人提问，取消与加载状态由业务 Hook 维护。 */
export async function listQuestions(signal?: AbortSignal) {
  return decode('QuestionList', await request('/questions', { signal }))
}

/** 读取本人历史分析，引用是否仍有效以服务端复核结果为准。 */
export async function readQuestion(id: string, signal?: AbortSignal) {
  return decode('AnalysisRead', await request(`/questions/${encodeURIComponent(id)}`, { signal }))
}

/** 追加反馈，提交成功后调用方重新读取进度及反馈列表。 */
export async function saveFeedback(
  id: string,
  data: FeedbackInput,
  key: string,
  signal?: AbortSignal,
) {
  return decode(
    'FeedbackRead',
    await request(`/questions/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      data,
      idempotencyKey: key,
      signal,
    }),
  )
}
