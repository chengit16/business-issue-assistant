/** @description 团队模型配置的同源接口，供应商目录与凭证操作通过服务端转发。 */
import { request } from '../client'
import { decode } from '../decoder'
import type { components } from '../generated'

/** 已生效的配置，包含用于并发检查的版本号和密钥状态。 */
export type ModelSettings = components['schemas']['ModelSettingsRead']
/** 查询供应商目录只需要地址、密钥及现有配置版本。 */
export type ModelCatalogInput = components['schemas']['ModelCatalogInput']
/** 单次测试输入，空密钥仅允许复用相同地址的既有凭证。 */
export type ModelConnectionInput = components['schemas']['ModelConnectionInput']
/** 发布团队设置的输入，模型模式附带短期测试凭证。 */
export type ModelSettingsInput = components['schemas']['ModelSettingsInput']

/** 从后台读取当前配置，访问权限由服务端确认。 */
export async function readModelSettings(signal?: AbortSignal) {
  return decode('ModelSettingsRead', await request('/settings/model', { signal }))
}

/** 读取当前密钥可见的模型，密钥只放在请求体内。 */
export async function fetchModelCatalog(data: ModelCatalogInput, signal: AbortSignal) {
  return decode(
    'ModelCatalogRead',
    await request('/settings/model/models', { method: 'POST', data, signal }),
  )
}

/** 用合成内容验证连接，成功后返回与此次输入绑定的凭证。 */
export async function testModelSettings(data: ModelConnectionInput, signal: AbortSignal) {
  return decode(
    'ModelTestRead',
    await request('/settings/model/test', { method: 'POST', data, signal }),
  )
}

/** 发布通过测试的配置，冲突时保留后台现状并让用户刷新。 */
export async function saveModelSettings(data: ModelSettingsInput, signal: AbortSignal) {
  return decode(
    'ModelSettingsRead',
    await request('/settings/model', { method: 'PUT', data, signal }),
  )
}
