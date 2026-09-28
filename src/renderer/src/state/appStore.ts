import { create } from 'zustand'
import { api } from '../api'
import type { AppInfo, AppSettings } from '@shared/types'

export interface Toast {
  id: string
  severity: 'success' | 'info' | 'warning' | 'error'
  message: string
}

export interface AskContext {
  sourceId?: string
  title?: string
  selection?: string
}

export interface Crumb {
  label: string
  hint?: string
}

interface AppState {
  ready: boolean
  error: string | null
  info: AppInfo | null
  settings: AppSettings | null
  toasts: Toast[]
  askOpen: boolean
  askContext: AskContext
  crumb: Crumb | null
  bootstrap: () => Promise<void>
  patchSettings: (patch: Record<string, unknown>) => Promise<AppSettings | null>
  resetSettings: () => Promise<void>
  toast: (severity: Toast['severity'], message: string) => void
  dismissToast: (id: string) => void
  openAsk: (context?: AskContext) => void
  closeAsk: () => void
  setCrumb: (crumb: Crumb | null) => void
}

const newId = (): string => Math.random().toString(36).slice(2, 10)

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  info: null,
  settings: null,
  toasts: [],
  askOpen: false,
  askContext: {},
  crumb: null,

  bootstrap: async () => {
    try {
      const [info, settings] = await Promise.all([api.app.info(), api.settings.get()])
      set({ info, settings, ready: true, error: null })
    } catch (error) {
      set({ ready: true, error: (error as Error).message })
    }
  },

  patchSettings: async (patch) => {
    const current = get().settings
    const optimistic = current ? { ...current, ...(patch as Partial<AppSettings>) } : current
    set({ settings: optimistic })
    try {
      const settings = await api.settings.update(patch)
      set({ settings })
      return settings
    } catch (error) {
      set({ settings: current })
      get().toast('error', `设置保存失败：${(error as Error).message}`)
      return null
    }
  },

  resetSettings: async () => {
    const settings = await api.settings.reset()
    set({ settings })
    get().toast('success', '已恢复默认设置')
  },

  toast: (severity, message) => {
    const id = newId()
    set((state) => ({ toasts: [...state.toasts, { id, severity, message }] }))
    setTimeout(() => get().dismissToast(id), severity === 'error' ? 8000 : 4000)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  openAsk: (context) => set({ askOpen: true, askContext: context ?? {} }),
  closeAsk: () => set({ askOpen: false }),
  setCrumb: (crumb) => set({ crumb })
}))
