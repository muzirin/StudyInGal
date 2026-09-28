import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installMobileBridge } from './platform/bridge'
import './styles/global.css'

// Electron 由 preload 注入 window.study；移动端（Capacitor/WebView）由这里安装桥。
installMobileBridge()

const container = document.getElementById('root')
if (!container) throw new Error('#root 容器缺失')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
