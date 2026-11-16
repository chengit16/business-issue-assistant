/** @description 收录页面组合原始材料和可校正草稿，工作流与错误恢复由业务 Hook 维护。 */
import { Alert, Steps } from 'antd'
import type { Business } from '../../types'
import { DraftPreviewForm } from './DraftPreviewForm'
import { MaterialForm } from './MaterialForm'
import { useIntake } from './useIntake'

interface IntakePageProps {
  /** 当前可信账号允许访问的业务。 */
  business: Business
  /** 待确认草稿成功提交后定位新案例。 */
  onSaved: (id: string) => void
}

/** 三阶段展示真实保存进度，未经人工确认不赋予有效方案状态。 */
export function IntakePage({ business, onSaved }: IntakePageProps) {
  const controller = useIntake(business, onSaved)
  return (
    <>
      <div className="page-intro compact">
        <span className="eyebrow">为下一次解决留下线索</span>
        <h1>
          把这次解决经验留下来<span className="title-dot">。</span>
        </h1>
        <p>粘贴问题和处理过程，整理并确认后，供团队查找。</p>
      </div>
      <Steps
        className="intake-steps"
        current={controller.source ? 1 : 0}
        items={[{ title: '添加原始材料' }, { title: '整理经验草稿' }, { title: '人工确认发布' }]}
      />
      {controller.error && <Alert type="error" title={controller.error} showIcon />}
      <div className="intake-grid">
        <MaterialForm business={business} controller={controller} />
        <DraftPreviewForm controller={controller} />
      </div>
    </>
  )
}
