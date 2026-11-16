/** @description 定义收录与确认共用的事实字段，排除服务端维护的发布状态和身份。 */
import type { DraftFields } from '../types'

/** 可编辑字段配置，不包含服务端身份、版本及验证状态。 */
export const draftFields: {
  name: keyof DraftFields
  label: string
  placeholder: string
  required?: boolean
}[] = [
  {
    name: 'title',
    label: '案例标题',
    placeholder: '用一句话概括问题',
    required: true,
  },
  {
    name: 'symptom',
    label: '问题现象',
    placeholder: '当时发生了什么？有哪些报错或异常表现？',
    required: true,
  },
  {
    name: 'conditions',
    label: '适用条件',
    placeholder: '涉及的系统、业务渠道、版本与时间范围',
  },
  {
    name: 'investigation',
    label: '排查过程',
    placeholder: '尝试过哪些操作，分别观察到什么结果？',
  },
  {
    name: 'cause',
    label: '原因说明',
    placeholder: '尚未确认时请留空，区分事实与推测',
  },
  {
    name: 'solution',
    label: '处理步骤',
    placeholder: '实际执行的操作、所需角色与前置条件',
  },
  {
    name: 'verification',
    label: '验证记录',
    placeholder: '谁在什么条件下进行了哪些操作，实际结果如何？',
  },
]
