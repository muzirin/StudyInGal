export interface StudyBridge {
  invoke(channel: string, payload?: unknown): Promise<unknown>
  on(listener: (event: unknown) => void): () => void
  pathForFile(file: File): string
  platform: string
  versions: { electron: string; chrome: string; node: string }
}

declare global {
  interface Window {
    study: StudyBridge
    electron: unknown
  }
}

export {}
