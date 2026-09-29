/**
 * 移动端的持久化集合（替代桌面端的 JSON 文件）。
 * 每个集合一个 IndexedDB key，内部结构与 shared/types 完全一致。
 */
import { DEFAULT_SETTINGS, ARCHIVE_FILE, CHARACTERS_FILE, LIBRARY_FILE, MOUNTS_FILE, SCHEDULE_FILE, SCRIPTS_FILE, SETTINGS_FILE } from '@shared/constants'
import { normalizeScript } from '@mainlib/normalizeScript'
import { isPristineLegacyDefault } from '@mainlib/legacyCharacter'
import { readKey, updateKey, writeKey } from './jsonStore'
import { deepMerge, newId } from './util'
import type {
  AppSettings,
  ArchiveSave,
  CapturedError,
  Character,
  Conversation,
  ConversationMessage,
  FocusSession,
  FocusSummary,
  HistoryEntry,
  LibraryKind,
  LibraryNode,
  LibrarySnapshot,
  NoteEntry,
  QuizAttempt,
  ScheduleEvent,
  WorkshopManifest,
  CloudMount
} from '@shared/types'

export const KEYS = {
  settings: SETTINGS_FILE,
  library: LIBRARY_FILE,
  characters: CHARACTERS_FILE,
  scripts: SCRIPTS_FILE,
  archive: ARCHIVE_FILE,
  schedule: SCHEDULE_FILE,
  mounts: MOUNTS_FILE,
  notes: 'notes.json',
  conversations: 'conversations.json',
  history: 'history.json',
  focus: 'focus.json',
  quizzes: 'quizzes.json',
  errors: 'errors.json',
  workshop: 'workshop.json'
} as const

/* -------------------------------- settings -------------------------------- */

export async function getSettings(): Promise<AppSettings> {
  const stored = await readKey<Partial<AppSettings>>(KEYS.settings, {})
  return deepMerge(DEFAULT_SETTINGS, stored)
}

export async function patchSettings(patch: Record<string, unknown>): Promise<AppSettings> {
  const next = deepMerge(await getSettings(), patch)
  await writeKey(KEYS.settings, next)
  return next
}

export async function resetSettings(): Promise<AppSettings> {
  await writeKey(KEYS.settings, DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

/* --------------------------------- library -------------------------------- */

const emptySnapshot = (kind: LibraryKind): LibrarySnapshot => ({
  kind,
  nodes: [],
  folders: [],
  series: [],
  categories: [],
  tags: []
})

interface LibraryDb {
  paper: LibrarySnapshot
  textbook: LibrarySnapshot
}

const emptyLibrary = (): LibraryDb => ({ paper: emptySnapshot('paper'), textbook: emptySnapshot('textbook') })

export async function readLibrary(): Promise<LibraryDb> {
  return readKey<LibraryDb>(KEYS.library, emptyLibrary())
}

export async function updateLibrary(mutator: (db: LibraryDb) => void): Promise<LibraryDb> {
  return updateKey<LibraryDb>(KEYS.library, emptyLibrary(), (db) => {
    const next: LibraryDb = { ...emptyLibrary(), ...db }
    mutator(next)
    return next
  })
}

export function findNodeIn(db: LibraryDb, nodeId: string): { kind: LibraryKind; node: LibraryNode } | null {
  for (const kind of ['paper', 'textbook'] as LibraryKind[]) {
    const node = db[kind].nodes.find((item) => item.id === nodeId)
    if (node) return { kind, node }
  }
  return null
}

/* ------------------------------- characters -------------------------------- */

async function loadCharacters(): Promise<Character[]> {
  const list = await readKey<Character[]>(KEYS.characters, [])
  const cleaned = list.filter((item) => !isPristineLegacyDefault(item))
  if (cleaned.length !== list.length) await writeKey(KEYS.characters, cleaned)
  return cleaned
}

export async function listCharacters(): Promise<Character[]> {
  return loadCharacters()
}

export async function upsertCharacter(input: Partial<Character>): Promise<Character> {
  const list = await loadCharacters()
  const now = Date.now()
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged = { ...list[index], ...input, id: list[index].id, updatedAt: now }
      list[index] = merged
      await writeKey(KEYS.characters, list)
      return merged
    }
  }
  const created: Character = {
    id: input.id ?? newId('char'),
    name: input.name ?? '新角色',
    avatar: input.avatar ?? '🙂',
    personality: input.personality ?? '',
    speakingStyle: input.speakingStyle ?? '',
    greeting: input.greeting ?? '',
    systemPrompt: input.systemPrompt ?? '',
    sprites: input.sprites ?? [],
    voice: input.voice ?? { providerId: null, voiceId: '', rate: 1, pitch: 1 },
    live2d: input.live2d ?? null,
    tags: input.tags ?? [],
    isCompanion: input.isCompanion ?? false,
    createdAt: now,
    updatedAt: now
  }
  await writeKey(KEYS.characters, [...list, created])
  return created
}

