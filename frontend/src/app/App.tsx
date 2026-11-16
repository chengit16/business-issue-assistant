/** @description 装配会话恢复和登录入口，订阅后台会话失效并清理账号范围状态。 */
import { lazy, Suspense, useEffect } from 'react'
import { Alert, Button, Spin } from 'antd'
import { onSessionExpired } from '../api/client'
import { useSessionStore } from '../store/session'

const Login = lazy(() => import('./Login').then((module) => ({ default: module.Login })))
const Workspace = lazy(() =>
  import('./Workspace').then((module) => ({ default: module.Workspace })),
)

/** 可信身份就绪后挂载独立工作台，账号切换通过 key 丢弃旧页面状态。 */
export function App() {
  const user = useSessionStore((state) => state.user)
  const status = useSessionStore((state) => state.status)
  const error = useSessionStore((state) => state.error)
  const restore = useSessionStore((state) => state.restore)
  const expire = useSessionStore((state) => state.expire)
  useEffect(() => {
    void restore()
    return onSessionExpired(expire)
  }, [restore, expire])
  if (status === 'loading') return <Spin size="large" description="正在打开工作台" fullscreen />
  if (status === 'error')
    return (
      <div className="connection-error">
        <Alert
          type="error"
          title="暂时无法连接服务"
          description={error}
          showIcon
          action={<Button onClick={() => void restore()}>重试</Button>}
        />
      </div>
    )
  return (
    <Suspense fallback={<Spin fullscreen />}>
      {user ? <Workspace key={user.id} user={user} /> : <Login />}
    </Suspense>
  )
}
