import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { emitEvent } from './lib/events'

const isMac = process.platform === 'darwin'

export function broadcastWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return
  emitEvent({
    type: 'window-state',
    payload: {
      maximized: window.isMaximized(),
      fullscreen: window.isFullScreen(),
      focused: window.isFocused()
    }
  })
}

export function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 940,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FFF5F9',
    title: 'StudyInGal',
    roundedCorners: true,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 18 } }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  const notify = (): void => broadcastWindowState(window)
  window.on('maximize', notify)
  window.on('unmaximize', notify)
  window.on('enter-full-screen', notify)
  window.on('leave-full-screen', notify)
  window.on('focus', notify)
  window.on('blur', notify)
  window.on('restore', notify)
  window.on('resize', notify)

  window.on('ready-to-show', () => {
    window.show()
    broadcastWindowState(window)
  })

  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const isDevServer =
      is.dev && process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL'])
    if (!isDevServer && !url.startsWith('file://')) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
