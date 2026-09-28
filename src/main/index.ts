import { app, BrowserWindow, protocol, session } from 'electron'
import { readFile } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpc } from './ipc/index'
import { createWindow, markQuitting } from './window'
import { getSettings } from './services/settings'
import { killAllTerminals } from './services/terminal'
import { captureError } from './services/errors'
import { startScheduler, stopScheduler } from './services/scheduler'
import { disposeTray, refreshGlobalShortcut, refreshTray } from './services/tray'
import { seedExampleScripts } from './services/scripts'

const gotLock = app.requestSingleInstanceLock()

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.moc3': 'application/octet-stream',
  '.model3.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8'
}

const mimeFor = (file: string): string => MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'

// 自定义协议：让渲染进程可以安全地加载本机素材（立绘 / 背景 / Live2D 模型）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sigasset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true }
  }
])

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.muzirin.studyingal')

    // sigasset://local/<encodeURIComponent(绝对路径)> → 读取本机文件
    protocol.handle('sigasset', async (request) => {
      try {
        const url = new URL(request.url)
        const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
        const data = await readFile(filePath)
        return new Response(new Uint8Array(data), {
          headers: { 'Content-Type': mimeFor(filePath), 'Cache-Control': 'no-cache' }
        })
      } catch (error) {
        return new Response(`asset not found: ${(error as Error).message}`, { status: 404 })
      }
    })

    if (app.isPackaged) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: sigasset:; font-src 'self' data:; connect-src 'self' https: http: ws: wss: sigasset:; media-src 'self' data: blob: https: sigasset:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"
            ]
          }
        })
      })
    }

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerIpc()
    startScheduler()
    refreshTray()
    refreshGlobalShortcut()

    // 首次运行时写入内置示例剧本，方便直接体验 Galgame 播放器
    try {
      const seeded = seedExampleScripts(false)
      if (seeded.added > 0) console.info(`[StudyInGal] 已写入 ${seeded.added} 个内置示例剧本`)
    } catch (error) {
      console.warn('[StudyInGal] 写入示例剧本失败：', (error as Error).message)
    }

    const window = createWindow()
    if (getSettings().developer.openDevToolsOnStart) {
      window.webContents.openDevTools({ mode: 'detach' })
    }

    // 视觉回归 / 自动化截图：设置 SIG_CAPTURE_PATH 后启动，会截图并退出。
    const capturePath = process.env.SIG_CAPTURE_PATH
    if (capturePath) {
      window.webContents.once('did-finish-load', () => {
        const delay = Number(process.env.SIG_CAPTURE_DELAY ?? 3200)
        const route = process.env.SIG_CAPTURE_ROUTE
        const shoot = (): void => {
          setTimeout(() => {
            void window.webContents
              .capturePage()
              .then((image) => writeFile(capturePath, image.toPNG()))
              .catch((error: Error) => console.error('[StudyInGal] 截图失败', error.message))
              .finally(() => app.exit(0))
          }, delay)
        }
        if (route) {
          void window.webContents
            .executeJavaScript(`window.location.hash = ${JSON.stringify(`#${route}`)}`)
            .then(() => shoot())
            .catch(() => shoot())
        } else {
          shoot()
        }
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    const settings = getSettings()
    const stayInTray = settings.desktop.trayEnabled && settings.desktop.closeToTray
    if (!stayInTray && process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    markQuitting()
    killAllTerminals()
    stopScheduler()
    disposeTray()
  })
}

process.on('uncaughtException', (error) => {
  captureError({ message: error.message, stack: error.stack, context: 'main:uncaughtException' })
})

process.on('unhandledRejection', (reason) => {
  captureError({ message: String(reason), context: 'main:unhandledRejection' })
})
