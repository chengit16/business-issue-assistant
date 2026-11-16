/** @description 校正结构化预览后提交草稿，缺失字段保留空白，不将预览作为验证结论。 */
import { Alert, Button, Form, Tag } from 'antd'
import { CaseFieldsForm } from '../../components/CaseFieldsForm'
import type { DraftFields } from '../../types'
import type { IntakeController } from './useIntake'

interface DraftPreviewFormProps {
  /** 收录控制器，保存失败时保持当前表单。 */
  controller: IntakeController
}

/** 预览就绪后才挂载表单，避免使用未连接的 Form 实例回填。 */
export function DraftPreviewForm({ controller }: DraftPreviewFormProps) {
  const value = controller.preview
  const initial: DraftFields | undefined = value
    ? {
        title: value.title,
        symptom: value.symptom,
        conditions: value.conditions ?? '',
        investigation: value.investigation ?? '',
        cause: value.cause ?? '',
        solution: value.solution ?? '',
        verification: value.verification ?? '',
      }
    : undefined
  return (
    <section className="panel draft-panel">
      <div className="section-heading">
        <h2>经验草稿</h2>
        <Tag>待人工确认</Tag>
      </div>
      {!value ? (
        <div className="draft-placeholder">
          <span className="placeholder-symbol">知</span>
          <h3>从一段对话，整理出一条经验</h3>
          <p>
            添加原始材料后，在这里补充适用条件、
            <br />
            处理步骤和实际验证结果。
          </p>
        </div>
      ) : (
        <>
          <Alert
            type="info"
            title={
              value.mode === 'local_rules'
                ? '本地规则仅提取标题和原文，请校正并补充其余字段。'
                : '模型整理结果需要人工校正，请核对原文和处理结果。'
            }
            showIcon
          />
          {!!value.similar.length && (
            <div className="similar-notice">
              <strong>发现 {value.similar.length} 条相似经验</strong>
              {value.similar.map((item) => (
                <p key={item.id}>{item.title}</p>
              ))}
              <small>发布前请核对是否需要合并已有经验。</small>
            </div>
          )}
          <Form<DraftFields>
            initialValues={initial}
            layout="vertical"
            onFinish={(values) => void controller.save(values)}
            requiredMark={false}
            disabled={controller.isBusy}
            onValuesChange={controller.changed}
          >
            <CaseFieldsForm />
            <p className="muted">新增经验提交后保持待验证，由处理人核对验证结果。</p>
            <Button type="primary" htmlType="submit" loading={controller.isBusy}>
              提交人工确认
            </Button>
          </Form>
        </>
      )}
    </section>
  )
}
