/**
 * @description 挂载 React 应用并集中提供中文界面及主题，业务权限由后端会话控制。
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
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
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
