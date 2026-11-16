/** @description 在详情需要时读取历史版本，查询失败不伪装成没有历史记录。 */
import { useCallback } from 'react'
import { Alert, Button, Skeleton, Tag } from 'antd'
import { listRevisions } from '../../api/services/cases'
import { useQuery } from '../../hooks/useQuery'
import { publicationLabels, validityLabels } from '../../types'

interface RevisionHistoryProps {
  /** 已通过工作台路由定位的案例编号。 */
  caseId: string
}

/** 快照由后端按旧数据兼容规则投影，前端保持原始状态文案。 */
export function RevisionHistory({ caseId }: RevisionHistoryProps) {
  const load = useCallback((signal: AbortSignal) => listRevisions(caseId, signal), [caseId])
  const state = useQuery({ key: `revisions:${caseId}`, load })
  if (state.isLoading) return <Skeleton active />
  if (state.error)
    return (
      <Alert
        type="error"
        title={state.error}
        action={<Button onClick={state.reload}>重试</Button>}
      />
    )
  return (
    <div>
      {state.data?.map((version) => (
        <details key={version.id} className="version-entry">
          <summary>
            v{version.version} · {new Date(version.created_at).toLocaleString('zh-CN')}
          </summary>
          <h3>{version.snapshot.title}</h3>
          <p>{version.snapshot.symptom}</p>
          <p>{version.snapshot.solution || '处理步骤待补充'}</p>
          <Tag>{publicationLabels[version.snapshot.publication]}</Tag>
          <Tag>{validityLabels[version.snapshot.validity]}</Tag>
        </details>
      ))}
    </div>
  )
}
