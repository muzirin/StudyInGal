import { basename, extname, join } from 'node:path'
import { stat } from 'node:fs/promises'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { LIBRARY_FILE, SUPPORTED_DOCUMENT_EXTENSIONS } from '@shared/constants'
import { detectChapters, detectFormat } from './documents'
import type {
  CategoryNode,
  FolderNode,
  ImportRequest,
  LibraryKind,
  LibraryNode,
  LibrarySnapshot,
  SeriesNode,
  TagNode
} from '@shared/types'

interface LibraryDb {
  paper: LibrarySnapshot
  textbook: LibrarySnapshot
}

const emptySnapshot = (kind: LibraryKind): LibrarySnapshot => ({
  kind,
  nodes: [],
  folders: [],
  series: [],
  categories: [],
  tags: []
})

const store = new JsonStore<LibraryDb>(join(dataDir(), LIBRARY_FILE), {
  paper: emptySnapshot('paper'),
  textbook: emptySnapshot('textbook')
})

export function getSnapshot(kind: LibraryKind): LibrarySnapshot {
  return store.read()[kind]
}

function mutate(kind: LibraryKind, updater: (snapshot: LibrarySnapshot) => LibrarySnapshot): LibrarySnapshot {
  return store.update((db) => {
    db[kind] = updater(db[kind])
  })[kind]
}

export function findNode(nodeId: string): { kind: LibraryKind; node: LibraryNode } | null {
  const db = store.read()
  for (const kind of ['paper', 'textbook'] as LibraryKind[]) {
    const node = db[kind].nodes.find((item) => item.id === nodeId)
    if (node) return { kind, node }
  }
  return null
}

const isSupported = (target: string): boolean =>
  SUPPORTED_DOCUMENT_EXTENSIONS.includes(extname(target).toLowerCase())

async function measure(target: string, isDirectory: boolean): Promise<number> {
  try {
    const info = await stat(target)
    return isDirectory ? 0 : info.size
  } catch {
    return 0
  }
}

export async function importPaths(request: ImportRequest): Promise<LibraryNode[]> {
  const now = Date.now()
  const created: LibraryNode[] = []
  const skipped: string[] = []

  for (const target of request.paths) {
    let isDirectory = false
    try {
      isDirectory = (await stat(target)).isDirectory()
    } catch {
      skipped.push(target)
      continue
    }
    if (!isDirectory && !isSupported(target)) {
      skipped.push(target)
      continue
    }
    const format = detectFormat(target, isDirectory)
    const node: LibraryNode = {
      id: newId('node'),
      kind: request.kind,
      title: basename(target, isDirectory ? '' : extname(target)),
      authors: [],
      abstract: '',
      tags: request.tags ?? [],
      folderId: request.folderId ?? null,
      seriesId: request.seriesId ?? null,
      categoryId: request.categoryId ?? null,
      path: target,
      format,
      sizeBytes: await measure(target, isDirectory),
      createdAt: now,
      updatedAt: now,
      favorite: false,
      readingProgress: 0,
      lastOpenedAt: null,
      ocrStatus: 'none',
      chapters: [],
      meta: {}
    }
    if (isDirectory) node.chapters = await detectChapters(node)
    created.push(node)
  }

  if (created.length > 0) {
    mutate(request.kind, (current) => ({ ...current, nodes: [...created, ...current.nodes] }))
  }
  if (skipped.length > 0) {
    console.warn('[library] 跳过不支持的文件：', skipped)
  }
  return created
}

export function removeNode(kind: LibraryKind, id: string): void {
  mutate(kind, (current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id) }))
}

export function updateNode(kind: LibraryKind, id: string, patch: Partial<LibraryNode>): LibraryNode | null {
  let updated: LibraryNode | null = null
  mutate(kind, (current) => ({
    ...current,
    nodes: current.nodes.map((node) => {
      if (node.id !== id) return node
      updated = { ...node, ...patch, id: node.id, updatedAt: Date.now() }
      return updated
    })
  }))
  return updated
}

export function createFolder(input: { kind: LibraryKind; name: string; parentId: string | null }): FolderNode {
  const folder: FolderNode = { id: newId('folder'), kind: input.kind, name: input.name, parentId: input.parentId }
  mutate(input.kind, (current) => ({ ...current, folders: [...current.folders, folder] }))
  return folder
}

export function createSeries(input: { kind: LibraryKind; name: string; description?: string }): SeriesNode {
  const series: SeriesNode = {
    id: newId('series'),
    kind: input.kind,
    name: input.name,
    description: input.description ?? ''
  }
  mutate(input.kind, (current) => ({ ...current, series: [...current.series, series] }))
  return series
}

export function createCategory(input: { kind: LibraryKind; name: string; color?: string }): CategoryNode {
  const category: CategoryNode = {
    id: newId('cat'),
    kind: input.kind,
    name: input.name,
    color: input.color ?? ''
  }
  mutate(input.kind, (current) => ({ ...current, categories: [...current.categories, category] }))
  return category
}

export function createTag(input: { name: string; color?: string }): TagNode {
  const tag: TagNode = { id: newId('tag'), name: input.name, color: input.color ?? '' }
  const db = store.read()
  for (const kind of ['paper', 'textbook'] as LibraryKind[]) {
    if (!db[kind].tags.some((item) => item.name === tag.name)) db[kind].tags.push(tag)
  }
  store.write(db)
  return tag
}

export function removeMeta(input: {
  kind: LibraryKind
  meta: 'folder' | 'series' | 'category' | 'tag'
  id: string
}): void {
  mutate(input.kind, (current) => {
    const next = { ...current }
    if (input.meta === 'folder') {
      next.folders = current.folders.filter((item) => item.id !== input.id)
      next.nodes = current.nodes.map((node) => (node.folderId === input.id ? { ...node, folderId: null } : node))
    } else if (input.meta === 'series') {
      next.series = current.series.filter((item) => item.id !== input.id)
      next.nodes = current.nodes.map((node) => (node.seriesId === input.id ? { ...node, seriesId: null } : node))
    } else if (input.meta === 'category') {
      next.categories = current.categories.filter((item) => item.id !== input.id)
      next.nodes = current.nodes.map((node) => (node.categoryId === input.id ? { ...node, categoryId: null } : node))
    } else {
      const tag = current.tags.find((item) => item.id === input.id)
      next.tags = current.tags.filter((item) => item.id !== input.id)
      if (tag) next.nodes = current.nodes.map((node) => ({ ...node, tags: node.tags.filter((t) => t !== tag.name) }))
    }
    return next
  })
}
