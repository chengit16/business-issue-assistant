/** @description 展示工作台导航和可信身份，路由和退出行为由应用壳统一处理。 */
import { Avatar, Badge, Button } from 'antd'
import { ArrowRightOutlined, BookOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons'
import { NavLink } from 'react-router-dom'
import type { Business, User } from '../types'
import { roleLabels } from '../types'
import { navigation } from './navigation'

interface SidebarProps {
  /** 后台返回的当前账号。 */
  user: User
  /** 当前业务，跳转时保留该范围。 */
  business: Business
  /** 后台可见的待确认数量。 */
  pending: number
  /** 用户主动退出时调用，真实会话撤销由身份 Service 完成。 */
  onLogout: () => void
}

/** 导航保持业务参数，个人身份不持久化到浏览器存储。 */
export function Sidebar({ user, business, pending, onLogout }: SidebarProps) {
  const search = `?${new URLSearchParams({ business })}`
  return (
    <aside className="sidebar flex flex-col">
      <NavLink className="brand" to={`/assistant${search}`}>
        <span className="brand-mark">知</span>
        <span>
          业务问题助手<small>团队经验工作台</small>
        </span>
      </NavLink>
      <div className="workspace-label">
        <TeamOutlined /> 团队空间 <span>内部</span>
      </div>
      <nav aria-label="主导航">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={`${item.path}${search}`}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <Icon />
              <span>{item.title}</span>
              {item.path === '/review' && pending > 0 && <Badge count={pending} color="#176655" />}
            </NavLink>
          )
        })}
      </nav>
      <div className="sidebar-note">
        <span className="note-icon">
          <BookOutlined />
        </span>
        <strong>经验值得被留下</strong>
        <p>记录实际处理过程，让团队少走一次弯路。</p>
        <NavLink to={`/intake${search}`}>
          收录一条经验 <ArrowRightOutlined />
        </NavLink>
      </div>
      <div className="profile">
        <Avatar style={{ background: '#e6ece5', color: '#34604d' }}>{user.name.slice(0, 1)}</Avatar>
        <span>
          <strong>{user.name}</strong>
          <small>{roleLabels[user.role]}</small>
        </span>
        <Button type="text" aria-label="退出登录" icon={<LogoutOutlined />} onClick={onLogout} />
      </div>
    </aside>
  )
}
