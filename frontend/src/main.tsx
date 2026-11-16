/** @description 挂载 React Router 和全局界面 Provider，兼容旧 Hash 深链并提供渲染恢复。 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { App } from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import 'virtual:uno.css'
import './styles.css'

// 既有书签使用 #assistant，统一为 Router 的 #/assistant 且不增加历史记录。
if (location.hash.length > 1 && !location.hash.startsWith('#/')) {
  history.replaceState(
    null,
    '',
    `${location.pathname}${location.search}#/${location.hash.slice(1)}`,
  )
}
const root = document.getElementById('root')
if (!root) throw new Error('应用挂载节点不存在')
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#176655',
          colorInfo: '#176655',
          colorInfoBg: '#eff5f1',
          colorInfoBorder: '#d4e4d9',
          borderRadius: 8,
          fontFamily: '"DM Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
          colorText: '#253b35',
          colorBorder: '#dce4df',
          controlHeight: 40,
        },
        components: { Alert: { fontSize: 12 }, Form: { labelFontSize: 12, labelColor: '#64745b' } },
      }}
    >
      <AntApp>
        <ErrorBoundary>
          <HashRouter>
            <App />
          </HashRouter>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
