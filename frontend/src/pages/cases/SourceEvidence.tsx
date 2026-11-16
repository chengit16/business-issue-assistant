/** @description 按原始材料编号读取授权原文，附件定位由材料 Service 统一维护。 */
import { useCallback } from 'react'
import { Alert, Button, Image, Skeleton } from 'antd'
import { attachmentUrl, readSource } from '../../api/services/materials'
import { useQuery } from '../../hooks/useQuery'

interface SourceEvidenceProps {
  /** 案例关联的不可变原始材料编号。 */
  sourceId: string
}

/** 原文以纯文本显示，图片继续通过同源受保护接口加载。 */
export function SourceEvidence({ sourceId }: SourceEvidenceProps) {
  const load = useCallback((signal: AbortSignal) => readSource(sourceId, signal), [sourceId])
  const state = useQuery({ key: `source:${sourceId}`, load })
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
    state.data && (
      <div className="source-detail">
        <p className="muted">
          材料编号 {state.data.id} · v{state.data.version}
        </p>
        <pre>{state.data.text}</pre>
        {state.data.attachment_name && (
          <>
            <h3>{state.data.attachment_name}</h3>
            <Image src={attachmentUrl(sourceId)} alt={state.data.attachment_name} />
          </>
        )}
      </div>
    )
  )
}
