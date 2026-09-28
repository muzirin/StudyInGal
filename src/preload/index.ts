import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ALL_CHANNELS, CHANNELS } from '@shared/channels'

const allowedChannels = new Set<string>(ALL_CHANNELS)

const bridge = {
  invoke(channel: string, payload?: unknown): Promise<unknown> {
    if (!allowedChannels.has(channel)) {
      return Promise.reject(new Error(`StudyInGal: 未授权的 IPC 通道 ${channel}`))
    }
    return ipcRenderer.invoke(channel, payload)
  },
  on(listener: (event: unknown) => void): () => void {
    const handler = (_event: IpcRendererEvent, payload: unknown): void => listener(payload)
    ipcRenderer.on(CHANNELS.event, handler)
    return () => {
      ipcRenderer.removeListener(CHANNELS.event, handler)
    }
  },
  pathForFile(file: File): string {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('study', bridge)
  contextBridge.exposeInMainWorld('electron', electronAPI)
} else {
  // @ts-expect-error fallback when context isolation is disabled
  window.study = bridge
  // @ts-expect-error fallback when context isolation is disabled
  window.electron = electronAPI
}

export type StudyBridge = typeof bridge
