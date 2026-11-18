/** @description 从供应商目录选择模型，现有密钥只显示设置状态，新值默认遮蔽。 */
import { Alert, Button, Form, Input, Select, Tag } from 'antd'
import { ApiOutlined, ExperimentOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ModelLibrary, ModelProfile } from '../../api/services/modelSettings'
import { useModelSettingsForm } from './useModelSettingsForm'

interface ModelSettingsFormProps {
  /** 编辑时传入已有配置，新增时留空。 */
  profile?: ModelProfile
  /** 可复用 API 密钥的连接，只在接口地址相同时生效。 */
  credential?: ModelProfile
  /** 列表版本用于防止覆盖其他维护人的更新。 */
  version: number
  /** 保存后更新列表并结束编辑。 */
  onSaved: (library: ModelLibrary) => void
  /** 出现并发冲突时重新读取配置。 */
  onReload: () => void
}

/** 保存一套经过连接测试的配置，启用操作在列表完成。 */
export function ModelSettingsForm({
  profile,
  credential,
  version,
  onSaved,
  onReload,
}: ModelSettingsFormProps) {
  const state = useModelSettingsForm(profile, credential, version, onSaved)
  // 未拉取目录时仍展示已保存的模型，旧配置可以直接重测。
  const models = state.catalog ?? (state.model ? [state.model] : [])
  return (
    <Form
      form={state.form}
      layout="vertical"
      initialValues={{
        address: credential?.address ?? '',
        model: profile?.model,
      }}
      onValuesChange={state.changed}
      onFinish={state.test}
      disabled={state.pending !== null}
      requiredMark={false}
    >
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
        rules={[{ required: !state.canReuseKey, whitespace: true, message: '请输入 API 密钥' }]}
        className="mb-4"
      >
        <Input.Password
          placeholder={state.canReuseKey ? '输入新密钥进行替换' : '输入 API 密钥'}
          maxLength={4096}
          autoComplete="new-password"
        />
      </Form.Item>
      <div className="mb-4">
        <Form.Item
          name="model"
          label="选择模型"
          className="mb-2"
          rules={[{ required: true, message: '请选择模型' }]}
        >
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="获取列表后选择模型"
            options={models.map((id) => ({ value: id, label: id }))}
            loading={state.pending === 'catalog'}
            disabled={state.pending !== null || models.length === 0}
            notFoundContent="没有匹配的模型"
          />
        </Form.Item>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void state.loadCatalog()}
            loading={state.pending === 'catalog'}
            disabled={state.needsReload}
          >
            {state.catalog === null ? '获取模型列表' : '刷新模型列表'}
          </Button>
          <span aria-live="polite" className="muted">
            {state.catalog === null
              ? '使用上方的接口地址和密钥获取'
              : state.catalog.length === 0
                ? '供应商未返回可选模型，请检查密钥权限'
                : `已获取 ${state.catalog.length} 个模型`}
          </span>
        </div>
      </div>
      <div aria-live="polite" className="model-test-result">
        {state.isTested && <Alert type="success" showIcon title="连接测试通过，可以保存" />}
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
        <Button
          htmlType="submit"
          icon={<ExperimentOutlined />}
          loading={state.pending === 'test'}
          disabled={state.needsReload || !state.model}
        >
          测试连接
        </Button>
        <Button
          type="primary"
          disabled={state.needsReload || !state.isTested}
          loading={state.pending === 'save'}
          onClick={state.save}
        >
          保存配置
        </Button>
      </div>
    </Form>
  )
}
