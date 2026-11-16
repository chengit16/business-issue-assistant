/** @description 读取本人提问详情，反馈成功后精准刷新详情与所属列表。 */
import { useCallback } from 'react'
import { Alert, Button, Modal, Skeleton, Tag } from 'antd'
import { readQuestion } from '../../api/services/analysis'
import { useQuery } from '../../hooks/useQuery'
import { outcomeLabels } from '../../types'
import { AnalysisResult } from '../assistant/AnalysisResult'

interface QuestionDialogProps {
  /** 当前本人提问编号，切换时由调用方重新挂载。 */
  id: string
  /** 关闭后取消当前详情查询的等待。 */
  onClose: () => void
  /** 路由定位引用案例。 */
  openCase: (id: string) => void
  /** 反馈已入库时通知列表刷新。 */
  onFeedback: () => void
}

/** 查看历史记录仍以后台重新复核的引用和反馈事实为准。 */
export function QuestionDialog({ id, onClose, openCase, onFeedback }: QuestionDialogProps) {
  const load = useCallback((signal: AbortSignal) => readQuestion(id, signal), [id])
  const state = useQuery({ key: `question:${id}`, load })
  return (
    <Modal open title="提问与排查记录" footer={null} width={800} onCancel={onClose} destroyOnHidden>
      {state.isLoading ? (
        <Skeleton active />
      ) : state.error ? (
        <Alert
          type="error"
          title={state.error}
          action={<Button onClick={state.reload}>重试</Button>}
        />
      ) : (
        state.data && (
          <>
            <p className="original-question">{state.data.question.text}</p>
            <AnalysisResult
              value={state.data}
              openCase={openCase}
              onFeedback={() => {
                state.reload()
                onFeedback()
              }}
            />
            {state.data.feedback?.map((item) => (
              <div className="feedback-note" key={item.id}>
                <Tag>{outcomeLabels[item.outcome]}</Tag>
                {item.note}
              </div>
            ))}
          </>
        )
      )}
    </Modal>
  )
}
