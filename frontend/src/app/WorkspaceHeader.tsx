/** @description 显示当前路由与业务选择，角色和数据权限不由头部选项授予。 */
import { Button, Select } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import type { Business } from '../types'

interface WorkspaceHeaderProps {
  /** 当前路由标题。 */
  title: string
  /** 当前业务，来自合法 URL 参数或账号范围内的选择。 */
  business: Business
  /** 服务端账号允许的业务选项。 */
  businesses: Business[]
  /** 当前分析模式来自后台统计。 */
  modelEnabled: boolean
  /** 选择业务时清理旧筛选并切换请求范围。 */
  onBusiness: (value: Business) => void
  /** 移动端同样提供真实退出操作。 */
  onLogout: () => void
}

/** 页头通过回调改变业务范围，数据请求由页面用例重新加载。 */
export function WorkspaceHeader({
  title,
  business,
  businesses,
  modelEnabled,
  onBusiness,
  onLogout,
}: WorkspaceHeaderProps) {
  return (
    <header className="topbar flex items-center justify-between">
      <div>
        <span className="muted">团队空间</span>
        <span className="breadcrumb-slash">/</span>
        {title}
      </div>
      <div className="topbar-right">
        <span className="status-dot" />
        <span className="mode-label">{modelEnabled ? '模型辅助模式' : '本地规则模式'}</span>
        <Select
          aria-label="当前业务"
          value={business}
          onChange={onBusiness}
          options={businesses.map((value) => ({ value, label: value }))}
        />
        <Button
          className="mobile-logout"
          type="text"
          aria-label="退出登录"
          icon={<LogoutOutlined />}
          onClick={onLogout}
        />
      </div>
    </header>
  )
}
