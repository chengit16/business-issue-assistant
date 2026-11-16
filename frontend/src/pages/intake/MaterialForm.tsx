/** @description 维护原始材料输入界面，材料保存后保持只读，上传校验以后台为最终依据。 */
import { App, Button, Input, Tag, Upload } from 'antd'
import { ArrowRightOutlined, PaperClipOutlined } from '@ant-design/icons'
import type { Business } from '../../types'
import type { IntakeController } from './useIntake'

interface MaterialFormProps {
  /** 当前账号允许访问的业务。 */
  business: Business
  /** 收录页面独占的状态和动作。 */
  controller: IntakeController
}

/** 在上传前提示大小与格式错误，不将客户端校验当作实际文件安全检查。 */
export function MaterialForm({ business, controller }: MaterialFormProps) {
  const { message } = App.useApp()
  const { text, file, source, isBusy, updateText, updateFile, prepare } = controller
  return (
    <section className="panel source-panel">
      <div className="section-heading">
        <h2>原始材料</h2>
        <Tag>{business}</Tag>
      </div>
      <p className="muted">保留问题、排查对话和最终处理结果。</p>
      <Input.TextArea
        aria-label="原始聊天材料"
        value={text}
        disabled={!!source || isBusy}
        onChange={(event) => updateText(event.target.value)}
        rows={14}
        maxLength={20000}
        placeholder="在这里粘贴群聊或处理记录，附上截图背景说明……"
      />
      {!source && (
        <Upload
          accept="image/png,image/jpeg,image/webp"
          maxCount={1}
          fileList={file ? [{ uid: 'attachment', name: file.name, status: 'done' }] : []}
          beforeUpload={(value) => {
            if (
              !['image/png', 'image/jpeg', 'image/webp'].includes(value.type) ||
              value.size > 5 * 1024 * 1024
            ) {
              void message.warning('请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片')
              return Upload.LIST_IGNORE
            }
            updateFile(value)
            return false
          }}
          onRemove={() => updateFile(null)}
        >
          <Button disabled={isBusy} icon={<PaperClipOutlined />}>
            添加截图
          </Button>
        </Upload>
      )}
      {source ? (
        <div className="source-status">
          <Tag color="green">原始材料已保存</Tag>
          <p className="muted">材料编号 {source.id}</p>
          <p className="muted">如需补充原文，可重新进入收录页面创建新材料。</p>
        </div>
      ) : (
        <Button type="primary" onClick={() => void prepare()} loading={isBusy} block>
          整理草稿 <ArrowRightOutlined />
        </Button>
      )}
    </section>
  )
}
