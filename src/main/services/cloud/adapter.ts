import type { CloudEntry, CloudMount } from '@shared/types'

export interface CloudAdapter {
  readonly mount: CloudMount
  test(): Promise<{ ok: boolean; message: string }>
  list(remotePath: string): Promise<CloudEntry[]>
  upload(localPath: string, remotePath: string): Promise<void>
  download(remotePath: string, localPath: string): Promise<void>
  ensureDir(remotePath: string): Promise<void>
  exists(remotePath: string): Promise<boolean>
}

export const readConfig = <T>(mount: CloudMount): T => mount.config as T

export function joinRemote(...parts: string[]): string {
  const cleaned = parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => String(part).replace(/\\/g, '/'))
  if (cleaned.length === 0) return '/'
  const [first, ...rest] = cleaned
  const head = first.startsWith('/') ? first.replace(/\/+$/, '') : `/${first.replace(/^\/+|\/+$/g, '')}`
  const tail = rest.map((part) => part.replace(/^\/+|\/+$/g, '')).filter(Boolean)
  return [head || '/', ...tail].join('/').replace(/\/{2,}/g, '/')
}
