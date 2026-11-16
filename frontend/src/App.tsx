/**
 * @description 装配登录入口、团队工作台与按页面加载的业务视图。会话与业务权限由后台验证，页面切换隔离当前业务状态。
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import {
  App as AntApp,
  Alert,
  Avatar,
  Badge,
  Button,
  Form,
  Input,
  Select,
  Spin,
} from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  CheckSquareOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MessageOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { api, ApiError } from './api'
import type { Business, User } from './types'
import { roleLabels } from './types'
import { useLoad } from './useLoad'

// 按页面加载交互组件，让登录页和首次打开工作台只下载当前需要的代码。
const Assistant = lazy(() =>
  import('./Assistant').then((module) => ({ default: module.Assistant })),
)
const Records = lazy(() =>
  import('./Assistant').then((module) => ({ default: module.Records })),
)
const CaseLibrary = lazy(() =>
  import('./CaseLibrary').then((module) => ({ default: module.CaseLibrary })),
)
const Intake = lazy(() =>
  import('./Intake').then((module) => ({ default: module.Intake })),
)
const CaseDetail = lazy(() =>
  import('./CaseDetail').then((module) => ({ default: module.CaseDetail })),
)

const navigation = [
  { key: 'assistant', title: '问题助手', icon: <MessageOutlined /> },
  { key: 'cases', title: '团队案例库', icon: <BookOutlined /> },
  { key: 'intake', title: '收录经验', icon: <PlusOutlined /> },
  { key: 'records', title: '我的提问', icon: <HistoryOutlined /> },
  { key: 'review', title: '待确认', icon: <CheckSquareOutlined /> },
]

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(values: { email: string; password: string }) {
    setBusy(true)
    setError('')
    try {
      onLogin(
        await api<User>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(values),
        }),
      )
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-page">
      <div className="login-story">
        <div className="brand">
          <span className="brand-mark">知</span>业务问题助手
        </div>
        <div>
          <span className="eyebrow">团队经验，持续生长</span>
          <h1>
            把一次解决，
            <br />
            变成共同经验。
          </h1>
          <p>连接分散的问题与答案，让下一次排查有迹可循。</p>
        </div>
        <span className="login-foot">案例收录 · 经验检索 · 协作确认</span>
      </div>
      <section className="login-form">
        <span className="eyebrow">团队工作台</span>
        <h2>欢迎回来</h2>
        <p className="muted">登录后，接续团队的解决经验。</p>
        {error && <Alert type="error" title={error} showIcon />}
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            label="工作邮箱"
            name="email"
            rules={[
              { required: true, type: 'email', message: '请输入有效邮箱' },
            ]}
          >
            <Input
              autoComplete="username"
              placeholder="请输入工作邮箱"
              size="large"
            />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              autoComplete="current-password"
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            block
            size="large"
          >
            进入工作台 <ArrowRightOutlined />
          </Button>
        </Form>
        <p className="login-hint">首次本地启动的账号配置见项目 README。</p>
      </section>
    </main>
  )
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { message } = AntApp.useApp()
  const [page, setPage] = useState(location.hash.slice(1) || 'assistant')
  const [business, setBusiness] = useState<Business>(user.businesses[0])
  const [selectedCase, setSelectedCase] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [reusedText, setReusedText] = useState('')
  const overview = useLoad<{
    published: number
    verified: number
    pending: number
    questions: number
    analysis_mode: string
  }>(`/overview?refresh=${refresh}`)
  useEffect(() => {
    const update = () => setPage(location.hash.slice(1) || 'assistant')
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  function navigate(next: string) {
    location.hash = next
    setPage(next)
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
      onLogout()
    } catch (reason) {
      message.error((reason as Error).message)
    }
  }
  const current = navigation.find((item) => item.key === page) || navigation[0]
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="#assistant">
          <span className="brand-mark">知</span>
          <span>
            业务问题助手<small>团队经验工作台</small>
          </span>
        </a>
        <div className="workspace-label">
          <TeamOutlined /> 团队空间 <span>内部</span>
        </div>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <button
              key={item.key}
              className={page === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => navigate(item.key)}
            >
              {item.icon}
              <span>{item.title}</span>
              {item.key === 'review' && !!overview.data?.pending && (
                <Badge count={overview.data.pending} color="#176655" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <BookOutlined />
          </span>
          <strong>经验值得被留下</strong>
          <p>记录实际处理过程，让团队少走一次弯路。</p>
          <Button type="text" onClick={() => navigate('intake')}>
            收录一条经验 <ArrowRightOutlined />
          </Button>
        </div>
        <div className="profile">
          <Avatar style={{ background: '#e6ece5', color: '#34604d' }}>
            {user.name.slice(0, 1)}
          </Avatar>
          <span>
            <strong>{user.name}</strong>
            <small>{roleLabels[user.role]}</small>
          </span>
          <Button
            type="text"
            aria-label="退出登录"
            icon={<LogoutOutlined />}
            onClick={logout}
          />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">团队空间</span>
            <span className="breadcrumb-slash">/</span>
            {current.title}
          </div>
          <div className="topbar-right">
            <span className="status-dot" />
            <span className="mode-label">
              {overview.data?.analysis_mode === 'model'
                ? '模型辅助模式'
                : '本地规则模式'}
            </span>
            <Select
              aria-label="当前业务"
              value={business}
              onChange={setBusiness}
              options={user.businesses.map((value) => ({
                value,
                label: value,
              }))}
            />
            <Button
              className="mobile-logout"
              type="text"
              aria-label="退出登录"
              icon={<LogoutOutlined />}
              onClick={logout}
            />
          </div>
        </header>
        <main className="main-content" key={`${page}-${business}-${refresh}`}>
          <Suspense fallback={<Spin description="正在加载页面" />}>
            {page === 'assistant' && (
              <Assistant
                business={business}
                initialText={reusedText}
                openCase={setSelectedCase}
                onRecorded={overview.reload}
              />
            )}
            {page === 'cases' && (
              <CaseLibrary
                business={business}
                openCase={setSelectedCase}
                onIntake={() => navigate('intake')}
              />
            )}
            {page === 'intake' && (
              <Intake
                business={business}
                onSaved={(id) => {
                  setSelectedCase(id)
                  overview.reload()
                  navigate('review')
                }}
              />
            )}
            {page === 'records' && <Records openCase={setSelectedCase} />}
            {page === 'review' && (
              <CaseLibrary
                business={business}
                review
                openCase={setSelectedCase}
                onIntake={() => navigate('intake')}
              />
            )}
            {!navigation.some((item) => item.key === page) && (
              <Alert title="此页面不存在，请选择左侧导航。" type="info" />
            )}
          </Suspense>
        </main>
        <footer className="page-footer">
          <span>业务问题助手</span>
          <span>让经验可查，让解决可循。</span>
        </footer>
      </div>
      <Suspense fallback={<Spin fullscreen />}>
        {selectedCase && (
          <CaseDetail
            id={selectedCase}
            user={user}
            onClose={() => setSelectedCase(null)}
            onUpdated={() => {
              setRefresh((value) => value + 1)
              overview.reload()
            }}
            onReuse={(text, nextBusiness) => {
              setBusiness(nextBusiness)
              setReusedText(text)
              setSelectedCase(null)
              navigate('assistant')
            }}
          />
        )}
      </Suspense>
    </div>
  )
}

/** 恢复当前会话，提供登录、连接失败恢复及工作台入口。 */
export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch((reason) => {
        if (!(reason instanceof ApiError && reason.status === 401))
          setError(reason.message)
      })
      .finally(() => setLoading(false))
  }, [])
  if (loading)
    return (
      <div className="loading-screen">
        <Spin size="large" description="正在打开工作台" fullscreen />
      </div>
    )
  if (error)
    return (
      <div className="connection-error">
        <Alert
          type="error"
          title="暂时无法连接服务"
          description={error}
          showIcon
          action={<Button onClick={() => location.reload()}>重试</Button>}
        />
      </div>
    )
  return user ? (
    <Workspace user={user} onLogout={() => setUser(null)} />
  ) : (
    <Login onLogin={setUser} />
  )
}
