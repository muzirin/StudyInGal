import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import type { CloudEntry, CloudMount } from '@shared/types'
import { readConfig, type CloudAdapter } from './adapter'

interface LocalConfig {
  root: string
}

export class LocalAdapter implements CloudAdapter {
  private readonly root: string

  constructor(public readonly mount: CloudMount) {
    this.root = readConfig<LocalConfig>(mount).root ?? ''
  }

  private resolve(remotePath: string): string {
    const rel = remotePath.replace(/^[/\\]+/, '')
    return rel ? join(this.root, rel) : this.root
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    try {
      const info = await stat(this.root)
      return { ok: info.isDirectory(), message: info.isDirectory() ? this.root : '不是目录' }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  async list(remotePath: string): Promise<CloudEntry[]> {
    const target = this.resolve(remotePath)
    const entries = await readdir(target, { withFileTypes: true })
    const result: CloudEntry[] = []
    for (const entry of entries) {
      const info = await stat(join(target, entry.name))
      result.push({
        name: entry.name,
        path: join(remotePath, entry.name).replace(/\\/g, '/'),
        isDirectory: entry.isDirectory(),
        sizeBytes: info.size,
        modifiedAt: info.mtimeMs
      })
    }
    return result
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const target = this.resolve(remotePath)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(localPath, target)
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    await mkdir(dirname(localPath), { recursive: true })
    await copyFile(this.resolve(remotePath), localPath)
  }

  async ensureDir(remotePath: string): Promise<void> {
    await mkdir(this.resolve(remotePath), { recursive: true })
  }

  async exists(remotePath: string): Promise<boolean> {
    try {
      await stat(this.resolve(remotePath))
      return true
    } catch {
      return false
    }
  }

  relativeOf(absolute: string): string {
    return relative(this.root, absolute).replace(/\\/g, '/')
  }
}
