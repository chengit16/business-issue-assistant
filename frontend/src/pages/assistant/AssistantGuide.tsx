/** @description 展示问题背景填写提示，案例执行前仍需人工核对适用条件。 */
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { Business } from '../../types'

/** 侧栏仅提供填写指引及收录入口，不产生业务写入。 */
export function AssistantGuide({
  business,
}: {
  /** 当前合法业务范围，导航时保留。 */
  business: Business
}) {
  return (
    <aside className="assistant-aside">
      <div className="guide-card">
        <div className="guide-symbol">
          <SearchOutlined />
        </div>
        <h2>让问题更容易被解决</h2>
        <p>多一点背景，少一点来回确认。</p>
        <div className="guide-item">
          <span>发生了什么</span>
          <small>问题现象、报错与发生时间</small>
        </div>
        <div className="guide-item">
          <span>在哪里发生</span>
          <small>所属系统、渠道与具体版本</small>
        </div>
        <div className="guide-item">
          <span>已经做过什么</span>
          <small>尝试的操作与观察到的结果</small>
        </div>
        <div className="guide-tip">
          <CheckCircleOutlined />
          <span>
            每条历史经验都有适用条件，
            <br />
            执行前请先核对。
          </span>
        </div>
      </div>
      <Link className="intake-link" to={`/intake?${new URLSearchParams({ business })}`}>
        <span className="intake-icon">
          <PlusOutlined />
        </span>
        <span>
          <strong>把这次解决经验留下来</strong>
          <small>整理成案例，供团队下次查找</small>
        </span>
        <ArrowRightOutlined />
      </Link>
    </aside>
  )
}
