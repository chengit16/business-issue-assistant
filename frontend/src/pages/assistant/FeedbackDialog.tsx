/** @description 维护处理结果表单及幂等提交，失败保留输入，成功后通知调用方重新读取。 */
import { useRef, useState } from 'react'
import { App, Input, Modal, Select } from 'antd'
import { errorMessage, isCancelled } from '../../api/client'
import { saveFeedback } from '../../api/services/analysis'
import type { FeedbackInput } from '../../api/services/analysis'
import { useRequestScope } from '../../hooks/useRequestScope'
import { outcomeLabels } from '../../types'

interface FeedbackDialogProps {
  /** 当前本人提问的编号，变化时应重新挂载表单。 */
  questionId: string
  /** 是否展示对话框，关闭不会宣称服务端已撤销写入。 */
  open: boolean
  /** 用户关闭或保存成功后触发。 */
  onClose: () => void
  /** 服务端确认保存成功后触发，用于重新读取实际进度。 */
  onSaved?: () => void | Promise<void>
}

/** 幂等键只在内容变化或成功保存后更新，真实反馈不随本地关闭而回滚。 */
export function FeedbackDialog({ questionId, open, onClose, onSaved }: FeedbackDialogProps) {
  const { message } = App.useApp()
  const [outcome, setOutcome] = useState<FeedbackInput['outcome']>('resolved')
  const [note, setNote] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const key = useRef(crypto.randomUUID())
  const inFlight = useRef(false)
  const begin = useRequestScope()
  async function submit() {
    if (inFlight.current) return
    if (note.trim().length < 2) {
      void message.warning('请补充实际操作和处理结果')
      return
    }
    const scope = begin()
    inFlight.current = true
    setIsBusy(true)
    try {
      await saveFeedback(questionId, { outcome, note }, key.current, scope.signal)
      if (scope.signal.aborted) return
      void message.success('处理结果已记录')
      setNote('')
      key.current = crypto.randomUUID()
      onClose()
      await onSaved?.()
    } catch (reason: unknown) {
      if (!isCancelled(reason)) void message.error(errorMessage(reason))
    } finally {
      scope.complete()
      inFlight.current = false
      if (!scope.signal.aborted) setIsBusy(false)
    }
  }
  return (
    <Modal
      title="记录处理结果"
      open={open}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={isBusy}
      okText="保存结果"
      destroyOnHidden
    >
      <div className="modal-fields">
        <label>
          当前结果
          <Select<FeedbackInput['outcome']>
            aria-label="当前结果"
            value={outcome}
            disabled={isBusy}
            onChange={(value) => {
              setOutcome(value)
              key.current = crypto.randomUUID()
            }}
            options={Object.entries(outcomeLabels).map(([value, label]) => ({ value, label }))}
          />
        </label>
        <label>
          实际操作与结果
          <Input.TextArea
            aria-label="实际操作与结果"
            value={note}
            disabled={isBusy}
            onChange={(event) => {
              setNote(event.target.value)
              key.current = crypto.randomUUID()
            }}
            rows={5}
            maxLength={5000}
            placeholder="执行了哪些操作？观察到什么结果？由谁确认？"
          />
        </label>
      </div>
    </Modal>
  )
}
