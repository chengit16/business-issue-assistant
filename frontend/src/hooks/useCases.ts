/** @description 按业务和关键词维护案例查询，键与取消范围覆盖全部筛选条件。 */
import { useCallback } from 'react'
import { listCases } from '../api/services/cases'
import type { Business } from '../types'
import { useQuery } from './useQuery'
import { useWorkspaceStore } from '../store/workspace'

/** 查询当前业务案例，后台继续检查实际权限。 */
export function useCases(business: Business, query = '') {
  const revision = useWorkspaceStore((state) => state.revision)
  const load = useCallback(
    (signal: AbortSignal) => listCases(business, query, signal),
    [business, query],
  )
  return useQuery({ key: `cases:${business}:${query}:${revision}`, load })
}
