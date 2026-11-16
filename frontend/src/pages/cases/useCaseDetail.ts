/** @description 维护案例读取与确认写入，冲突交给编辑表单处理，保存成功才刷新外部查询。 */
import { useCallback, useState } from 'react'
import { readCase, updateCase } from '../../api/services/cases'
import type { CaseUpdate } from '../../api/services/cases'
import { useQuery } from '../../hooks/useQuery'
import { useRequestScope } from '../../hooks/useRequestScope'
import type { Case } from '../../types'
import type { QueryResult } from '../../hooks/useQuery'

/** 案例详情和编辑交互返回约定。 */
interface CaseDetailController {
  /** 当前资源查询，编号改变时取消旧请求。 */
  query: QueryResult<Case>
  /** 仅控制编辑表单展示，实际权限由后端核验。 */
  isEditing: boolean
  /** 切换编辑状态，由用户明确决定。 */
  setIsEditing: (value: boolean) => void
  /** 服务端确认写入后关闭编辑并刷新详情。 */
  save: (values: CaseUpdate) => Promise<void>
}

/** onUpdated 只在服务端写入成功后触发，失败继续保留表单。 */
export function useCaseDetail(id: string, onUpdated: () => void): CaseDetailController {
  const load = useCallback((signal: AbortSignal) => readCase(id, signal), [id])
  const query = useQuery({ key: `case:${id}`, load })
  const [isEditing, setIsEditing] = useState(false)
  const begin = useRequestScope()
  async function save(values: CaseUpdate) {
    const scope = begin()
    try {
      await updateCase(id, values, scope.signal)
      if (!scope.signal.aborted) {
        setIsEditing(false)
        query.reload()
        onUpdated()
      }
    } finally {
      scope.complete()
    }
  }
  return { query, isEditing, setIsEditing, save }
}
