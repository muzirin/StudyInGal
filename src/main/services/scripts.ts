import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { SCRIPTS_FILE } from '@shared/constants'
import type { GalScript } from '@shared/types'

const store = new JsonStore<GalScript[]>(join(dataDir(), SCRIPTS_FILE), [])

export function listScripts(): GalScript[] {
  return store.read().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getScript(id: string): GalScript | null {
  return store.read().find((item) => item.id === id) ?? null
}

export function saveScript(input: Partial<GalScript> & { id?: string }): GalScript {
  const list = store.read()
  const now = Date.now()
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged: GalScript = { ...list[index], ...input, id: list[index].id, updatedAt: now }
      list[index] = merged
      store.write(list)
      return merged
    }
  }
  const created: GalScript = {
    id: input.id ?? newId('script'),
    sourceId: input.sourceId ?? '',
    sourceKind: input.sourceKind ?? 'paper',
    title: input.title ?? '未命名剧本',
    characterId: input.characterId ?? '',
    lines: input.lines ?? [],
    providerId: input.providerId ?? null,
    model: input.model ?? null,
    createdAt: now,
    updatedAt: now
  }
  store.write([...list, created])
  return created
}

export function deleteScript(id: string): void {
  store.write(store.read().filter((item) => item.id !== id))
}
