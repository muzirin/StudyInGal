import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import type { NoteEntry } from '@shared/types'

const store = new JsonStore<NoteEntry[]>(join(dataDir(), 'notes.json'), [])

export function listNotes(nodeId?: string): NoteEntry[] {
  const entries = store.read().sort((a, b) => b.updatedAt - a.updatedAt)
  return nodeId ? entries.filter((entry) => entry.nodeId === nodeId) : entries
}

export function upsertNote(input: Partial<NoteEntry> & { nodeId: string }): NoteEntry {
  const entries = store.read()
  const now = Date.now()
  if (input.id) {
    const index = entries.findIndex((entry) => entry.id === input.id)
    if (index >= 0) {
      const merged: NoteEntry = { ...entries[index], ...input, id: entries[index].id, updatedAt: now }
      entries[index] = merged
      store.write(entries)
      return merged
    }
  }
  const created: NoteEntry = {
    id: input.id ?? newId('note'),
    nodeId: input.nodeId,
    chapterPath: input.chapterPath ?? '',
    chapterTitle: input.chapterTitle ?? '',
    title: input.title ?? '笔记',
    kind: input.kind ?? 'user',
    content: input.content ?? '',
    createdAt: now,
    updatedAt: now
  }
  store.write([created, ...entries])
  return created
}

export function removeNote(id: string): NoteEntry[] {
  const entries = store.read().filter((entry) => entry.id !== id)
  store.write(entries)
  return entries
}

export function clearNotes(nodeId: string): NoteEntry[] {
  const entries = store.read().filter((entry) => entry.nodeId !== nodeId)
  store.write(entries)
  return entries
}
