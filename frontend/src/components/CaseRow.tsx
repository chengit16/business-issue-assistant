/** @description 展示可追溯案例的列表摘要，打开动作交给所属页面或工作台。 */
import { Tag } from 'antd'
import { ArrowRightOutlined, FileTextOutlined } from '@ant-design/icons'
import type { Case } from '../types'

interface CaseRowProps {
  /** 已由领域 Service 校验的案例安全投影。 */
  item: Case
  /** 用户点击时触发，调用方负责更新路由定位。 */
  onClick: () => void
}
/** 只展示案例事实和演示标记，真实可见权限由后台判断。 */
export function CaseRow({ item, onClick }: CaseRowProps) {
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
