/**
 * @description 维护工作台当前使用的接口类型与状态显示文案，服务端仍负责输入和权限校验。
 */
export type Business = '订单售后' | '营销活动' | '系统支持'
export interface User {
  id: string
  name: string
  email: string
  role: 'member' | 'handler' | 'maintainer'
  businesses: Business[]
}
export interface Case {
  id: string
  title: string
  business: Business
  symptom: string
  conditions: string
  investigation: string
  cause: string
  solution: string
  verification: string
  publication: 'draft' | 'pending' | 'published' | 'archived'
  validity: 'unverified' | 'verified' | 'invalid'
  source_id: string
  owner_id: string
  version: number
  updated_at: string
  is_demo: boolean
  currently_available?: boolean
}
export type DraftFields = Pick<
  Case,
  | 'title'
  | 'symptom'
  | 'conditions'
  | 'investigation'
  | 'cause'
  | 'solution'
  | 'verification'
>
export interface Source {
  id: string
  business: Business
  text: string
  version: number
  attachment_name: string | null
}
export interface Question {
  id: string
  text: string
  business: Business
  progress: 'processing' | 'resolved' | 'reopened'
  created_at: string
}
export interface Analysis {
  question: Question
  run: {
    id: string
    rule_version: string
    model: string
    result: {
      summary: string
      steps: string[]
      missing: string[]
      citations: Case[]
      reply: string
      notice: string
    }
  }
  feedback?: { id: string; outcome: string; note: string; created_at: string }[]
}
export const publicationLabels = {
  draft: '草稿',
  pending: '待确认',
  published: '已发布',
  archived: '已归档',
}
export const validityLabels = {
  unverified: '待验证',
  verified: '已验证',
  invalid: '已失效',
}
export const progressLabels = {
  processing: '处理中',
  resolved: '已解决',
  reopened: '重新打开',
}
export const roleLabels = {
  member: '业务同事',
  handler: '问题处理人',
  maintainer: '知识维护人',
}
