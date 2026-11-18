/** @description 管理测试凭证和配置发布，编辑参数后旧凭证立即失效。 */
import { useRef, useState } from 'react'
import { App, Form } from 'antd'
import { ApiError, errorMessage } from '../../api/client'
import { saveModelSettings, testModelSettings } from '../../api/services/modelSettings'
import type { ModelConnectionInput, ModelSettings } from '../../api/services/modelSettings'
import { useRequestScope } from '../../hooks/useRequestScope'
import type { AnalysisMode } from '../../types'

interface ModelFields {
  mode: AnalysisMode
  address: string
  model: string
  apiKey?: string
}

/** 把密钥限定在表单与写入请求内，返回操作状态供界面提示。 */
export function useModelSettingsForm(settings: ModelSettings, onSaved: () => void) {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<ModelFields>()
  const mode = Form.useWatch('mode', form) ?? settings.mode
  const address = Form.useWatch('address', form) ?? settings.address
  const [testToken, setTestToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [needsReload, setNeedsReload] = useState(false)
  const [pending, setPending] = useState<'test' | 'save' | null>(null)
  const busy = useRef(false)
  const revision = useRef(0)
  const begin = useRequestScope()
  const canReuseKey =
    settings.has_api_key &&
    address.trim().replace(/\/+$/, '') === settings.address.replace(/\/+$/, '')

  function input(values: ModelFields): ModelConnectionInput {
    return {
      address: values.address.trim(),
      model: values.model.trim(),
      api_key: values.apiKey?.trim() || undefined,
      version: settings.version,
    }
  }

  function changed() {
    revision.current += 1
    setTestToken(null)
    setError('')
  }

  async function perform(kind: 'test' | 'save', operation: (signal: AbortSignal) => Promise<void>) {
    if (busy.current) return
    const scope = begin()
    busy.current = true
    setError('')
    setPending(kind)
    try {
      await operation(scope.signal)
    } catch (reason: unknown) {
      if (scope.signal.aborted) return
      setTestToken(null)
      setError(errorMessage(reason))
      setNeedsReload(reason instanceof ApiError && reason.code === 'MODEL_SETTINGS_CONFLICT')
    } finally {
      scope.complete()
      busy.current = false
      if (!scope.signal.aborted) setPending(null)
    }
  }

  function test(values: ModelFields) {
    if (busy.current) return
    const testedRevision = revision.current
    setTestToken(null)
    void perform('test', async (signal) => {
      const result = await testModelSettings(input(values), signal)
      if (!signal.aborted && testedRevision === revision.current) setTestToken(result.test_token)
    })
  }

  function save() {
    if (busy.current) return
    const values = form.getFieldsValue()
    if (values.mode === 'model' && !testToken) return
    const testedRevision = revision.current
    modal.confirm({
      title: '保存团队模型配置？',
      content: '保存后，团队后续的问题分析和草稿整理将使用这套设置。',
      okText: '保存并启用',
      onOk: () =>
        perform('save', async (signal) => {
          // 确认框显示期间如果表单已被修改，要求重新测试当前值。
          if (testedRevision !== revision.current) return
          const data =
            values.mode === 'model'
              ? input(values)
              : { version: settings.version, address: '', model: '' }
          await saveModelSettings({ ...data, mode: values.mode, test_token: testToken }, signal)
          if (!signal.aborted) {
            form.setFieldValue('apiKey', '')
            void message.success('模型配置已保存并生效')
            onSaved()
          }
        }),
    })
  }

  return {
    form,
    mode,
    canReuseKey,
    pending,
    error,
    needsReload,
    isTested: testToken !== null,
    changed,
    test,
    save,
  }
}