export async function removeCharacter(id: string): Promise<void> {
  const list = await loadCharacters()
  await writeKey(
    KEYS.characters,
    list.filter((item) => item.id !== id)
  )
}

/* --------------------------------- scripts -------------------------------- */

export async function listScripts(): Promise<ReturnType<typeof normalizeScript>[]> {
  const list = await readKey<LoadScripts>(KEYS.scripts, [])
  return list.map(normalizeScript).sort((a, b) => b.updatedAt - a.updatedAt)
}

type LoadScripts = Parameters<typeof normalizeScript>[0][]

export async function getScript(id: string) {
  const list = await readKey<LoadScripts>(KEYS.scripts, [])
  const found = list.find((item) => item.id === id)
  return found ? normalizeScript(found) : null
}

export async function saveScript(input: Partial<ReturnType<typeof normalizeScript>> & { id?: string }) {
  const raw = await readKey<LoadScripts>(KEYS.scripts, [])
  const now = Date.now()
  if (input.id) {
    const index = raw.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged = normalizeScript({ ...raw[index], ...input, id: raw[index].id, updatedAt: now } as never)
      raw[index] = merged
      await writeKey(KEYS.scripts, raw)
      return merged
    }
  }
  const created = normalizeScript({
    id: input.id ?? newId('script'),
    sourceId: input.sourceId ?? '',
    sourceKind: input.sourceKind ?? 'paper',
    title: input.title ?? '未命名剧本',
    characterId: input.characterId ?? '',
    sceneId: input.sceneId ?? null,
    lines: input.lines ?? [],
    questions: input.questions ?? [],
    providerId: input.providerId ?? null,
    sourceChapter: input.sourceChapter ?? null,
    model: input.model ?? null,
    createdAt: now,
    updatedAt: now
  } as never)
  await writeKey(KEYS.scripts, [created, ...raw])
  return created
}

export async function deleteScript(id: string): Promise<void> {
  const raw = await readKey<LoadScripts>(KEYS.scripts, [])
  await writeKey(
    KEYS.scripts,
    raw.filter((item) => item.id !== id)
  )
}

/* -------------------------------- 通用集合 -------------------------------- */

export const listArchive = () => readKey<ArchiveSave[]>(KEYS.archive, [])
export const writeArchive = (list: ArchiveSave[]) => writeKey(KEYS.archive, list)
export const listSchedule = () => readKey<ScheduleEvent[]>(KEYS.schedule, [])
export const writeSchedule = (list: ScheduleEvent[]) => writeKey(KEYS.schedule, list)
export const listNotes = () => readKey<NoteEntry[]>(KEYS.notes, [])
export const writeNotes = (list: NoteEntry[]) => writeKey(KEYS.notes, list)
export const listConversations = () => readKey<Conversation[]>(KEYS.conversations, [])
export const writeConversations = (list: Conversation[]) => writeKey(KEYS.conversations, list)
export const listHistory = () => readKey<HistoryEntry[]>(KEYS.history, [])
export const writeHistory = (list: HistoryEntry[]) => writeKey(KEYS.history, list)
export const listFocus = () => readKey<FocusSession[]>(KEYS.focus, [])
export const writeFocus = (list: FocusSession[]) => writeKey(KEYS.focus, list)
export const listAttempts = () => readKey<QuizAttempt[]>(KEYS.quizzes, [])
export const writeAttempts = (list: QuizAttempt[]) => writeKey(KEYS.quizzes, list)
export const listErrors = () => readKey<CapturedError[]>(KEYS.errors, [])
export const writeErrors = (list: CapturedError[]) => writeKey(KEYS.errors, list)
export const listMounts = () => readKey<CloudMount[]>(KEYS.mounts, [])
export const writeMounts = (list: CloudMount[]) => writeKey(KEYS.mounts, list)
export const listWorkshop = () => readKey<WorkshopManifest[]>(KEYS.workshop, [])
export const writeWorkshop = (list: WorkshopManifest[]) => writeKey(KEYS.workshop, list)

export type { ConversationMessage, FocusSummary }
