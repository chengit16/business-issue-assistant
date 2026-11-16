/** @description 原始材料上传与读取接口，图片限制在本地提示和服务端分别执行。 */
import { request } from '../client'
import { decode } from '../decoder'
import type { Business } from '../../types'

/** 上传原文与可选图片，multipart 边界由浏览器设置，返回材料编号供草稿关联。 */
export async function createSource(
  business: Business,
  text: string,
  file: File | null,
  signal?: AbortSignal,
) {
  const data = new FormData()
  data.set('business', business)
  data.set('text', text)
  if (file) data.set('file', file)
  return decode('SourceRead', await request('/sources', { method: 'POST', data, signal }))
}

/** 获取原始文字及附件展示信息，真实本地路径永不进入公开契约。 */
export async function readSource(id: string, signal?: AbortSignal) {
  return decode('SourceRead', await request(`/sources/${encodeURIComponent(id)}`, { signal }))
}

/** 供原生图片元素按同源 Cookie 下载受保护附件，不公开文件系统位置。 */
export function attachmentUrl(id: string): string {
  return `/api/sources/${encodeURIComponent(id)}/attachment`
}
