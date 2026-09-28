import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { walkFiles } from '../lib/fsutil'
import { workshopDir } from '../lib/paths'
import { getSettings } from './settings'
import { listCharacters } from './characters'
import { listMounts } from './cloud/index'
import type { WorkshopAsset, WorkshopExportResult, WorkshopManifest } from '@shared/types'

interface BundleShape {
  manifest: WorkshopManifest
  files: Record<string, string>
}

const sha256 = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex')

export async function listInstalledAsync(): Promise<WorkshopManifest[]> {
  const root = workshopDir()
  const manifests: WorkshopManifest[] = []
  const files = await walkFiles(root).catch(() => [])
  for (const file of files) {
    if (basename(file.relative) !== 'manifest.json') continue
    try {
      manifests.push(JSON.parse(await readFile(file.absolute, 'utf8')) as WorkshopManifest)
    } catch {
      /* 跳过损坏的清单 */
    }
  }
  return manifests
}

export async function exportBundle(input: {
  manifest: Partial<WorkshopManifest>
  target: string
  include: string[]
}): Promise<WorkshopExportResult> {
  const files: Record<string, string> = {}
  const assets: WorkshopAsset[] = []

  for (const item of input.include) {
    const walked = await walkFiles(item).catch(() => [])
    const entries =
      walked.length > 0 ? walked : [{ relative: basename(item), absolute: item, sizeBytes: 0, modifiedAt: 0 }]
    for (const entry of entries) {
      const buffer = await readFile(entry.absolute)
      const key = entry.relative.replace(/\\/g, '/')
      files[key] = buffer.toString('base64')
      assets.push({ path: key, sha256: sha256(buffer), sizeBytes: buffer.byteLength })
    }
  }

  const manifest: WorkshopManifest = {
    schemaVersion: 1,
    id: input.manifest.id ?? `pkg-${Date.now()}`,
    name: input.manifest.name ?? input.manifest.id ?? '未命名创意工坊资源',
    version: input.manifest.version ?? '1.0.0',
    author: input.manifest.author ?? 'unknown',
    description: input.manifest.description ?? '',
    license: input.manifest.license ?? 'GPL-3.0-or-later',
    type: input.manifest.type ?? 'bundle',
    entry: input.manifest.entry ?? null,
    baseUrl: input.manifest.baseUrl ?? '',
    dependencies: input.manifest.dependencies ?? [],
    tags: input.manifest.tags ?? [],
    createdAt: Date.now(),
    assets
  }

  const payload: BundleShape = { manifest, files }
  await mkdir(dirname(input.target), { recursive: true })
  await writeFile(input.target, gzipSync(Buffer.from(JSON.stringify(payload), 'utf8')))
  return { manifest, bundlePath: input.target, fileCount: assets.length }
}

async function readBundle(bundlePath: string): Promise<BundleShape> {
  const raw = gunzipSync(await readFile(bundlePath)).toString('utf8')
  return JSON.parse(raw) as BundleShape
}

export async function validateBundle(
  bundlePath: string
): Promise<{ ok: boolean; errors: string[]; manifest: WorkshopManifest | null }> {
  const errors: string[] = []
  try {
    const bundle = await readBundle(bundlePath)
    if (bundle.manifest.schemaVersion !== 1) errors.push('不支持的 schemaVersion')
    for (const asset of bundle.manifest.assets ?? []) {
      const data = bundle.files[asset.path]
      if (data === undefined) {
        errors.push(`缺少资源文件：${asset.path}`)
        continue
      }
      const buffer = Buffer.from(data, 'base64')
      if (sha256(buffer) !== asset.sha256) errors.push(`校验失败：${asset.path}`)
      if (buffer.byteLength !== asset.sizeBytes) errors.push(`大小不一致：${asset.path}`)
    }
    return { ok: errors.length === 0, errors, manifest: bundle.manifest }
  } catch (error) {
    return { ok: false, errors: [(error as Error).message], manifest: null }
  }
}

export async function installBundle(bundlePath: string): Promise<{ ok: boolean; message: string }> {
  const validation = await validateBundle(bundlePath)
  if (!validation.ok || !validation.manifest) {
    return { ok: false, message: validation.errors.join('；') || '安装包校验失败' }
  }
  const bundle = await readBundle(bundlePath)
  const target = join(workshopDir(), validation.manifest.id)
  await mkdir(target, { recursive: true })
  for (const [key, data] of Object.entries(bundle.files)) {
    const destination = join(target, key)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, Buffer.from(data, 'base64'))
  }
  await writeFile(join(target, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2), 'utf8')
  return { ok: true, message: `已安装到 ${relative(workshopDir(), target) || target}` }
}

const SECRET_KEYS = new Set(['password', 'cookie', 'apiKey', 'token', 'secret', 'privateKey'])

function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets)
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SECRET_KEYS.has(key) ? (nested ? '__REDACTED__' : nested) : stripSecrets(nested)
    }
    return output
  }
  return value
}

/**
 * 一键导出配置：设置（脱敏）、角色卡、云盘挂载（脱敏）。
 * 便于换机迁移或分享给别人作为起点。不含任何 API Key / 密码 / Cookie。
 */
export async function exportConfig(target: string): Promise<{ path: string; bytes: number; redacted: boolean }> {
  const settings = getSettings()
  const payload = {
    schemaVersion: 1,
    app: 'StudyInGal',
    exportedAt: Date.now(),
    settings: stripSecrets(settings),
    characters: listCharacters(),
    mounts: listMounts().map((mount) => ({ ...mount, config: stripSecrets(mount.config) }))
  }
  const text = JSON.stringify(payload, null, 2)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text, 'utf8')
  return { path: target, bytes: Buffer.byteLength(text), redacted: true }
}
