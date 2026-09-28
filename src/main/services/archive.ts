import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { ARCHIVE_FILE } from '@shared/constants'
import type { ArchiveSave } from '@shared/types'

const store = new JsonStore<ArchiveSave[]>(join(dataDir(), ARCHIVE_FILE), [])

export function listSaves(): ArchiveSave[] {
  return store.read().sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt))
}

export function upsertSave(input: Partial<ArchiveSave>): ArchiveSave {
  const list = store.read()
  const now = Date.now()
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged: ArchiveSave = { ...list[index], ...input, id: list[index].id, updatedAt: now }
      list[index] = merged
      store.write(list)
      return merged
    }
  }
  const created: ArchiveSave = {
    id: input.id ?? newId('save'),
    title: input.title ?? '未命名存档',
    kind: input.kind ?? 'paper',
    sourceId: input.sourceId ?? '',
    scriptId: input.scriptId ?? null,
    characterId: input.characterId ?? null,
    progress: input.progress ?? 0,
    linesRead: input.linesRead ?? 0,
    totalLines: input.totalLines ?? 0,
    favorite: input.favorite ?? false,
    tags: input.tags ?? [],
    storage: input.storage ?? 'local',
    mountId: input.mountId ?? null,
    dataPath: input.dataPath ?? '',
    coverPath: input.coverPath ?? null,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: input.lastPlayedAt ?? now
  }
  store.write([...list, created])
  return created
}

export function removeSave(id: string): void {
  store.write(store.read().filter((item) => item.id !== id))
}

export function updateProgress(id: string, progress: number, linesRead: number): ArchiveSave | null {
  const list = store.read()
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) return null
  const now = Date.now()
  list[index] = { ...list[index], progress, linesRead, lastPlayedAt: now, updatedAt: now }
  store.write(list)
  return list[index]
}
