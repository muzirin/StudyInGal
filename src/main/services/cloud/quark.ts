import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, basename } from 'node:path'
import type { CloudEntry, CloudMount } from '@shared/types'
import { joinRemote, readConfig, type CloudAdapter } from './adapter'

/**
 * 夸克网盘（实验性）适配器。
 *
 * 夸克没有面向第三方的公开开放平台，这里使用其 PC 网页端接口（需用户提供登录 Cookie）。
 * 由于接口为逆向实现，可能随官方改版失效；上传目前未实现，请使用 WebDAV/SMB 作为同步后端。
 * 相关讨论见仓库 docs/cloud-quark.md。
 */
interface QuarkConfig {
  cookie: string
  rootFid: string
  baseUrl: string
}

interface QuarkFile {
  fid: string
  file_name: string
  dir: boolean
  size: number
  updated_at: number
}

export class QuarkAdapter implements CloudAdapter {
  private readonly cookie: string
  private readonly rootFid: string
  private readonly baseUrl: string
  private fidCache = new Map<string, string>()

  constructor(public readonly mount: CloudMount) {
    const config = readConfig<QuarkConfig>(mount)
    this.cookie = config.cookie ?? ''
    this.rootFid = config.rootFid || '0'
    this.baseUrl = (config.baseUrl || 'https://drive-pc.quark.cn').replace(/\/+$/, '')
  }

  private headers(): Record<string, string> {
    if (!this.cookie) throw new Error('夸克网盘需要配置登录 Cookie')
    return {
      Cookie: this.cookie,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Referer: 'https://pan.quark.cn/',
      Accept: 'application/json, text/plain, */*'
    }
  }

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers: { ...this.headers(), ...(init?.headers ?? {}) } })
    if (!response.ok) throw new Error(`夸克接口 ${response.status}: ${await response.text().catch(() => '')}`)
    const json = (await response.json()) as { status: number; message?: string; data: T }
    if (json.status !== 0 && json.status !== 200) throw new Error(`夸克接口错误：${json.message ?? json.status}`)
    return json.data
  }

  private async resolveFid(remotePath: string): Promise<string> {
    const normalized = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!normalized) return this.rootFid
    if (this.fidCache.has(normalized)) return this.fidCache.get(normalized) as string
    let fid = this.rootFid
    for (const segment of normalized.split('/').filter(Boolean)) {
      const children = await this.listRaw(fid)
      const match = children.find((item) => item.file_name === segment && item.dir)
      if (!match) throw new Error(`夸克路径不存在：${remotePath}`)
      fid = match.fid
    }
    this.fidCache.set(normalized, fid)
    return fid
  }

  private async listRaw(fid: string): Promise<QuarkFile[]> {
    const data = await this.api<{ list: QuarkFile[] }>(
      `/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=${encodeURIComponent(fid)}&_page=1&_size=200&_sort=file_type:asc,file_name:asc`
    )
    return data.list ?? []
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.listRaw(this.rootFid)
      return { ok: true, message: '夸克网盘连接成功（实验性）' }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  async list(remotePath: string): Promise<CloudEntry[]> {
    const fid = await this.resolveFid(remotePath)
    const children = await this.listRaw(fid)
    return children.map((item) => ({
      name: item.file_name,
      path: joinRemote(remotePath, item.file_name),
      isDirectory: item.dir,
      sizeBytes: item.size ?? 0,
      modifiedAt: item.updated_at ? item.updated_at * 1000 : null
    }))
  }

  async ensureDir(remotePath: string): Promise<void> {
    const normalized = remotePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!normalized) return
    let fid = this.rootFid
    const walked: string[] = []
    for (const segment of normalized.split('/').filter(Boolean)) {
      walked.push(segment)
      const children = await this.listRaw(fid)
      const match = children.find((item) => item.file_name === segment && item.dir)
      if (match) {
        fid = match.fid
        continue
      }
      const created = await this.api<{ fid: string }>(`/1/clouddrive/file?pr=ucpro&fr=pc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdir_fid: fid, file_name: segment, dir_path: '', dir: true })
      })
      fid = created.fid
      this.fidCache.set(walked.join('/'), fid)
    }
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const fid = await this.resolveFid(remotePath)
    const data = await this.api<Array<{ download_url: string }>>(
      `/1/clouddrive/file/download?pr=ucpro&fr=pc&fid=${encodeURIComponent(fid)}`
    )
    const url = data?.[0]?.download_url
    if (!url) throw new Error('夸克未返回下载地址')
    const response = await fetch(url, { headers: { Cookie: this.cookie, Referer: 'https://pan.quark.cn/' } })
    if (!response.ok) throw new Error(`下载失败：${response.status}`)
    await mkdir(dirname(localPath), { recursive: true })
    await writeFile(localPath, Buffer.from(await response.arrayBuffer()))
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const remoteDir = dirname(remotePath.replace(/\\/g, '/'))
    await this.ensureDir(remoteDir)
    const size = (await readFile(localPath)).byteLength
    throw new Error(
      `夸克上传尚未实现（实验性）。文件 ${basename(localPath)}（${size} bytes）请改用 WebDAV/SMB 同步后端。`
    )
  }

  async exists(remotePath: string): Promise<boolean> {
    try {
      await this.resolveFid(remotePath)
      return true
    } catch {
      return false
    }
  }
}
