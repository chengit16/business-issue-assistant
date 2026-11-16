/** @description 问题助手页面组合输入、历史经验及分析，服务端数据由业务 Hook 维护。 */
import { Alert, Button } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useWorkspaceStore } from '../../store/workspace'
import type { Business } from '../../types'
import { AnalysisResult } from './AnalysisResult'
import { AssistantGuide } from './AssistantGuide'
import { QuestionComposer } from './QuestionComposer'
import { RecentCases } from './RecentCases'
import { useAssistant } from './useAssistant'

interface AssistantPageProps {
  /** 当前已验证属于账号范围的业务。 */
  business: Business
  /** 打开案例深链，由工作台维护定位。 */
  openCase: (id: string) => void
}

/** 跨页面复用是明确的新问题意图，nonce 改变时丢弃旧分析表单。 */
export function AssistantPage(props: AssistantPageProps) {
  const selection = useWorkspaceStore((state) => state.reuse)
  const reuse = selection?.business === props.business ? selection : null
  return <AssistantContent key={reuse?.nonce ?? 'new'} {...props} initialText={reuse?.text ?? ''} />
}
function AssistantContent({
  business,
  openCase,
  initialText,
}: AssistantPageProps & { initialText: string }) {
  const controller = useAssistant(business, initialText)
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">把团队经验，带到每一次排查中</div>
        <h1>
          遇到业务问题，
          <br className="mobile-break" />
          先查团队经验<span className="title-dot">。</span>
        </h1>
        <p>描述问题，查找相关案例，让下一步处理更有依据。</p>
      </div>
      <div className="assistant-grid">
        <div className="assistant-main">
          <QuestionComposer business={business} controller={controller} />
          <p className="input-note">
            截图作为原始材料保存。当前模式请在描述中补充截图里的关键文字。
          </p>
          {controller.error && (
            <Alert
              type="error"
              title={controller.error}
              showIcon
              action={<Button onClick={() => void controller.submit()}>重试</Button>}
            />
          )}
          {!controller.result && (
            <div className="prompt-examples">
              <span>可以这样问</span>
              {[
                '客户已扣款，订单仍显示待支付',
                '优惠券满足门槛，但结算时无法使用',
                '后台登录后提示没有操作权限',
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => controller.updateText(item)}
                  disabled={controller.isBusy}
                >
                  {item}
                  <ArrowRightOutlined />
                </button>
              ))}
            </div>
          )}
          {controller.result && (
            <AnalysisResult
              value={controller.result}
              openCase={openCase}
              onFeedback={controller.refreshResult}
            />
          )}
          <RecentCases business={business} openCase={openCase} />
        </div>
        <AssistantGuide business={business} />
      </div>
    </>
  )
}
