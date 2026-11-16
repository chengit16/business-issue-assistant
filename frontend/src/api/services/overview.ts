/** @description 工作台统计领域接口，范围由后端按当前身份过滤。 */
import { request } from '../client'
import { decode } from '../decoder'

/** 获取当前可见统计，不根据客户端角色自行推断权限。 */
export async function readOverview(signal?: AbortSignal) {
  return decode('OverviewRead', await request('/overview', { signal }))
}
