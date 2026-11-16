/** @description 渲染问题输入及截图选择，分析状态与写入流程由所属业务 Hook 维护。 */
import { useRef } from 'react'
import { Button, Input, Tag } from 'antd'
import { PaperClipOutlined, SendOutlined } from '@ant-design/icons'
import type { Business } from '../../types'
import type { AssistantController } from './useAssistant'

interface QuestionComposerProps {
  /** 账号当前允许选择的业务。 */
  business: Business
  /** 当前页面独占的表单与分析状态。 */
  controller: AssistantController
}

/** 保留粘贴图片与手动上传入口，不自行发起 HTTP 请求。 */
export function QuestionComposer({ business, controller }: QuestionComposerProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const { text, file, isBusy, updateText, updateFile, submit } = controller
  return (
    <section className="question-box">
      <div className="composer-label">
        <span className="small-brand">知</span>
        <strong>今天遇到了什么问题？</strong>
        <Tag variant="filled">{business}</Tag>
      </div>
      <Input.TextArea
        aria-label="问题描述"
        variant="borderless"
        value={text}
        onChange={(event) => updateText(event.target.value)}
        disabled={isBusy}
        maxLength={10000}
        autoSize={{ minRows: 5, maxRows: 12 }}
        onPaste={(event) => {
          const image = Array.from(event.clipboardData.files).find((item) =>
            item.type.startsWith('image/'),
          )
          if (image) {
            event.preventDefault()
            updateFile(image)
          }
        }}
        placeholder="描述发生了什么、涉及哪个业务、已经尝试过哪些操作……也可以直接粘贴群聊内容。"
      />
      {file && (
        <div className="attached-file">
          <PaperClipOutlined /> {file.name}
          <Button disabled={isBusy} type="text" size="small" onClick={() => updateFile(null)}>
            移除
          </Button>
        </div>
      )}
      <div className="composer-bottom">
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => updateFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="text"
            disabled={isBusy}
            icon={<PaperClipOutlined />}
            onClick={() => fileInput.current?.click()}
          >
            添加截图
          </Button>
          <span className="composer-hint">支持粘贴图片</span>
        </div>
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={isBusy}
          onClick={() => void submit()}
        >
          开始分析
        </Button>
      </div>
    </section>
  )
}
