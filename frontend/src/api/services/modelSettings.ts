/** @description 团队模型配置的同源接口。密钥只用于测试和保存，返回值不含密钥。 */
import { request } from '../client'
import { decode } from '../decoder'
import type { components } from '../generated'

/** 已生效的配置，包含用于并发检查的版本号和密钥状态。 */
export type ModelSettings = components['schemas']['ModelSettingsRead']
/** 单次测试输入，空密钥仅允许复用相同地址的既有凭证。 */
export type ModelConnectionInput = components['schemas']['ModelConnectionInput']
/** 发布团队设置的输入，模型模式附带短期测试凭证。 */
export type ModelSettingsInput = components['schemas']['ModelSettingsInput']

/** 从后台读取当前配置，访问权限由服务端确认。 */
export async function readModelSettings(signal?: AbortSignal) {
  return decode('ModelSettingsRead', await request('/settings/model', { signal }))
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
