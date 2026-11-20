/** @description 维护登录表单和失败恢复，口令只传给身份 Service，不写入客户端状态存储。 */
import { useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { useSessionStore } from '../store/session'
import { errorMessage } from '../api/client'
import type { LoginInput } from '../api/services/identity'

/** 登录成功由会话 Store 挂载工作台，失败保留输入并显示后台归一化错误。 */
export function Login() {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const login = useSessionStore((state) => state.login)
  async function submit(values: LoginInput) {
    setIsBusy(true)
    setError('')
    try {
      await login(values)
    } catch (reason: unknown) {
      setError(errorMessage(reason))
    } finally {
      setIsBusy(false)
    }
  }
  return (
    <main className="login-page">
      <section className="login-form">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            知
          </span>
          <h1>业务问题助手</h1>
        </div>
        {error && <Alert type="error" title={error} showIcon />}
        <Form
          layout="vertical"
          onFinish={(values: LoginInput) => void submit(values)}
          requiredMark={false}
        >
          <Form.Item
            label="工作邮箱"
            name="email"
            rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
          >
            <Input autoComplete="username" size="large" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={isBusy} block size="large">
            登录
          </Button>
        </Form>
      </section>
    </main>
  )
}
