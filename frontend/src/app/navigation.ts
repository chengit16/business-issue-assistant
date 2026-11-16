/** @description 维护工作台稳定导航，界面入口不承担服务端授权。 */
import {
  BookOutlined,
  CheckSquareOutlined,
  HistoryOutlined,
  MessageOutlined,
  PlusOutlined,
} from '@ant-design/icons'

/** 工作台支持的稳定路由路径。 */
export type PagePath = '/assistant' | '/cases' | '/intake' | '/records' | '/review'
interface NavigationItem {
  path: PagePath
  title: string
  icon: typeof MessageOutlined
}
/** 路由名称与导航图标的唯一配置，权限始终由后台核对。 */
export const navigation: NavigationItem[] = [
  { path: '/assistant', title: '问题助手', icon: MessageOutlined },
  { path: '/cases', title: '团队案例库', icon: BookOutlined },
  { path: '/intake', title: '收录经验', icon: PlusOutlined },
  { path: '/records', title: '我的提问', icon: HistoryOutlined },
  { path: '/review', title: '待确认', icon: CheckSquareOutlined },
]
