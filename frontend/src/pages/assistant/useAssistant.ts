/** @description 维护问题草稿、截图与分析用例，失败保留输入，业务切换时取消旧页面的等待。 */
import { useRef, useState } from 'react'
import { App } from 'antd'
import { errorMessage, isCancelled } from '../../api/client'
import * as analysis from '../../api/services/analysis'
import { createSource } from '../../api/services/materials'
import { useRequestScope } from '../../hooks/useRequestScope'
import { useWorkspaceStore } from '../../store/workspace'
import type { Analysis, Business } from '../../types'

/** 输入与分析状态的唯一所有者，界面通过动作调用业务用例。 */
export interface AssistantController {
  /** 尚未提交或待重试的问题内容。 */
  text: string
  /** 本次选择的截图，上传成功后关联稳定材料编号。 */
  file: File | null
  /** 提交期间禁用重复触发，后端仍执行幂等保护。 */
  isBusy: boolean
  /** 可恢复的错误，不在失败时清空原始输入。 */
  error: string
  /** 已校验的分析结果。 */
  result: Analysis | null
  /** 改变内容时生成新幂等键，避免复用旧请求的语义。 */
  updateText: (value: string) => void
  /** 校验图片边界后更新输入。 */
  updateFile: (file: File | null) => void
  /** 按当前输入执行一次分析。 */
  submit: () => Promise<void>
  /** 保存反馈后重新读取同一问题。 */
  refreshResult: () => Promise<void>
}

/** 业务及账号改变时由路由重新挂载，截图和幂等键不跨账号复用。 */
export function useAssistant(business: Business, initialText: string): AssistantController {
  const { message } = App.useApp()
  const [text, setText] = useState(initialText)
  const [file, setFile] = useState<File | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const key = useRef(crypto.randomUUID())
  const sourceId = useRef<string | null>(null)
  const inFlight = useRef(false)
  const begin = useRequestScope()
  const refresh = useWorkspaceStore((state) => state.refresh)
  function updateText(value: string) {
    setText(value)
    key.current = crypto.randomUUID()
    sourceId.current = null
  }
  function updateFile(value: File | null) {
    if (
      value &&
      (!['image/png', 'image/jpeg', 'image/webp'].includes(value.type) ||
        value.size > 5 * 1024 * 1024)
    ) {
      void message.warning('请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片')
      return
    }
    setFile(value)
    key.current = crypto.randomUUID()
    sourceId.current = null
  }
  async function submit() {
    if (inFlight.current) return
    if (text.trim().length < 4) {
      void message.warning('请至少填写 4 个字的问题背景')
      return
    }
    const scope = begin()
    inFlight.current = true
    setIsBusy(true)
    setError('')
    try {
      // 1. 截图先保存为材料，重试分析时复用已确认的材料编号。
      if (file && !sourceId.current)
        sourceId.current = (await createSource(business, text, file, scope.signal)).id
      // 2. 相同内容重试使用原键，取消等待不当作服务端事务撤销。
      const value = await analysis.analyze(
        { text, business, source_id: sourceId.current },
        key.current,
        scope.signal,
      )
      if (!scope.signal.aborted) {
        setResult(value)
        refresh()
      }
    } catch (reason: unknown) {
      if (!isCancelled(reason)) setError(errorMessage(reason))
    } finally {
      scope.complete()
      inFlight.current = false
      if (!scope.signal.aborted) setIsBusy(false)
    }
  }
  async function refreshResult() {
    if (!result) return
    const scope = begin()
    try {
      const value = await analysis.readQuestion(result.question.id, scope.signal)
      if (!scope.signal.aborted) setResult(value)
    } finally {
      scope.complete()
    }
  }
  return { text, file, isBusy, error, result, updateText, updateFile, submit, refreshResult }
}
