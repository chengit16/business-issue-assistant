/** @description 展示团队生效配置并装配编辑表单，秘密输入只留在编辑表单内。 */
import { Alert, Button, Spin } from 'antd'
import { BookOutlined, MessageOutlined } from '@ant-design/icons'
import { readModelSettings } from '../../api/services/modelSettings'
import { useQuery } from '../../hooks/useQuery'
import { ModelSettingsForm } from './ModelSettingsForm'
import './modelSettings.css'

interface ModelSettingsPageProps {
  /** 保存后刷新工作台页头的运行模式。 */
  onSaved: () => void
}

/** 模型配置用于全团队，配置和密钥状态以服务端读取结果为准。 */
export function ModelSettingsPage({ onSaved }: ModelSettingsPageProps) {
  const { data, isLoading, error, reload } = useQuery({
    key: 'team-model-settings',
    load: readModelSettings,
  })
  function handleSaved() {
    reload()
    onSaved()
  }
  return (
    <div className="model-settings">
      <div className="page-intro compact">
        <span className="eyebrow">团队管理</span>
        <h1>模型配置</h1>
        <p>管理团队用于问题分析和经验草稿整理的运行方式。</p>
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={reload}>重新加载</Button>}
        />
      )}
      {isLoading && <Spin description="正在读取模型配置" />}
      {data && (
        <div className="model-settings-grid">
          <ModelSettingsForm settings={data} onSaved={handleSaved} onReload={reload} />
          <aside className="model-context panel" aria-labelledby="model-status-title">
            <h2 id="model-status-title">当前运行状态</h2>
            <strong className="model-live-mode">
              {data.mode === 'model' ? '模型辅助' : '本地规则'}
            </strong>
            <div className="model-scope">团队级设置 · 适用于全部业务</div>
            {data.mode === 'model' && <p className="model-active-name">{data.model}</p>}
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
          </aside>
        </div>
      )}
    </div>
  )
}
