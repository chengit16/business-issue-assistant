/** @description 预览团队模型配置流程，实际运行模式来自后台，演示配置仅存于当前页面。 */
import { useState } from 'react'
import { Alert, App, Button, Form, Input, Radio, Tag } from 'antd'
import { ApiOutlined, BookOutlined, ExperimentOutlined, MessageOutlined } from '@ant-design/icons'
import type { AnalysisMode } from '../../types'
import './modelSettings.css'

interface ModelSettingsPageProps {
  /** 后端当前的实际模式，未读取成功时不推断配置状态。 */
  analysisMode?: AnalysisMode
}

interface PreviewFields {
  mode: AnalysisMode
  address?: string
  model?: string
}

/** 维护人可试走测试和应用两步流程，表单使用示例密钥状态。 */
export function ModelSettingsPage({ analysisMode }: ModelSettingsPageProps) {
  const [form] = Form.useForm<PreviewFields>()
  const { modal } = App.useApp()
  const mode = Form.useWatch('mode', form) ?? 'model'
  const [hasDemoKey, setHasDemoKey] = useState(false)
  const [testResult, setTestResult] = useState<'passed' | 'failed' | null>(null)
  const [applied, setApplied] = useState<PreviewFields | null>(null)

  function testConnection(values: PreviewFields) {
    // 仅使用固定的虚构连接组合，让预览能展示成功和失败，且不会发送网络请求。
    const matchesExample =
      values.address?.trim().replace(/\/$/, '') === 'https://model.example/v1' &&
      values.model?.trim() === 'demo-model'
    setTestResult(hasDemoKey && matchesExample ? 'passed' : 'failed')
  }

  function applyPreview() {
    const values = form.getFieldsValue()
    // 编辑后测试结果即失效，应用前再检查，避免把旧测试用于另一套连接参数。
    if (values.mode === 'model' && testResult !== 'passed') return
    modal.confirm({
      title: '应用这套预览配置？',
      content: '仅在本页记录这次演示。',
      okText: '应用到预览',
      onOk: () => setApplied(values),
    })
  }

  function useExample() {
    form.setFieldsValue({ mode: 'model', address: 'https://model.example/v1', model: 'demo-model' })
    setHasDemoKey(true)
    setTestResult(null)
  }

  return (
    <div className="model-settings">
      <div className="page-intro compact">
        <span className="eyebrow">团队管理</span>
        <h1>模型配置</h1>
        <p>管理团队用于问题分析和经验草稿整理的运行方式。</p>
      </div>
      <Alert
        className="mb-5"
        showIcon
        type="info"
        title="交互预览"
        description="用示例体验测试和应用流程。本页的演示独立于团队的实际配置。"
      />
      <div className="model-settings-grid">
        <section className="panel min-w-0" aria-labelledby="model-connection-title">
          <div className="flex items-start justify-between flex-wrap gap-x-4 gap-y-2 mb-4">
            <h2 id="model-connection-title" className="m-0">
              连接设置
            </h2>
            <Button size="small" type="link" onClick={useExample}>
              填入示例配置
            </Button>
          </div>
          <Form<PreviewFields>
            form={form}
            layout="vertical"
            initialValues={{ mode: 'model' }}
            onValuesChange={() => setTestResult(null)}
            onFinish={testConnection}
            requiredMark={false}
          >
            <Form.Item name="mode" label="运行方式" className="mb-4">
              <Radio.Group aria-label="运行方式">
                <Radio.Button value="model">模型辅助</Radio.Button>
                <Radio.Button value="local_rules">本地规则</Radio.Button>
              </Radio.Group>
            </Form.Item>
            {mode === 'model' ? (
              <>
                <Form.Item label="接口协议" className="mb-4">
                  <div className="model-protocol">
                    <ApiOutlined aria-hidden /> OpenAI 兼容（Chat Completions）
                  </div>
                </Form.Item>
                <Form.Item
                  name="address"
                  label="接口地址"
                  extra="填到基础路径，例如以 /v1 结尾的地址。"
                  className="mb-4"
                  rules={[
                    { required: true, whitespace: true, message: '请输入接口地址' },
                    { type: 'url', message: '请输入有效的接口地址' },
                  ]}
                >
                  <Input placeholder="https://model.example/v1" autoComplete="off" />
                </Form.Item>
                <Form.Item
                  name="model"
                  label="模型名称"
                  className="mb-4"
                  rules={[{ required: true, whitespace: true, message: '请输入模型名称' }]}
                >
                  <Input placeholder="demo-model" autoComplete="off" />
                </Form.Item>
                <div className="model-key-row">
                  <span>API 密钥</span>
                  <Tag color={hasDemoKey ? 'success' : 'default'}>
                    {hasDemoKey ? '已填入示例密钥' : '等待填入示例'}
                  </Tag>
                </div>
              </>
            ) : (
              <Alert
                type="info"
                showIcon
                title="使用案例库检索和本地整理规则，无需配置模型连接。"
              />
            )}
            <div aria-live="polite" className="model-test-result">
              {testResult === 'passed' && mode === 'model' && (
                <Alert type="success" showIcon title="模拟测试通过，可以应用到预览" />
              )}
              {testResult === 'failed' && mode === 'model' && (
                <Alert
                  type="error"
                  showIcon
                  title="模拟测试未通过"
                  description="请填入示例配置，再测试一次。"
                />
              )}
            </div>
            <div className="model-actions">
              {mode === 'model' && (
                <Button htmlType="submit" icon={<ExperimentOutlined />}>
                  模拟连接测试
                </Button>
              )}
              <Button
                type="primary"
                disabled={mode === 'model' && testResult !== 'passed'}
                onClick={applyPreview}
              >
                应用到预览
              </Button>
            </div>
          </Form>
        </section>
        <aside className="model-context panel" aria-labelledby="model-status-title">
          <h2 id="model-status-title">当前运行状态</h2>
          <strong className="model-live-mode">
            {analysisMode === 'model'
              ? '模型辅助'
              : analysisMode === 'local_rules'
                ? '本地规则'
                : '状态暂不可用'}
          </strong>
          <div className="model-scope">团队级设置 · 适用于全部业务</div>
          <ul className="model-uses">
            <li>
              <MessageOutlined aria-hidden />
              <span>问题分析</span>
            </li>
            <li>
              <BookOutlined aria-hidden />
              <span>经验草稿整理</span>
            </li>
          </ul>
          {applied && (
            <div className="model-applied" role="status">
              <span>预览已应用</span>
              <strong>{applied.mode === 'model' ? applied.model : '本地规则'}</strong>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
