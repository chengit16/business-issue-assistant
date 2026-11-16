/**
 * @description 维护问题描述、检索分析、处理反馈和个人记录。分析失败保留输入，反馈仅在接口确认后更新。
 */
import { useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Skeleton,
  Tag,
} from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { api, writeOptions } from './api'
import { useLoad } from './useLoad'
import type { Analysis, Business, Case, Question, Source } from './types'
import { progressLabels } from './types'

/** 显示案例摘要，点击时由父页面打开其完整依据。 */
export function CaseRow({
  item,
  onClick,
}: {
  item: Case
  onClick: () => void
}) {
  return (
    <button className="case-row" onClick={onClick}>
      <span className="case-file">
        <FileTextOutlined />
      </span>
      <span className="case-row-copy">
        <strong>{item.title}</strong>
        <small>
          {item.business} <span>·</span> {item.conditions || '适用条件待补充'}
        </small>
      </span>
      {item.is_demo && <Tag>示例</Tag>}
      <ArrowRightOutlined className="row-arrow" />
    </button>
  )
}

/** 展示当前分析及引用，反馈成功后通知调用方重新读取处理进度。 */
export function AnalysisResult({
  value,
  openCase,
  onFeedback,
}: {
  value: Analysis
  openCase: (id: string) => void
  onFeedback?: () => void | Promise<void>
}) {
  const { message } = App.useApp()
  const [showFeedback, setShowFeedback] = useState(false)
  const [outcome, setOutcome] = useState('resolved')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const feedbackKey = useRef(crypto.randomUUID())
  async function submit() {
    if (note.trim().length < 2) {
      message.warning('请补充实际操作和处理结果')
      return
    }
    setBusy(true)
    try {
      await api(
        `/questions/${value.question.id}/feedback`,
        writeOptions({ outcome, note }, feedbackKey.current),
      )
      message.success('处理结果已记录')
      setShowFeedback(false)
      setNote('')
      feedbackKey.current = crypto.randomUUID()
      await onFeedback?.()
    } catch (reason) {
      message.error((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const result = value.run.result
  return (
    <section className="analysis-result panel" aria-live="polite">
      <div className="section-heading">
        <h2>
          <span className="small-brand">知</span>排查参考
        </h2>
        <Tag color="default">{progressLabels[value.question.progress]}</Tag>
      </div>
      <Alert type="info" title={result.notice} showIcon />
      <p className="analysis-summary">{result.summary}</p>
      <h3>建议排查顺序</h3>
      <ol className="step-list">
        {result.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <h3>需要补充的信息</h3>
      <div className="missing-tags">
        {result.missing.map((item) => (
          <Tag key={item}>{item}</Tag>
        ))}
      </div>
      <h3>
        相关历史案例 <span className="muted">{result.citations.length}</span>
      </h3>
      {result.citations.length ? (
        result.citations.map((item) => (
          <div key={item.id}>
            {item.currently_available === false && (
              <Alert
                type="warning"
                title="此引用已更新、归档或失效，请重新分析后选用当前方案。"
              />
            )}
            <CaseRow item={item} onClick={() => openCase(item.id)} />
          </div>
        ))
      ) : (
        <p className="muted">
          补充具体背景后可重新分析，也可交由处理人继续跟进。
        </p>
      )}
      <div className="result-actions">
        <Button
          icon={<CopyOutlined />}
          onClick={() =>
            navigator.clipboard
              .writeText(result.reply)
              .then(() => message.success('回复草稿已复制'))
              .catch(() => message.error('复制失败，请手动复制'))
          }
        >
          复制回复
        </Button>
        <Button type="primary" onClick={() => setShowFeedback(true)}>
          记录处理结果
        </Button>
      </div>
      <details className="trace">
        <summary>查看分析记录</summary>
        <p>运行编号 {value.run.id}</p>
        <p>
          规则版本 {value.run.rule_version} · {value.run.model}
        </p>
      </details>
      <Modal
        title="记录处理结果"
        open={showFeedback}
        onCancel={() => setShowFeedback(false)}
        onOk={submit}
        confirmLoading={busy}
        okText="保存结果"
        destroyOnHidden
      >
        <div className="modal-fields">
          <label>
            当前结果
            <Select
              value={outcome}
              onChange={(value) => {
                setOutcome(value)
                feedbackKey.current = crypto.randomUUID()
              }}
              options={[
                { value: 'resolved', label: '已解决' },
                { value: 'unresolved', label: '仍未解决' },
                { value: 'not_applicable', label: '方案不适用' },
              ]}
            />
          </label>
          <label>
            实际操作与结果
            <Input.TextArea
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                feedbackKey.current = crypto.randomUUID()
              }}
              rows={5}
              maxLength={5000}
              placeholder="执行了哪些操作？观察到什么结果？由谁确认？"
            />
          </label>
        </div>
      </Modal>
    </section>
  )
}

/** 收集当前业务问题并执行分析，请求失败保留文本和截图引用供重试。 */
export function Assistant({
  business,
  initialText,
  openCase,
  onRecorded,
}: {
  business: Business
  initialText: string
  openCase: (id: string) => void
  onRecorded: () => void
}) {
  const { message } = App.useApp()
  const [text, setText] = useState(initialText)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const requestKey = useRef(crypto.randomUUID())
  const sourceRef = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const recent = useLoad<Case[]>(
    `/cases?business=${encodeURIComponent(business)}`,
  )
  const verified = (recent.data || [])
    .filter(
      (item) =>
        item.publication === 'published' && item.validity === 'verified',
    )
    .slice(0, 3)
  function updateText(value: string) {
    setText(value)
    requestKey.current = crypto.randomUUID()
    sourceRef.current = null
  }
  function updateFile(value: File | null) {
    if (
      value &&
      (!['image/png', 'image/jpeg', 'image/webp'].includes(value.type) ||
        value.size > 5 * 1024 * 1024)
    ) {
      message.warning('请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片')
      return
    }
    setFile(value)
    requestKey.current = crypto.randomUUID()
    sourceRef.current = null
  }
  async function submit() {
    if (text.trim().length < 4) {
      message.warning('请至少填写 4 个字的问题背景')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (file && !sourceRef.current) {
        const form = new FormData()
        form.set('business', business)
        form.set('text', text)
        form.set('file', file)
        const source = await api<Source>('/sources', {
          method: 'POST',
          body: form,
        })
        sourceRef.current = source.id
      }
      const value = await api<Analysis>(
        '/analyses',
        writeOptions(
          { text, business, source_id: sourceRef.current },
          requestKey.current,
        ),
      )
      setResult(value)
      onRecorded()
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">把团队经验，带到每一次排查中</div>
        <h1>
          遇到业务问题，
          <br className="mobile-break" />
          先查团队经验<span className="title-dot">。</span>
        </h1>
        <p>描述问题，查找相关案例，让下一步处理更有依据。</p>
      </div>
      <div className="assistant-grid">
        <div className="assistant-main">
          <section className="question-box">
            <div className="composer-label">
              <span className="small-brand">知</span>
              <strong>今天遇到了什么问题？</strong>
              <Tag variant="filled">{business}</Tag>
            </div>
            <Input.TextArea
              aria-label="问题描述"
              variant="borderless"
              value={text}
              onChange={(event) => updateText(event.target.value)}
              disabled={busy}
              maxLength={10000}
              autoSize={{ minRows: 5, maxRows: 12 }}
              onPaste={(event) => {
                const image = Array.from(event.clipboardData.files).find(
                  (item) => item.type.startsWith('image/'),
                )
                if (image) {
                  event.preventDefault()
                  updateFile(image)
                }
              }}
              placeholder="描述发生了什么、涉及哪个业务、已经尝试过哪些操作……也可以直接粘贴群聊内容。"
            />
            {file && (
              <div className="attached-file">
                <PaperClipOutlined /> {file.name}
                <Button
                  disabled={busy}
                  type="text"
                  size="small"
                  onClick={() => updateFile(null)}
                >
                  移除
                </Button>
              </div>
            )}
            <div className="composer-bottom">
              <div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) =>
                    updateFile(event.target.files?.[0] || null)
                  }
                />
                <Button
                  type="text"
                  disabled={busy}
                  icon={<PaperClipOutlined />}
                  onClick={() => fileInput.current?.click()}
                >
                  添加截图
                </Button>
                <span className="composer-hint">支持粘贴图片</span>
              </div>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={busy}
                onClick={submit}
              >
                开始分析
              </Button>
            </div>
          </section>
          <p className="input-note">
            截图作为原始材料保存。当前模式请在描述中补充截图里的关键文字。
          </p>
          {error && (
            <Alert
              type="error"
              title={error}
              showIcon
              action={<Button onClick={submit}>重试</Button>}
            />
          )}
          {!result && (
            <div className="prompt-examples">
              <span>可以这样问</span>
              {[
                '客户已扣款，订单仍显示待支付',
                '优惠券满足门槛，但结算时无法使用',
                '后台登录后提示没有操作权限',
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => updateText(item)}
                  disabled={busy}
                >
                  {item}
                  <ArrowRightOutlined />
                </button>
              ))}
            </div>
          )}
          {result && (
            <AnalysisResult
              value={result}
              openCase={openCase}
              onFeedback={async () => {
                setResult(
                  await api<Analysis>(`/questions/${result.question.id}`),
                )
              }}
            />
          )}
          <section className="recent-section">
            <div className="section-heading">
              <h2>团队最近留下的经验</h2>
              <a href="#cases">
                查看案例库 <ArrowRightOutlined />
              </a>
            </div>
            {recent.loading ? (
              <Skeleton active />
            ) : recent.error ? (
              <Alert
                type="error"
                title={recent.error}
                action={<Button onClick={recent.reload}>重试</Button>}
              />
            ) : verified.length ? (
              verified.map((item) => (
                <CaseRow
                  key={item.id}
                  item={item}
                  onClick={() => openCase(item.id)}
                />
              ))
            ) : (
              <div className="empty-inline">
                <FileTextOutlined className="empty-icon" />
                <p>这里将展示团队已发布并验证的经验。</p>
                <a href="#intake">
                  收录第一条经验 <ArrowRightOutlined />
                </a>
              </div>
            )}
          </section>
        </div>
        <aside className="assistant-aside">
          <div className="guide-card">
            <div className="guide-symbol">
              <SearchOutlined />
            </div>
            <h2>让问题更容易被解决</h2>
            <p>多一点背景，少一点来回确认。</p>
            <div className="guide-item">
              <span>发生了什么</span>
              <small>问题现象、报错与发生时间</small>
            </div>
            <div className="guide-item">
              <span>在哪里发生</span>
              <small>所属系统、渠道与具体版本</small>
            </div>
            <div className="guide-item">
              <span>已经做过什么</span>
              <small>尝试的操作与观察到的结果</small>
            </div>
            <div className="guide-tip">
              <CheckCircleOutlined />
              <span>
                每条历史经验都有适用条件，
                <br />
                执行前请先核对。
              </span>
            </div>
          </div>
          <a className="intake-link" href="#intake">
            <span className="intake-icon">
              <PlusOutlined />
            </span>
            <span>
              <strong>把这次解决经验留下来</strong>
              <small>整理成案例，供团队下次查找</small>
            </span>
            <ArrowRightOutlined />
          </a>
        </aside>
      </div>
    </>
  )
}

