/** @description 管理供应商目录、测试凭证和发布，连接变化时丢弃旧目录。 */
import { useRef, useState } from 'react'
import { App, Form } from 'antd'
import { ApiError, errorMessage } from '../../api/client'
import {
  fetchModelCatalog,
  saveModelSettings,
  testModelSettings,
} from '../../api/services/modelSettings'
import type { ModelCatalogInput, ModelSettings } from '../../api/services/modelSettings'
import { useRequestScope } from '../../hooks/useRequestScope'
import type { AnalysisMode } from '../../types'

interface ModelFields {
  mode: AnalysisMode
  address: string
  model?: string
  apiKey?: string
}

/** 目录只反映表单当前凭证，模型可用性仍须在发布前测试。 */
export function useModelSettingsForm(settings: ModelSettings, onSaved: () => void) {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<ModelFields>()
  const mode = Form.useWatch('mode', form) ?? settings.mode
  const address = Form.useWatch('address', form) ?? settings.address
  const model = Form.useWatch('model', form)
  const [catalog, setCatalog] = useState<string[] | null>(null)
  const [testToken, setTestToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [needsReload, setNeedsReload] = useState(false)
  const [pending, setPending] = useState<'catalog' | 'test' | 'save' | null>(null)
  const busy = useRef(false)
  const revision = useRef(0)
  const begin = useRequestScope()
  const canReuseKey =
    settings.has_api_key &&
    address.trim().replace(/\/+$/, '') === settings.address.replace(/\/+$/, '')

  function credentials(values: ModelFields): ModelCatalogInput {
    return {
      address: values.address.trim(),
      api_key: values.apiKey?.trim() || undefined,
      version: settings.version,
    }
  }

  function changed(fields: Partial<ModelFields>) {
    // 地址或密钥变更后清除旧供应商的选择，单独换模型时仍可使用当前目录。
    if ('address' in fields || 'apiKey' in fields) {
      setCatalog(null)
      form.setFieldValue('model', undefined)
    }
    invalidateTest()
  }

  function invalidateTest() {
    revision.current += 1
    setTestToken(null)
    setError('')
  }

  async function perform(
    kind: 'catalog' | 'test' | 'save',
    operation: (signal: AbortSignal) => Promise<void>,
  ) {
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

  async function loadCatalog() {
    if (busy.current) return
    const requestedRevision = revision.current
    const values = await form.validateFields(['address', 'apiKey']).catch(() => null)
    if (!values || requestedRevision !== revision.current) return
    await perform('catalog', async (signal) => {
      const { models } = await fetchModelCatalog(credentials(values), signal)
      if (signal.aborted || requestedRevision !== revision.current) return
      setCatalog(models)
      const selected = form.getFieldsValue().model
      if (selected && !models.includes(selected)) {
        form.setFieldValue('model', undefined)
        invalidateTest()
      }
    })
  }

  function test(values: ModelFields) {
    if (busy.current || !values.model) return
    const testedRevision = revision.current
    setTestToken(null)
    void perform('test', async (signal) => {
      const result = await testModelSettings(
        { ...credentials(values), model: values.model ?? '' },
        signal,
      )
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
              ? { ...credentials(values), model: values.model ?? '' }
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
    model,
    catalog,
    canReuseKey,
    pending,
    error,
    needsReload,
    isTested: testToken !== null,
    changed,
    loadCatalog,
    test,
    save,
  }
}
