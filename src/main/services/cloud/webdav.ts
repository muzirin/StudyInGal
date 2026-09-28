import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { CloudEntry, CloudMount } from '@shared/types'
import { joinRemote, readConfig, type CloudAdapter } from './adapter'

interface WebdavConfig {
  url: string
  username: string
  password: string
  basePath: string
}

interface DavEntry {
  href: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: number | null
}

const decode = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const tag = (xml: string, name: string): string | null => {
  const match = xml.match(new RegExp(`<(?:[\\w-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'i'))
  return match ? match[1].trim() : null
}

/**
 * 使用原生 fetch 实现的 WebDAV 适配器。
 * 不依赖 ESM-only 的三方库，便于在 CommonJS 主进程中稳定打包与运行。
 */
export class WebdavAdapter implements CloudAdapter {
  private readonly config: WebdavConfig

  constructor(public readonly mount: CloudMount) {
    this.config = readConfig<WebdavConfig>(mount)
  }

  private remote(remotePath: string): string {
    const base = (this.config.url ?? '').replace(/\/+$/, '')
    const joined = joinRemote(this.config.basePath ?? '', remotePath)
    return `${base}${joined}`
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra }
    if (this.config.username) {
      const token = Buffer.from(`${this.config.username}:${this.config.password ?? ''}`).toString('base64')
      headers.Authorization = `Basic ${token}`
    }
    return headers
  }

  private parseMultiStatus(xml: string, requestPath: string): DavEntry[] {
    const responses = xml.match(/<(?:[\w-]+:)?response[\s>][\s\S]*?<\/(?:[\w-]+:)?response>/gi) ?? []
    const entries: DavEntry[] = []
    for (const block of responses) {
      const rawHref = tag(block, 'href')
      if (!rawHref) continue
      const href = decode(rawHref)
      const trimmed = href.replace(/\/+$/, '')
      if (trimmed === requestPath.replace(/\/+$/, '') || trimmed === '' || trimmed === '/') continue
      const isDirectory = /<(?:[\w-]+:)?collection/i.test(block)
      const size = Number(tag(block, 'getcontentlength') ?? '0')
      const modified = tag(block, 'getlastmodified')
      entries.push({
        href,
        isDirectory,
        sizeBytes: Number.isFinite(size) ? size : 0,
        modifiedAt: modified ? Date.parse(modified) || null : null
      })
    }
    return entries
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.url) return { ok: false, message: '缺少 WebDAV 服务地址' }
    try {
      const response = await fetch(this.remote('/'), {
        method: 'PROPFIND',
        headers: this.headers({ Depth: '0', 'Content-Type': 'application/xml' }),
        body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
      })
      if (response.status === 401) return { ok: false, message: '认证失败（401），请检查用户名与密码' }
      if (response.status >= 400) return { ok: false, message: `WebDAV 返回 ${response.status}` }
      return { ok: true, message: '连接成功' }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  async list(remotePath: string): Promise<CloudEntry[]> {
    const target = this.remote(remotePath)
    const response = await fetch(target, {
      method: 'PROPFIND',
      headers: this.headers({ Depth: '1', 'Content-Type': 'application/xml' }),
      body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>'
    })
    if (!response.ok) throw new Error(`WebDAV PROPFIND ${response.status}: ${await response.text().catch(() => '')}`)
    const xml = await response.text()
    const requestPath = decode(new URL(target).pathname)
    return this.parseMultiStatus(xml, requestPath).map((entry) => {
      const segments = entry.href.replace(/\/+$/, '').split('/')
      const name = decode(segments[segments.length - 1] ?? entry.href)
      return {
        name,
        path: joinRemote(remotePath, name),
        isDirectory: entry.isDirectory,
        sizeBytes: entry.sizeBytes,
        modifiedAt: entry.modifiedAt
      }
    })
  }

  private async ensureRemoteDir(remotePath: string): Promise<void> {
    const segments = remotePath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    let current = ''
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : `/${segment}`
      const response = await fetch(this.remote(current), { method: 'MKCOL', headers: this.headers() })
      if (response.status >= 400 && response.status !== 405) {
        // 405 = 已存在
        const body = await response.text().catch(() => '')
        if (!/exists/i.test(body) && response.status !== 301) {
          // 目录已存在时部分服务器返回 409/423，这里忽略创建失败，让后续 PUT 决定成败
        }
      }
    }
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    await this.ensureRemoteDir(dirname(remotePath.replace(/\\/g, '/')))
    const data = await readFile(localPath)
    const response = await fetch(this.remote(remotePath), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/octet-stream' }),
      body: new Uint8Array(data)
    })
    if (!response.ok) throw new Error(`WebDAV PUT ${response.status}`)
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const response = await fetch(this.remote(remotePath), { headers: this.headers() })
    if (!response.ok) throw new Error(`WebDAV GET ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await mkdir(dirname(localPath), { recursive: true })
    await writeFile(localPath, buffer)
  }

  async ensureDir(remotePath: string): Promise<void> {
    await this.ensureRemoteDir(remotePath)
  }

  async exists(remotePath: string): Promise<boolean> {
    const response = await fetch(this.remote(remotePath), { method: 'HEAD', headers: this.headers() })
    return response.status < 400
  }
}
