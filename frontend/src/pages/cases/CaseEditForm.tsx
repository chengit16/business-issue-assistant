/** @description 维护人工确认草稿，版本冲突保留输入并显示最新记录，用户核对后才切换基准版本。 */
import { useRef, useState } from 'react'
import { Alert, App, Button, Form, Select } from 'antd'
import { ApiError, errorMessage, isCancelled } from '../../api/client'
import { readCase } from '../../api/services/cases'
import type { CaseUpdate } from '../../api/services/cases'
import { draftFields } from '../../components/caseFields'
import { CaseFieldsForm } from '../../components/CaseFieldsForm'
import { useRequestScope } from '../../hooks/useRequestScope'
import type { Case, DraftFields, User } from '../../types'
import { publicationLabels, validityLabels } from '../../types'

interface CaseEditFormProps {
  /** 开始编辑时读取的案例，保存前仍使用预期版本条件。 */
  value: Case
  /** 仅控制界面选项，后端仍独立校验实际角色。 */
  role: User['role']
  /** 保存完成前不清理草稿，失败由本表单展示。 */
  onSave: (values: CaseUpdate) => Promise<void>
}
type Editable = DraftFields & Pick<Case, 'publication' | 'validity'>
const conflictFields: { key: keyof Editable; label: string }[] = [
  ...draftFields.map((field) => ({ key: field.name, label: field.label })),
  { key: 'publication', label: '发布状态' },
  { key: 'validity', label: '方案有效性' },
]

/** 人工核对和版本重基准均由用户明确触发，不静默覆盖其他编辑人的修改。 */
export function CaseEditForm({ value, role, onSave }: CaseEditFormProps) {
  const { message } = App.useApp()
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasConflict, setHasConflict] = useState(false)
  const [latest, setLatest] = useState<Case | null>(null)
  const [baseVersion, setBaseVersion] = useState(value.version)
  const inFlight = useRef(false)
  const begin = useRequestScope()
  const initial: Editable = {
    title: value.title,
    symptom: value.symptom,
    conditions: value.conditions,
    investigation: value.investigation,
    cause: value.cause,
    solution: value.solution,
    verification: value.verification,
    publication: value.publication,
    validity: value.validity,
  }
  async function submit(values: Editable) {
    if (inFlight.current) return
    inFlight.current = true
    setIsBusy(true)
    setError('')
    try {
      await onSave({ ...values, version: baseVersion })
      void message.success('案例已保存新版本')
    } catch (reason: unknown) {
      if (!isCancelled(reason)) {
        setError(errorMessage(reason))
        setHasConflict(reason instanceof ApiError && reason.code === 'VERSION_CONFLICT')
      }
    } finally {
      inFlight.current = false
      setIsBusy(false)
    }
  }
  async function inspectLatest() {
    const scope = begin()
    setIsBusy(true)
    try {
      const result = await readCase(value.id, scope.signal)
      if (!scope.signal.aborted) setLatest(result)
    } catch (reason: unknown) {
      if (!isCancelled(reason)) setError(errorMessage(reason))
    } finally {
      scope.complete()
      if (!scope.signal.aborted) setIsBusy(false)
    }
  }
  return (
    <>
      <Form<Editable>
        initialValues={initial}
        layout="vertical"
        onFinish={(values) => void submit(values)}
        requiredMark={false}
        disabled={isBusy}
      >
        <CaseFieldsForm />
        <Form.Item name="publication" label="发布状态">
          <Select
            options={Object.entries(publicationLabels)
              .filter(([state]) => role === 'maintainer' || ['draft', 'pending'].includes(state))
              .map(([state, label]) => ({ value: state, label }))}
          />
        </Form.Item>
        <Form.Item name="validity" label="方案有效性">
          <Select
            options={Object.entries(validityLabels)
              .filter(
                ([state]) =>
                  role === 'maintainer' ||
                  (role === 'handler' ? state !== 'invalid' : state === 'unverified'),
              )
              .map(([state, label]) => ({ value: state, label }))}
          />
        </Form.Item>
        <Alert
          type="info"
          title="已验证方案需同时填写适用条件、处理步骤和实际验证记录。"
          showIcon
        />
        {error && (
          <Alert
            className="mt-4"
            type="error"
            title={error}
            action={
              hasConflict && <Button onClick={() => void inspectLatest()}>读取最新版本</Button>
            }
          />
        )}
        <Button
          type="primary"
          htmlType="submit"
          loading={isBusy}
          className="save-case"
          disabled={hasConflict}
        >
          保存新版本
        </Button>
      </Form>
      {latest && (
        <section
          className="mt-5 rounded-lg border border-solid border-[#dce4df] p-4"
          aria-label="冲突的最新版本"
        >
          <h3>最新版本 v{latest.version}</h3>
          <p>{latest.title}</p>
          <details>
            <summary>核对最新字段</summary>
            {conflictFields.map((field) => (
              <p key={field.key}>
                {field.label} · {latest[field.key]}
              </p>
            ))}
          </details>
          <p className="muted">当前草稿仍保留在表单中，核对并合并他人的修改后可采用此版本号。</p>
          <Button
            onClick={() => {
              setBaseVersion(latest.version)
              setHasConflict(false)
              setError('')
              setLatest(null)
            }}
          >
            已核对，以 v{latest.version} 为基础继续编辑
          </Button>
        </section>
      )}
    </>
  )
}
