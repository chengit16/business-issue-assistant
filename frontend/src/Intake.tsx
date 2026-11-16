/**
 * @description 编排原始材料保存与经验草稿提交，表单失败时保留输入，新增草稿始终等待人工确认。
 */
import { useRef, useState } from 'react'
import { Alert, App, Button, Form, Input, Steps, Tag, Upload } from 'antd'
import { ArrowRightOutlined, PaperClipOutlined } from '@ant-design/icons'
import { api, writeOptions } from './api'
import type { Business, Case, DraftFields, Source } from './types'

/** 收录和人工确认共用的可编辑字段，不包含服务端维护的状态和编号。 */
export const draftFields: {
  name: keyof DraftFields
  label: string
  placeholder: string
  required?: boolean
}[] = [
  {
    name: 'title',
    label: '案例标题',
    placeholder: '用一句话概括问题',
    required: true,
  },
  {
    name: 'symptom',
    label: '问题现象',
    placeholder: '当时发生了什么？有哪些报错或异常表现？',
    required: true,
  },
  {
    name: 'conditions',
    label: '适用条件',
    placeholder: '涉及的系统、业务渠道、版本与时间范围',
  },
  {
    name: 'investigation',
    label: '排查过程',
    placeholder: '尝试过哪些操作，分别观察到什么结果？',
  },
  {
    name: 'cause',
    label: '原因说明',
    placeholder: '尚未确认时请留空，区分事实与推测',
  },
  {
    name: 'solution',
    label: '处理步骤',
    placeholder: '实际执行的操作、所需角色与前置条件',
  },
  {
    name: 'verification',
    label: '验证记录',
    placeholder: '谁在什么条件下进行了哪些操作，实际结果如何？',
  },
]

/** 渲染经验的业务字段，验证及发布状态由调用页面单独控制。 */
export function DraftFormFields() {
  return (
    <>
      {draftFields.map((field) => (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.label}
          rules={
            field.required
              ? [
                  {
                    required: true,
                    min: 2,
                    whitespace: true,
                    message: `请至少填写 2 个字的${field.label}`,
                  },
                ]
              : []
          }
        >
          {field.name === 'title' ? (
            <Input maxLength={160} placeholder={field.placeholder} />
          ) : (
            <Input.TextArea
              rows={field.name === 'symptom' ? 3 : 2}
              maxLength={10000}
              placeholder={field.placeholder}
            />
          )}
        </Form.Item>
      ))}
    </>
  )
}

/** 保存材料后整理经验，仅在草稿成功入库后触发 onSaved。 */
export function Intake({
  business,
  onSaved,
}: {
  business: Business
  onSaved: (id: string) => void
}) {
  const { message } = App.useApp()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('local_rules')
  const [similar, setSimilar] = useState<Case[]>([])
  const key = useRef(crypto.randomUUID())
  const [draft, setDraft] = useState<DraftFields | null>(null)
  async function prepare() {
    if (text.trim().length < 4) {
      message.warning('请至少填写 4 个字的材料说明')
      return
    }
    setBusy(true)
    setError('')
    try {
      const preview = await api<
        DraftFields & { similar: Case[]; mode: string }
      >('/drafts/preview', {
        method: 'POST',
        body: JSON.stringify({ text, business }),
      })
      const payload = new FormData()
      payload.set('business', business)
      payload.set('text', text)
      if (file) payload.set('file', file)
      const material = await api<Source>('/sources', {
        method: 'POST',
        body: payload,
      })
      setSource(material)
      setMode(preview.mode)
      setSimilar(preview.similar)
      setDraft(preview)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function save(values: DraftFields) {
    if (!source) return
    setBusy(true)
    setError('')
    try {
      const item = await api<Case>(
        '/drafts',
        writeOptions({ ...values, source_id: source.id }, key.current),
      )
      message.success('经验已提交，等待人工确认')
      onSaved(item.id)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="page-intro compact">
        <span className="eyebrow">为下一次解决留下线索</span>
        <h1>
          把这次解决经验留下来<span className="title-dot">。</span>
        </h1>
        <p>粘贴问题和处理过程，整理并确认后，供团队查找。</p>
      </div>
      <Steps
        className="intake-steps"
        current={source ? 1 : 0}
        items={[
          { title: '添加原始材料' },
          { title: '整理经验草稿' },
          { title: '人工确认发布' },
        ]}
      />
      {error && <Alert type="error" title={error} showIcon />}
      <div className="intake-grid">
        <section className="panel source-panel">
          <div className="section-heading">
            <h2>原始材料</h2>
            <Tag>{business}</Tag>
          </div>
          <p className="muted">保留问题、排查对话和最终处理结果。</p>
          <Input.TextArea
            aria-label="原始聊天材料"
            value={text}
            disabled={!!source || busy}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            maxLength={20000}
            placeholder="在这里粘贴群聊或处理记录，附上截图背景说明……"
          />
          {!source && (
            <Upload
              accept="image/png,image/jpeg,image/webp"
              maxCount={1}
              fileList={
                file
                  ? [{ uid: 'attachment', name: file.name, status: 'done' }]
                  : []
              }
              beforeUpload={(value) => {
                if (
                  !['image/png', 'image/jpeg', 'image/webp'].includes(
                    value.type,
                  ) ||
                  value.size > 5 * 1024 * 1024
                ) {
                  message.warning('请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片')
                  return Upload.LIST_IGNORE
                }
                setFile(value)
                return false
              }}
              onRemove={() => {
                setFile(null)
              }}
            >
              <Button disabled={busy} icon={<PaperClipOutlined />}>
                添加截图
              </Button>
            </Upload>
          )}
          {source ? (
            <div className="source-status">
              <Tag color="green">原始材料已保存</Tag>
              <p className="muted">材料编号 {source.id}</p>
              <p className="muted">
                如需补充原文，可重新进入收录页面创建新材料。
              </p>
            </div>
          ) : (
            <Button type="primary" onClick={prepare} loading={busy} block>
              整理草稿 <ArrowRightOutlined />
            </Button>
          )}
        </section>
        <section className="panel draft-panel">
          <div className="section-heading">
            <h2>经验草稿</h2>
            <Tag>待人工确认</Tag>
          </div>
          {!source ? (
            <div className="draft-placeholder">
              <span className="placeholder-symbol">知</span>
              <h3>从一段对话，整理出一条经验</h3>
              <p>
                添加原始材料后，在这里补充适用条件、
                <br />
                处理步骤和实际验证结果。
              </p>
            </div>
          ) : (
            <>
              <Alert
                type="info"
                title={
                  mode === 'local_rules'
                    ? '本地规则仅提取标题和原文，请校正并补充其余字段。'
                    : '模型整理结果需要人工校正，请核对原文和处理结果。'
                }
                showIcon
              />
              {!!similar.length && (
                <div className="similar-notice">
                  <strong>发现 {similar.length} 条相似经验</strong>
                  {similar.map((item) => (
                    <p key={item.id}>{item.title}</p>
                  ))}
                  <small>发布前请核对是否需要合并已有经验。</small>
                </div>
              )}
              <Form
                initialValues={draft || {}}
                layout="vertical"
                onFinish={save}
                requiredMark={false}
                disabled={busy}
                onValuesChange={() => {
                  key.current = crypto.randomUUID()
                }}
              >
                <DraftFormFields />
                <p className="muted">
                  新增经验提交后保持待验证，由处理人核对验证结果。
                </p>
                <Button type="primary" htmlType="submit" loading={busy}>
                  提交人工确认
                </Button>
              </Form>
            </>
          )}
        </section>
      </div>
    </>
  )
}
