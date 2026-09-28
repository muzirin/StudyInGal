import { app, BrowserWindow, session } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerIpc } from './ipc/index'
import { createWindow } from './window'
import { getSettings } from './services/settings'
import { killAllTerminals } from './services/terminal'
import { captureError } from './services/errors'

const gotLock = app.requestSingleInstanceLock()
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

    if (app.isPackaged) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: http: ws: wss:; media-src 'self' data: blob: https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'"
            ]
          }
        })
      })
    }

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerIpc()

    const window = createWindow()
    if (getSettings().developer.openDevToolsOnStart) {
      window.webContents.openDevTools({ mode: 'detach' })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    killAllTerminals()
  })
}

process.on('uncaughtException', (error) => {
  captureError({ message: error.message, stack: error.stack, context: 'main:uncaughtException' })
})

process.on('unhandledRejection', (reason) => {
  captureError({ message: String(reason), context: 'main:unhandledRejection' })
})
