import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import SMB2 from '@marsaud/smb2'
import type { CloudEntry, CloudMount } from '@shared/types'
import { joinRemote, readConfig, type CloudAdapter } from './adapter'

interface SmbConfig {
  share: string
  domain: string
  username: string
  password: string
  basePath: string
}

export class SmbAdapter implements CloudAdapter {
  private readonly basePath: string
  private client: SMB2 | null = null

  constructor(public readonly mount: CloudMount) {
    this.basePath = readConfig<SmbConfig>(mount).basePath ?? ''
  }

  private connection(): SMB2 {
    if (!this.client) {
      const config = readConfig<SmbConfig>(this.mount)
      if (!config.share) throw new Error('SMB 配置缺少共享路径，例如 \\\\server\\share')
      this.client = new SMB2({
        share: config.share,
        domain: config.domain || undefined,
        username: config.username || undefined,
        password: config.password || undefined
      })
    }
    return this.client
  }

  private remote(remotePath: string): string {
    return joinRemote(this.basePath, remotePath).replace(/\//g, '\\')
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    try {
      const ok = await this.connection().exists(this.remote('/'))
      return { ok, message: ok ? '连接成功' : '共享存在但根路径不可访问' }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  async list(remotePath: string): Promise<CloudEntry[]> {
    const base = this.remote(remotePath)
    const names = await this.connection().readdir(base)
    const entries: CloudEntry[] = []
    for (const name of names) {
      const full = `${base.replace(/\\+$/, '')}\\${name}`
      try {
        const info = await this.connection().stat(full)
        entries.push({
          name,
          path: joinRemote(remotePath, name),
          isDirectory: info.isDirectory(),
          sizeBytes: info.size ?? 0,
          modifiedAt: info.mtime ? new Date(info.mtime).getTime() : null
        })
      } catch {
        entries.push({ name, path: joinRemote(remotePath, name), isDirectory: false, sizeBytes: 0, modifiedAt: null })
      }
    }
    return entries
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const remote = this.remote(remotePath)
    await this.connection()
      .mkdir(dirname(remote))
      .catch(() => undefined)
    await this.connection().writeFile(remote, await readFile(localPath))
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const buffer = await this.connection().readFile(this.remote(remotePath))
    await mkdir(dirname(localPath), { recursive: true })
    await writeFile(localPath, buffer)
  }

  async ensureDir(remotePath: string): Promise<void> {
    await this.connection()
      .mkdir(this.remote(remotePath))
      .catch(() => undefined)
  }

  async exists(remotePath: string): Promise<boolean> {
    return this.connection().exists(this.remote(remotePath))
  }
}
