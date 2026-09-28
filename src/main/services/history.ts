import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { emitEvent } from '../lib/events'
import type { HistoryEntry, HistoryKind } from '@shared/types'

const store = new JsonStore<HistoryEntry[]>(join(dataDir(), 'history.json'), [])
const MAX_ENTRIES = 200

const DEFAULT_ICON: Record<HistoryKind, string> = {
  paper: 'science',
  textbook: 'book',
  script: 'script',
  save: 'save',
  tool: 'tool',
  action: 'bolt'
}

export function listHistory(limit = 0): HistoryEntry[] {
  const entries = store.read().sort((a, b) => b.at - a.at)
  return limit > 0 ? entries.slice(0, limit) : entries
}

export function addHistory(input: Partial<HistoryEntry> & { title: string }): HistoryEntry[] {
  const entries = store.read()
  const refId = input.refId ?? ''
  const route = input.route ?? ''
  const kind = (input.kind ?? 'action') as HistoryKind
  const existingIndex = entries.findIndex((item) => item.refId === refId && item.route === route && refId !== '')
  const now = Date.now()

  if (existingIndex >= 0) {
    const existing = entries[existingIndex]
    entries.splice(existingIndex, 1)
    entries.unshift({
      ...existing,
      ...input,
      kind,
      id: existing.id,
      title: input.title,
      subtitle: input.subtitle ?? existing.subtitle,
      icon: input.icon ?? existing.icon,
      at: now,
      count: existing.count + 1
    })
  } else {
    entries.unshift({
      id: input.id ?? newId('hist'),
      kind,
      title: input.title,
      subtitle: input.subtitle ?? '',
      refId,
      route,
      icon: input.icon ?? DEFAULT_ICON[kind],
      at: now,
      count: 1
    })
  }

  const trimmed = entries.slice(0, MAX_ENTRIES)
  store.write(trimmed)
  emitEvent({ type: 'history-changed', payload: { reason: kind } })
  return trimmed
}

export function removeHistory(id: string): HistoryEntry[] {
  const entries = store.read().filter((item) => item.id !== id)
  store.write(entries)
  emitEvent({ type: 'history-changed', payload: { reason: 'remove' } })
  return entries
}

export function clearHistory(): void {
  store.write([])
  emitEvent({ type: 'history-changed', payload: { reason: 'clear' } })
}
