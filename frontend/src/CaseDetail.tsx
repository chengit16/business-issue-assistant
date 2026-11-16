/**
 * @description 展示案例、原始依据及版本记录，维护人工确认表单。保存携带预期版本，冲突时保留编辑内容。
 */
import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Image,
  Input,
  Select,
  Skeleton,
  Tabs,
  Tag,
} from 'antd'
import { api } from './api'
import { useLoad } from './useLoad'
import { DraftFormFields } from './Intake'
import type { Business, Case, Source, User } from './types'
import { publicationLabels, validityLabels } from './types'

/** 按案例编号读取详情，保存成功通知列表刷新，复用时携带所属业务。 */
export function CaseDetail({
  id,
  user,
  onClose,
  onUpdated,
  onReuse,
}: {
  id: string
  user: User
  onClose: () => void
  onUpdated: () => void
  onReuse: (text: string, business: Business) => void
}) {
  const { message } = App.useApp()
  const state = useLoad<Case>(`/cases/${id}`)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState<Source | null>(null)
  const [sourceError, setSourceError] = useState('')
  const [versions, setVersions] = useState<
    { id: string; version: number; created_at: string; snapshot: Case }[]
  >([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyError, setHistoryError] = useState('')
  useEffect(() => {
    setEditing(false)
    setSource(null)
    setVersions([])
    setHistoryLoaded(false)
    setHistoryError('')
    setSourceError('')
  }, [id])
  async function showSource() {
    if (!state.data) return
    try {
      setSource(await api<Source>(`/sources/${state.data.source_id}`))
    } catch (reason) {
      setSourceError((reason as Error).message)
    }
  }
  async function showHistory() {
    try {
      setVersions(await api(`/cases/${id}/revisions`))
      setHistoryLoaded(true)
      setHistoryError('')
    } catch (reason) {
      setHistoryError((reason as Error).message)
    }
  }
  async function save(values: Case) {
    if (!state.data) return
    setBusy(true)
    try {
      await api(`/cases/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...values, version: state.data.version }),
      })
      message.success('案例已保存新版本')
      setEditing(false)
      state.reload()
      onUpdated()
      setSource(null)
      setVersions([])
      setHistoryLoaded(false)
    } catch (reason) {
      message.error((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const item = state.data
  const canEdit =
    item &&
    (user.role === 'maintainer' ||
      (item.publication !== 'published' &&
        item.publication !== 'archived' &&
        (item.owner_id === user.id || user.role === 'handler')))
  return (
    <Drawer open title="案例详情" width={740} onClose={onClose} destroyOnHidden>
      {state.loading ? (
        <Skeleton active />
      ) : state.error ? (
        <Alert
          type="error"
          title={state.error}
          action={<Button onClick={state.reload}>重试</Button>}
        />
      ) : (
        item && (
          <>
            <div className="detail-tags">
              <Tag>{item.business}</Tag>
              <Tag color={item.validity === 'verified' ? 'green' : 'default'}>
                {validityLabels[item.validity]}
              </Tag>
              <Tag>{publicationLabels[item.publication]}</Tag>
              {item.is_demo && <Tag>虚构示例</Tag>}
              <span className="muted">v{item.version}</span>
            </div>
            <h2 className="detail-title">{item.title}</h2>
            <div className="detail-actions">
              <Button onClick={() => onReuse(item.symptom, item.business)}>
                用于新问题
              </Button>
              {canEdit && (
                <Button type="primary" onClick={() => setEditing(!editing)}>
                  {editing ? '取消编辑' : '编辑与确认'}
                </Button>
              )}
            </div>
            {editing ? (
              <Form
                initialValues={{
                  title: item.title,
                  symptom: item.symptom,
                  conditions: item.conditions,
                  investigation: item.investigation,
                  cause: item.cause,
                  solution: item.solution,
                  verification: item.verification,
                  publication: item.publication,
                  validity: item.validity,
                }}
                layout="vertical"
                onFinish={save}
                requiredMark={false}
                disabled={busy}
              >
                <DraftFormFields />
                <Form.Item name="publication" label="发布状态">
                  <Select
                    options={Object.entries(publicationLabels)
                      .filter(
                        ([value]) =>
                          user.role === 'maintainer' ||
                          ['draft', 'pending'].includes(value),
                      )
                      .map(([value, label]) => ({ value, label }))}
                  />
                </Form.Item>
                <Form.Item name="validity" label="方案有效性">
                  <Select
                    options={Object.entries(validityLabels)
                      .filter(
                        ([value]) =>
                          user.role === 'maintainer' ||
                          (user.role === 'handler'
                            ? value !== 'invalid'
                            : value === 'unverified'),
                      )
                      .map(([value, label]) => ({ value, label }))}
                  />
                </Form.Item>
                <Alert
                  type="info"
                  title="已验证方案需同时填写适用条件、处理步骤和实际验证记录。"
                  showIcon
                />
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={busy}
                  className="save-case"
                >
                  保存新版本
                </Button>
              </Form>
            ) : (
              <Tabs
                onChange={(tab) => {
                  if (tab === 'source') void showSource()
                  if (tab === 'history') void showHistory()
                }}
                items={[
                  {
                    key: 'content',
                    label: '处理经验',
                    children: (
                      <div className="detail-content">
                        {[
                          ['问题现象', item.symptom],
                          ['适用条件', item.conditions],
                          ['排查过程', item.investigation],
                          ['原因说明', item.cause],
                          ['处理步骤', item.solution],
                          ['验证结果', item.verification],
                        ].map(([label, value]) => (
                          <section key={label}>
                            <h3>{label}</h3>
                            <p>{value || '待补充'}</p>
                          </section>
                        ))}
                        <p className="muted">
                          更新于{' '}
                          {new Date(item.updated_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: 'source',
                    label: '原始依据',
                    children: sourceError ? (
                      <Alert
                        type="error"
                        title={sourceError}
                        action={<Button onClick={showSource}>重试</Button>}
                      />
                    ) : !source ? (
                      <Skeleton active />
                    ) : (
                      <div className="source-detail">
                        <p className="muted">
                          材料编号 {source.id} · v{source.version}
                        </p>
                        <pre>{source.text}</pre>
                        {source.attachment_name && (
                          <>
                            <h3>{source.attachment_name}</h3>
                            <Image
                              src={`/api/sources/${source.id}/attachment`}
                              alt={source.attachment_name}
                            />
                          </>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'history',
                    label: '版本记录',
                    children: historyError ? (
                      <Alert
                        type="error"
                        title={historyError}
                        action={<Button onClick={showHistory}>重试</Button>}
                      />
                    ) : !historyLoaded ? (
                      <Skeleton active />
                    ) : (
                      <div>
                        {versions.map((version) => (
                          <details key={version.id} className="version-entry">
                            <summary>
                              v{version.version} ·{' '}
                              {new Date(version.created_at).toLocaleString(
                                'zh-CN',
                              )}
                            </summary>
                            <h3>{version.snapshot.title}</h3>
                            <p>{version.snapshot.symptom}</p>
                            <p>
                              {version.snapshot.solution || '处理步骤待补充'}
                            </p>
                            <Tag>
                              {publicationLabels[version.snapshot.publication]}
                            </Tag>
                            <Tag>
                              {validityLabels[version.snapshot.validity]}
                            </Tag>
                          </details>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            )}
            <Input type="hidden" value={item.id} readOnly />
          </>
        )
      )}
    </Drawer>
  )
}
