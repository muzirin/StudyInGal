import { BrowserWindow, Menu, Tray, app, globalShortcut } from 'electron'
import { createAppIcon } from '../lib/icon'
import { emitEvent } from '../lib/events'
import { getSettings } from './settings'

let tray: Tray | null = null
let shortcutRegistered: string | null = null

export function showMainWindow(): void {
  const [window] = BrowserWindow.getAllWindows()
  if (!window) return
  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) window.show()
  window.focus()
}

function buildMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: '打开 StudyInGal', click: () => showMainWindow() },
    {
      label: '一键询问',
      click: () => {
        showMainWindow()
        emitEvent({ type: 'open-ask', payload: { reason: 'tray' } })
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
}

export function refreshTray(): void {
  const settings = getSettings()

  if (settings.desktop.trayEnabled && !tray) {
    try {
      tray = new Tray(createAppIcon(32))
      tray.setToolTip('StudyInGal · 学习 × Galgame')
      tray.setContextMenu(buildMenu())
      tray.on('double-click', () => showMainWindow())
    } catch (error) {
      console.warn('[StudyInGal] 托盘创建失败：', (error as Error).message)
      tray = null
    }
  } else if (!settings.desktop.trayEnabled && tray) {
    tray.destroy()
    tray = null
  }
}

export function refreshGlobalShortcut(): void {
  const accelerator = getSettings().desktop.globalAskShortcut
  
  if (shortcutRegistered && shortcutRegistered !== accelerator) {
    globalShortcut.unregister(shortcutRegistered)
    shortcutRegistered = null
  }
  if (!accelerator || shortcutRegistered === accelerator) return

  const ok = globalShortcut.register(accelerator, () => {
    showMainWindow()
    emitEvent({ type: 'open-ask', payload: { reason: 'shortcut' } })
  })
  if (ok) shortcutRegistered = accelerator
  else console.warn(`[StudyInGal] 全局快捷键注册失败：${accelerator}（可能已被占用）`)
}

export function disposeTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
  if (shortcutRegistered) {
    globalShortcut.unregister(shortcutRegistered)
    shortcutRegistered = null
  }
}
