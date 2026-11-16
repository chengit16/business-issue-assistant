/** @description 收录和人工确认共用的事实字段，发布及验证状态由所属页面单独维护。 */
import { Form, Input } from 'antd'

import { draftFields } from './caseFields'

/** 渲染经验的业务字段，验证及发布状态由调用页面单独控制。 */
export function CaseFieldsForm() {
  return (
    <>
      {draftFields.map((field) => (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.label}
          rules={
            field.required
              ? [
                  {
                    required: true,
                    min: 2,
                    whitespace: true,
                    message: `请至少填写 2 个字的${field.label}`,
                  },
                ]
              : []
          }
        >
          {field.name === 'title' ? (
            <Input maxLength={160} placeholder={field.placeholder} />
          ) : (
            <Input.TextArea
              rows={field.name === 'symptom' ? 3 : 2}
              maxLength={10000}
              placeholder={field.placeholder}
            />
          )}
        </Form.Item>
      ))}
    </>
  )
}
