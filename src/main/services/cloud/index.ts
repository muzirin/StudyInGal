import { join } from 'node:path'
import { JsonStore } from '../../lib/jsonStore'
import { archiveDir, charactersDir, dataDir, libraryDir, scriptsDir } from '../../lib/paths'
import { newId } from '../../lib/util'
import { walkFiles } from '../../lib/fsutil'
import { emitEvent } from '../../lib/events'
import { MOUNTS_FILE } from '@shared/constants'
import type { CloudEntry, CloudMount, SyncResult } from '@shared/types'
import type { CloudAdapter } from './adapter'
import { LocalAdapter } from './local'
import { WebdavAdapter } from './webdav'
import { SmbAdapter } from './smb'
import { QuarkAdapter } from './quark'

const store = new JsonStore<CloudMount[]>(join(dataDir(), MOUNTS_FILE), [])

export function listMounts(): CloudMount[] {
  return store.read()
}

export function getMount(id: string): CloudMount | null {
  return store.read().find((item) => item.id === id) ?? null
}

export function upsertMount(input: Partial<CloudMount> & { kind: CloudMount['kind'] }): CloudMount {
  const list = store.read()
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged: CloudMount = { ...list[index], ...input, id: list[index].id }
      list[index] = merged
      store.write(list)
      return merged
    }
  }
  const created: CloudMount = {
    id: input.id ?? newId('mount'),
    name: input.name ?? `${input.kind} 挂载`,
    kind: input.kind,
    enabled: input.enabled ?? true,
    remotePath: input.remotePath ?? '/StudyInGal',
    config: input.config ?? {},
    status: input.status ?? 'unknown',
    lastError: input.lastError ?? null,
    lastSyncAt: input.lastSyncAt ?? null,
    readOnly: input.readOnly ?? false
  }
  store.write([...list, created])
  return created
}

export function removeMount(id: string): void {
  store.write(store.read().filter((item) => item.id !== id))
}

export function adapterFor(mount: CloudMount): CloudAdapter {
  switch (mount.kind) {
    case 'local':
      return new LocalAdapter(mount)
    case 'webdav':
      return new WebdavAdapter(mount)
    case 'smb':
      return new SmbAdapter(mount)
    case 'quark':
      return new QuarkAdapter(mount)
    default:
      throw new Error(`不支持的云盘类型：${(mount as CloudMount).kind}`)
  }
}

function markStatus(id: string, status: CloudMount['status'], error: string | null): void {
  store.update((list) =>
    list.map((mount) => (mount.id === id ? { ...mount, status, lastError: error } : mount))
  )
}

export async function testMount(id: string): Promise<{ ok: boolean; message: string }> {
  const mount = getMount(id)
  if (!mount) return { ok: false, message: '挂载不存在' }
  try {
    const result = await adapterFor(mount).test()
    markStatus(id, result.ok ? 'connected' : 'error', result.ok ? null : result.message)
    return result
  } catch (error) {
    const message = (error as Error).message
    markStatus(id, 'error', message)
    return { ok: false, message }
  }
}

export async function listRemote(id: string, path: string): Promise<CloudEntry[]> {
  const mount = getMount(id)
  if (!mount) throw new Error('挂载不存在')
  return adapterFor(mount).list(path)
}

export async function uploadToMount(id: string, localPath: string, remotePath: string): Promise<void> {
  const mount = getMount(id)
  if (!mount) throw new Error('挂载不存在')
  await adapterFor(mount).upload(localPath, remotePath)
}

export async function downloadFromMount(id: string, remotePath: string, localPath: string): Promise<void> {
  const mount = getMount(id)
  if (!mount) throw new Error('挂载不存在')
  await adapterFor(mount).download(remotePath, localPath)
}

const SYNC_SOURCES: { name: string; dir: string }[] = [
  { name: 'library', dir: libraryDir() },
  { name: 'archive', dir: archiveDir() },
  { name: 'scripts', dir: scriptsDir() },
  { name: 'characters', dir: charactersDir() }
]

export async function syncMount(id: string): Promise<SyncResult> {
  const mount = getMount(id)
  if (!mount) throw new Error('挂载不存在')
  const adapter = adapterFor(mount)
  const result: SyncResult = { mountId: id, uploaded: 0, downloaded: 0, skipped: 0, conflicts: [], finishedAt: 0 }

  const localFiles: { relative: string; absolute: string; sizeBytes: number; modifiedAt: number }[] = []
  for (const source of SYNC_SOURCES) {
    const files = await walkFiles(source.dir)
    for (const file of files) localFiles.push({ ...file, relative: `${source.name}/${file.relative}` })
  }

  const remoteIndex = new Map<string, CloudEntry>()
  const collectRemote = async (path: string): Promise<void> => {
    let entries: CloudEntry[] = []
    try {
      entries = await adapter.list(path)
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory) await collectRemote(entry.path)
      else remoteIndex.set(entry.path.replace(/^\/+/, ''), entry)
    }
  }
  await collectRemote(mount.remotePath)

  const total = localFiles.length
  let current = 0
  for (const file of localFiles) {
    current += 1
    emitEvent({ type: 'sync-progress', payload: { mountId: id, phase: 'upload', current, total } })
    const remote = remoteIndex.get(file.relative)
    if (!remote) {
      if (!mount.readOnly) {
        await adapter.upload(file.absolute, file.relative)
        result.uploaded += 1
      }
      continue
    }
    remoteIndex.delete(file.relative)
    if (remote.sizeBytes !== file.sizeBytes) {
      if (remote.modifiedAt && remote.modifiedAt > file.modifiedAt) {
        result.conflicts.push(file.relative)
      } else if (!mount.readOnly) {
        await adapter.upload(file.absolute, file.relative)
        result.uploaded += 1
      }
    } else {
      result.skipped += 1
    }
  }

  for (const [relative, entry] of remoteIndex) {
    if (mount.readOnly) break
    const [sourceName, ...rest] = relative.split('/')
    const sourceDir = SYNC_SOURCES.find((source) => source.name === sourceName)?.dir
    if (!sourceDir) continue
    const localTarget = join(sourceDir, ...rest)
    await adapter.download(entry.path, localTarget).catch(() => undefined)
    result.downloaded += 1
  }

  result.finishedAt = Date.now()
  store.update((list) => list.map((item) => (item.id === id ? { ...item, lastSyncAt: result.finishedAt, status: 'connected' } : item)))
  return result
}
