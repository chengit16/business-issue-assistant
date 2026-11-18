/** @description 维护团队模型连接表单。现有密钥只显示设置状态，新值默认遮蔽。 */
import { Alert, Button, Form, Input, Radio, Tag } from 'antd'
import { ApiOutlined, ExperimentOutlined } from '@ant-design/icons'
import type { ModelSettings } from '../../api/services/modelSettings'
import { useModelSettingsForm } from './useModelSettingsForm'

interface ModelSettingsFormProps {
  /** 初始值来自后台，包含配置版本及是否已存密钥。 */
  settings: ModelSettings
  /** 发布成功后重新加载生效状态。 */
  onSaved: () => void
  /** 发现并发修改后重新读取服务端配置。 */
  onReload: () => void
}

/** 连接测试和团队发布分两步。切换到本地规则无需提供连接凭证。 */
export function ModelSettingsForm({ settings, onSaved, onReload }: ModelSettingsFormProps) {
  const state = useModelSettingsForm(settings, onSaved)
  const isModel = state.mode === 'model'
  return (
    <section className="panel min-w-0" aria-labelledby="model-connection-title">
      <h2 id="model-connection-title">运行方式与连接</h2>
      <Form
        form={state.form}
        layout="vertical"
        initialValues={{
          mode: settings.version === 0 && !settings.address ? 'model' : settings.mode,
          address: settings.address,
          model: settings.model,
        }}
        onValuesChange={state.changed}
        onFinish={isModel ? state.test : state.save}
        disabled={state.pending !== null}
        requiredMark={false}
      >
        <Form.Item name="mode" label="运行方式" className="mb-4">
          <Radio.Group aria-label="运行方式">
            <Radio.Button value="model">模型辅助</Radio.Button>
            <Radio.Button value="local_rules">本地规则</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {isModel ? (
          <>
            <p className="model-protocol">
              <ApiOutlined aria-hidden /> OpenAI 兼容（Chat Completions）
            </p>
            <Form.Item
              name="address"
              label="接口地址"
              extra="填写 HTTPS 基础地址，例如以 /v1 结尾的地址。"
              className="mb-4"
              rules={[
                { required: true, whitespace: true, message: '请输入接口地址' },
                { type: 'url', message: '请输入有效的接口地址' },
              ]}
            >
              <Input placeholder="https://model.example/v1" maxLength={2048} autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="model"
              label="模型名称"
              className="mb-4"
              rules={[{ required: true, whitespace: true, message: '请输入模型名称' }]}
            >
              <Input placeholder="填写供应商提供的模型名称" maxLength={200} autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="apiKey"
              label={
                <span>
                  API 密钥{' '}
                  {state.canReuseKey && (
                    <Tag className="ml-2" color="success">
                      已配置
                    </Tag>
                  )}
                </span>
              }
              extra={
                state.canReuseKey
                  ? '留空会继续使用原密钥。填写新密钥可替换。'
                  : '填入该模型服务的 API 密钥。'
              }
              rules={[
                { required: !state.canReuseKey, whitespace: true, message: '请输入 API 密钥' },
              ]}
              className="mb-4"
            >
              <Input.Password
                placeholder={state.canReuseKey ? '输入新密钥进行替换' : '输入 API 密钥'}
                maxLength={4096}
                autoComplete="new-password"
              />
            </Form.Item>
          </>
        ) : (
          <Alert type="info" showIcon title="使用案例库检索和本地整理规则。" />
        )}
        <div aria-live="polite" className="model-test-result">
          {state.isTested && isModel && (
            <Alert type="success" showIcon title="连接测试通过，可以保存并启用" />
          )}
          {state.error && (
            <Alert
              type="error"
              showIcon
              title={state.error}
              action={state.needsReload && <Button onClick={onReload}>重新加载</Button>}
            />
          )}
        </div>
        <div className="model-actions">
          {isModel && (
            <Button
              htmlType="submit"
              icon={<ExperimentOutlined />}
              loading={state.pending === 'test'}
              disabled={state.needsReload}
            >
              测试连接
            </Button>
          )}
          <Button
            type="primary"
            disabled={state.needsReload || (isModel && !state.isTested)}
            loading={state.pending === 'save'}
            onClick={state.save}
          >
            保存并启用
          </Button>
        </div>
      </Form>
    </section>
  )
}
