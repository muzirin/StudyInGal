import { join } from 'node:path'
import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'

interface WindowStateFile {
  width: number
  height: number
  x: number | null
  y: number | null
  maximized: boolean
}

const DEFAULT_STATE: WindowStateFile = { width: 1480, height: 920, x: null, y: null, maximized: false }

const store = new JsonStore<WindowStateFile>(join(dataDir(), 'window.json'), DEFAULT_STATE)

export function loadWindowState(): WindowStateFile & { bounds: Partial<Rectangle> } {
  const saved = store.read()
  const result: WindowStateFile = { ...DEFAULT_STATE, ...saved }

  // 若上次的坐标已经不在任何显示器内（换显示器 / 拔掉外接屏），则回退为居中
  if (result.x !== null && result.y !== null) {
    const visible = screen.getAllDisplays().some((display) => {
      const { x, y, width, height } = display.workArea
      return result.x! >= x - 40 && result.y! >= y - 40 && result.x! < x + width - 80 && result.y! < y + height - 80
    })
    if (!visible) {
      result.x = null
      result.y = null
    }
  }

  return {
    ...result,
    bounds: {
      width: Math.max(940, result.width),
      height: Math.max(640, result.height),
      ...(result.x !== null && result.y !== null ? { x: result.x, y: result.y } : {})
    }
  }
}

export function attachWindowStatePersistence(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null

  const save = (): void => {
    if (window.isDestroyed()) return
    const maximized = window.isMaximized()
    const bounds = window.getNormalBounds()
    store.write({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized
    })
  }

  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 600)
    timer.unref?.()
  }

  window.on('resize', schedule)
  window.on('move', schedule)
  window.on('maximize', schedule)
  window.on('unmaximize', schedule)
  window.on('close', save)

  if (store.read().maximized) window.maximize()
}