/** 读取当前登录者的提问，详情及反馈权限由后台再次验证。 */
export function Records({ openCase }: { openCase: (id: string) => void }) {
  const { message } = App.useApp()
  const records = useLoad<Question[]>('/questions')
  const [detail, setDetail] = useState<Analysis | null>(null)
  const [busy, setBusy] = useState(false)
  async function open(id: string) {
    setBusy(true)
    try {
      setDetail(await api<Analysis>(`/questions/${id}`))
    } catch (reason) {
      message.error((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="page-intro compact">
        <span className="eyebrow">接续每一次排查</span>
        <h1>我的提问</h1>
        <p>查看分析记录，补充实际处理结果。</p>
      </div>
      {records.error && (
        <Alert
          type="error"
          title={records.error}
          action={<Button onClick={records.reload}>重试</Button>}
        />
      )}
      {records.loading ? (
        <Skeleton active />
      ) : !records.data?.length ? (
        <Empty description="还没有提问记录">
          <a href="#assistant">开始第一次提问</a>
        </Empty>
      ) : (
        <div className="panel records-list">
          {records.data.map((item) => (
            <button
              className="record-row"
              key={item.id}
              onClick={() => open(item.id)}
              disabled={busy}
            >
              <span>
                <strong>{item.text}</strong>
                <small>
                  {item.business} ·{' '}
                  {new Date(item.created_at).toLocaleString('zh-CN')}
                </small>
              </span>
              <Tag color={item.progress === 'resolved' ? 'green' : 'default'}>
                {progressLabels[item.progress]}
              </Tag>
              <ArrowRightOutlined />
            </button>
          ))}
        </div>
      )}
      <Modal
        open={!!detail}
        title="提问与排查记录"
        footer={null}
        width={800}
        onCancel={() => setDetail(null)}
        destroyOnHidden
      >
        {detail && (
          <>
            <p className="original-question">{detail.question.text}</p>
            <AnalysisResult
              value={detail}
              openCase={openCase}
              onFeedback={() => {
                records.reload()
                void open(detail.question.id)
              }}
            />
            {detail.feedback?.map((item) => (
              <div className="feedback-note" key={item.id}>
                <Tag>
                  {
                    (
                      {
                        resolved: '已解决',
                        unresolved: '仍未解决',
                        not_applicable: '方案不适用',
                      } as Record<string, string>
                    )[item.outcome]
                  }
                </Tag>
                {item.note}
              </div>
            ))}
          </>
        )}
      </Modal>
    </>
  )
}
