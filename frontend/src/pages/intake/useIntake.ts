/** @description 编排材料保存、模型预览和幂等草稿写入，失败保留输入并复用已上传的材料编号。 */
import { useRef, useState } from 'react'
import { App } from 'antd'
import { errorMessage, isCancelled } from '../../api/client'
import { previewDraft } from '../../api/services/analysis'
import { createDraft } from '../../api/services/cases'
import { createSource } from '../../api/services/materials'
import { useRequestScope } from '../../hooks/useRequestScope'
import { useWorkspaceStore } from '../../store/workspace'
import type { Business, DraftFields, DraftPreview, Source } from '../../types'

/** 收录页面独占的状态和动作，不持久化到跨账号 Store。 */
export interface IntakeController {
  /** 原始文字，生成材料后保持只读。 */
  text: string
  /** 可选截图，不超过服务端允许的大小。 */
  file: File | null
  /** 已成功绑定预览的原始材料。 */
  source: Source | null
  /** 经模型或本地规则整理的可校正预览。 */
  preview: DraftPreview | null
  /** 当前顺序依赖的写入是否进行中。 */
  isBusy: boolean
  /** 可恢复错误，不覆盖原始输入。 */
  error: string
  /** 更改原文后不再复用旧材料编号。 */
  updateText: (value: string) => void
  /** 替换附件时不再复用旧材料编号。 */
  updateFile: (value: File | null) => void
  /** 保存材料并生成预览，成功前不挂载编辑表单。 */
  prepare: () => Promise<void>
  /** 使用稳定幂等键提交待确认草稿。 */
  save: (values: DraftFields) => Promise<void>
  /** 草稿内容改变时更新幂等键。 */
  changed: () => void
}

/** 只有保存草稿成功后触发 onSaved，实际验证状态始终由后台人工确认。 */
export function useIntake(business: Business, onSaved: (id: string) => void): IntakeController {
  const { message } = App.useApp()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [preview, setPreview] = useState<DraftPreview | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const key = useRef(crypto.randomUUID())
  const uploaded = useRef<Source | null>(null)
  const inFlight = useRef(false)
  const begin = useRequestScope()
  const refresh = useWorkspaceStore((state) => state.refresh)
  function updateText(value: string) {
    setText(value)
    uploaded.current = null
  }
  function updateFile(value: File | null) {
    setFile(value)
    uploaded.current = null
  }
  async function prepare() {
    if (inFlight.current) return
    if (text.trim().length < 4) {
      void message.warning('请至少填写 4 个字的材料说明')
      return
    }
    const scope = begin()
    inFlight.current = true
    setIsBusy(true)
    setError('')
    try {
      // 1. 先完成材料校验与上传，模型失败时保留已确认的上传结果。
      uploaded.current ??= await createSource(business, text, file, scope.signal)
      // 2. 预览成功后才进入草稿编辑，避免异常响应覆盖空白业务事实。
      const value = await previewDraft({ text, business }, scope.signal)
      if (!scope.signal.aborted) {
        setSource(uploaded.current)
        setPreview(value)
      }
    } catch (reason: unknown) {
      if (!isCancelled(reason)) setError(errorMessage(reason))
    } finally {
      scope.complete()
      inFlight.current = false
      if (!scope.signal.aborted) setIsBusy(false)
    }
  }
  async function save(values: DraftFields) {
    if (!source || inFlight.current) return
    const scope = begin()
    inFlight.current = true
    setIsBusy(true)
    setError('')
    try {
      const item = await createDraft({ ...values, source_id: source.id }, key.current, scope.signal)
      if (!scope.signal.aborted) {
        void message.success('经验已提交，等待人工确认')
        refresh()
        onSaved(item.id)
      }
    } catch (reason: unknown) {
      if (!isCancelled(reason)) setError(errorMessage(reason))
    } finally {
      scope.complete()
      inFlight.current = false
      if (!scope.signal.aborted) setIsBusy(false)
    }
  }
  return {
    text,
    file,
    source,
    preview,
    isBusy,
    error,
    updateText,
    updateFile,
    prepare,
    save,
    changed: () => {
      key.current = crypto.randomUUID()
    },
  }
}
