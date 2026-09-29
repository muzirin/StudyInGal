export type LibraryKind = 'paper' | 'textbook'

export type DocumentFormat =
  | 'latex'
  | 'md'
  | 'pdf'
  | 'doc'
  | 'docx'
  | 'txt'
  | 'html'
  | 'epub'
  | 'folder'
  | 'other'

export interface ChapterRef {
  id: string
  title: string
  path: string
  order: number
}

export interface LibraryNode {
  id: string
  kind: LibraryKind
  title: string
  authors: string[]
  abstract: string
  tags: string[]
  folderId: string | null
  seriesId: string | null
  categoryId: string | null
  path: string
  format: DocumentFormat
  sizeBytes: number
  createdAt: number
  updatedAt: number
  favorite: boolean
  readingProgress: number
  lastOpenedAt: number | null
  ocrStatus: OcrStatus
  chapters: ChapterRef[]
  meta: Record<string, unknown>
}

export type OcrStatus = 'none' | 'pending' | 'running' | 'done' | 'failed'

export interface FolderNode {
  id: string
  kind: LibraryKind
  name: string
  parentId: string | null
}

export interface SeriesNode {
  id: string
  kind: LibraryKind
  name: string
  description: string
}

export interface CategoryNode {
  id: string
  kind: LibraryKind
  name: string
  color: string
}

export interface TagNode {
  id: string
  name: string
  color: string
}

export interface LibrarySnapshot {
  kind: LibraryKind
  nodes: LibraryNode[]
  folders: FolderNode[]
  series: SeriesNode[]
  categories: CategoryNode[]
  tags: TagNode[]
}

export interface ImportRequest {
  kind: LibraryKind
  paths: string[]
  folderId?: string | null
  seriesId?: string | null
  categoryId?: string | null
  tags?: string[]
}

export interface MergedDocument {
  nodeId: string
  title: string
  chapters: { title: string; path: string; content: string }[]
  markdown: string
  mergedAt: number
}

/* ----------------------------- cloud storage ----------------------------- */

export type CloudKind = 'local' | 'webdav' | 'smb' | 'quark'

export type CloudStatus = 'unknown' | 'connected' | 'error' | 'auth-required' | 'disabled'

export interface CloudMount {
  id: string
  name: string
  kind: CloudKind
  enabled: boolean
  remotePath: string
  config: Record<string, unknown>
  status: CloudStatus
  lastError: string | null
  lastSyncAt: number | null
  readOnly: boolean
}

export interface CloudEntry {
  name: string
  path: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: number | null
}

export interface SyncResult {
  mountId: string
  uploaded: number
  downloaded: number
  skipped: number
  conflicts: string[]
  finishedAt: number
}

/* -------------------------------- AI config ------------------------------- */

export type AIProviderKind =
  | 'openai'
  | 'deepseek'
  | 'gemini'
  | 'anthropic'
  | 'ollama'
  | 'openai-compatible'

export interface AIProviderConfig {
  id: string
  name: string
  kind: AIProviderKind
  baseUrl: string
  apiKey: string
  model: string
  enabled: boolean
  temperature: number
  maxTokens: number
  headers: Record<string, string>
}

export type AICapability = 'script' | 'chat' | 'tts' | 'stt' | 'vision' | 'embedding'

export interface TTSSettings {
  engine: 'webspeech' | 'edge' | 'openai' | 'custom'
  providerId: string | null
  voice: string
  rate: number
  pitch: number
}

export interface AIConfig {
  providers: AIProviderConfig[]
  routing: Record<AICapability, string | null>
  tts: TTSSettings
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  providerId?: string | null
  capability?: AICapability
  messages: ChatMessage[]
  temperature?: number
  /** 覆盖提供商默认的 max tokens（剧本生成会按行数预算自动放大） */
  maxTokens?: number
  json?: boolean
  stream?: boolean
}

export interface ChatResponse {
  providerId: string
  model: string
  content: string
  /** 结束原因，'length' 表示被 max_tokens 截断 */
  finishReason?: string | null
  usage?: { promptTokens?: number; completionTokens?: number }
}

/* ------------------------------- characters ------------------------------- */

export interface CharacterSprite {
  emotion: string
  path: string
}

export interface CharacterVoice {
  providerId: string | null
  voiceId: string
  rate: number
  pitch: number
}

export interface Live2DConfig {
  modelPath: string
  scale: number
  x: number
  y: number
  idleMotion: string
}

export interface Character {
  id: string
  name: string
  avatar: string | null
  personality: string
  speakingStyle: string
  greeting: string
  systemPrompt: string
  sprites: CharacterSprite[]
  voice: CharacterVoice
  live2d: Live2DConfig | null
  tags: string[]
  isCompanion: boolean
  createdAt: number
  updatedAt: number
}

/* ------------------------------ gal production ---------------------------- */

export type DialogueSpeaker = 'character' | 'user' | 'narration'

export interface DialogueLine {
  id: string
  speaker: DialogueSpeaker
  text: string
  emotion: string
}

export interface GalScript {
  id: string
  sourceId: string
  sourceKind: LibraryKind
  title: string
  characterId: string
  /** 该剧本使用的场景背景 id（来自内置背景或用户导入的背景） */
  sceneId: string | null
  lines: DialogueLine[]
  /** 随剧本一起生成的单选题（读取时直接可用，无需再调用模型） */
  questions: QuizQuestion[]
  providerId: string | null
  model: string | null
  /** 本次取材的章节/小节标题；为空表示取材自整篇 */
  sourceChapter?: string | null
  createdAt: number
  updatedAt: number
}

/** 本次生成只取材某一个章节/片段，避免一次性把整本教材丢给模型 */
export interface GalExcerpt {
  /** 分册教材：章节文件的绝对路径 */
  path?: string
  /** 单文件：字符区间 [start, end)，缺省表示从头开始 */
  start?: number
  end?: number
  /** 展示用标题（章节名或小节名） */
  title?: string
}

export interface GalGenerateOptions {
  sourceId: string
  characterId: string
  depth: 'summary' | 'standard' | 'deep'
  language: 'zh' | 'en'
  maxLines: number
  focus?: string
  /** 随剧本一起生成的单选题数量（默认按行数自动推算） */
  questionCount?: number
  /** 只取材某个章节/片段；缺省时按整篇（教材分册会合并全文） */
  excerpt?: GalExcerpt
}

/** 文档的「渲染视图」数据：PDF 给原始字节（由前端用 pdf.js 画出来），DOCX 给转好的 HTML */
export type DocumentPreview =
  | { mode: 'pdf'; base64: string; sizeBytes: number }
  | { mode: 'html'; html: string }
  | { mode: 'none'; reason: string }

/* --------------------------------- archive -------------------------------- */

export interface ArchiveSave {
  id: string
  title: string
  kind: LibraryKind
  sourceId: string
  scriptId: string | null
  characterId: string | null
  progress: number
  linesRead: number
  totalLines: number
  favorite: boolean
  tags: string[]
  storage: CloudKind
  mountId: string | null
  dataPath: string
  coverPath: string | null
  createdAt: number
  updatedAt: number
  lastPlayedAt: number | null
}

/* -------------------------------- schedule -------------------------------- */

export type ScheduleKind = 'class' | 'exam' | 'task' | 'plan' | 'reminder'

export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface ScheduleEvent {
  id: string
  kind: ScheduleKind
  title: string
  description: string
  start: number
  end: number | null
  allDay: boolean
  location: string
  repeat: RepeatRule
  weekdays: number[]
  color: string
  done: boolean
  tags: string[]
  reminderMinutes: number | null
}

/* -------------------------------- workshop -------------------------------- */

export interface WorkshopAsset {
  path: string
  sha256: string
  sizeBytes: number
}

export type WorkshopPackageType =
  | 'character'
  | 'gal-script'
  | 'theme'
  | 'textbook-pack'
  | 'tool'
  | 'bundle'

export interface WorkshopManifest {
  schemaVersion: 1
  id: string
  name: string
  version: string
  author: string
  description: string
  license: string
  type: WorkshopPackageType
  entry: string | null
  baseUrl: string
  assets: WorkshopAsset[]
  dependencies: string[]
  tags: string[]
  createdAt: number
}

export interface WorkshopExportResult {
  manifest: WorkshopManifest
  bundlePath: string
  fileCount: number
}

/* --------------------------------- errors --------------------------------- */

export interface CapturedError {
  id: string
  message: string
  stack: string
  context: string
  appVersion: string
  platform: string
  timestamp: number
  extra: Record<string, unknown>
}

export interface IssueDraft {
  title: string
  body: string
  url: string
}

/* -------------------------------- terminal -------------------------------- */

export interface TerminalSpawnOptions {
  cwd?: string
  shell?: string
  cols?: number
  rows?: number
}

export interface TerminalChunk {
  sessionId: string
  type: 'stdout' | 'stderr' | 'exit'
  data: string
  code?: number
}

/* ------------------------------- playground ------------------------------- */

export interface RuntimeInfo {
  id: string
  name: string
  command: string
  version: string | null
  available: boolean
  path: string | null
}

export interface RunCodeRequest {
  language: string
  code: string
  stdin?: string
}

export interface RunCodeResult {
  language: string
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

/* ------------------------------- documents -------------------------------- */

export interface DocumentContent {
  nodeId: string
  format: DocumentFormat
  text: string
  html: string | null
  isBinary: boolean
  editable: boolean
}

export interface OcrRequest {
  nodeId: string
  language: string
}

export interface OcrResult {
  nodeId: string
  text: string
  engine: string
  finishedAt: number
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  userDataPath: string
  isDev: boolean
}

export interface WindowState {
  maximized: boolean
  fullscreen: boolean
  focused: boolean
}

/** 用户自己添加的场景背景（本地图片） */
export interface CustomScene {
  id: string
  name: string
  path: string
}

export interface BundledBackground {
  id: string
  name: string
  file: string
  path: string
}

export interface BundledSprite {
  id: string
  name: string
  file: string
  path: string
}

export interface BundledAssets {
  backgrounds: BundledBackground[]
  sprites: BundledSprite[]
  defaultSprite: string | null
}

export type HistoryKind = 'paper' | 'textbook' | 'script' | 'save' | 'tool' | 'action'

export interface HistoryEntry {
  id: string
  kind: HistoryKind
  title: string
  subtitle: string
  refId: string
  route: string
  icon: string
  at: number
  count: number
}

export type NoteKind = 'ai' | 'user' | 'quote'

export interface NoteEntry {
  id: string
  nodeId: string
  chapterPath: string
  chapterTitle: string
  title: string
  kind: NoteKind
  content: string
  createdAt: number
  updatedAt: number
}

/* ---------------------------------- 问答 ---------------------------------- */

/**
 * 题目一律为单选（EIPF 里对应 `decision` 条目：选项 + 正确项下标）。
 * 结构对齐 EIPF 的 scene-entry 约定：
 *   - 线性 `index`（对应 data-index）
 *   - options 顺序即 `data-choice-index` 顺序
 *   - 正确项与解析放进 `params`（对应 data-params）
 */
/**
 * 答题后的分支台词：选了某个选项，角色接着说什么。
 * EIPF 里对应 `decision` 后面的分支条目（`predicate` 引用 + `dialog` 台词）。
 */
export interface QuizBranch {
  /** 对应选项下标 */
  choiceIndex: number
  /** 角色接着说的话：答对是「强化」，答错是「纠正/解释」 */
  text: string
  /** 说话时的情绪，缺省按 neutral 处理 */
  emotion?: string
}

export interface QuizQuestion {
  id: string
  /** 线性序号，对应 EIPF 的 data-index */
  index: number
  question: string
  options: string[]
  /** 正确项下标（0 起） */
  answerIndex: number
  explanation: string
  /**
   * 每个选项对应的分支台词（答对强化 / 答错由角色解释）。
   * 模型没给全时由 `completeBranches` 按 explanation 补齐。
   */
  branches?: QuizBranch[] | null
  sourceId: string
  scriptId: string | null
  /**
   * 阶段性检测的插入位置：读到剧本第几行（`GalScript.lines` 下标，0 起）之后出现。
   * 旧数据没有这个字段，播放器会退化为「每幕一批」。
   */
  checkpoint?: number | null
  createdAt: number
}

/** EIPF 对齐后的题目条目（data-type = decision） */
export interface QuizEntryParams {
  [key: string]: unknown
  answerIndex: number
  explanation: string
}

export interface QuizAttempt {
  id: string
  questionId: string
  sourceId: string
  scriptId: string | null
  question: string
  answer: string
  /** 实际选了哪个选项（0 起），用于回看走了哪条分支 */
  choiceIndex?: number | null
  correct: boolean
  at: number
}

export interface QuizResult {
  correct: boolean
  score: number
  feedback: string
  explanation: string
  reference: string
}

export interface QuizStats {
  total: number
  correct: number
  accuracy: number
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  emotion: string
  at: number
}

export interface Conversation {
  id: string
  characterId: string
  title: string
  sourceId: string
  messages: ConversationMessage[]
  createdAt: number
  updatedAt: number
}

export interface FocusSession {
  id: string
  at: number
  minutes: number
  kind: 'work' | 'break'
}

export interface FocusSummary {
  todayMinutes: number
  todaySessions: number
  totalMinutes: number
  totalSessions: number
  streakDays: number
  last7Days: { date: string; minutes: number }[]
}

export type NavPosition = 'left' | 'right' | 'top' | 'bottom'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeSettings {
  palette: string
  mode: ThemeMode
  navPosition: NavPosition
  density: 'comfortable' | 'compact'
  touchOptimized: boolean
  radius: number
}

export interface AppSettings {
  schemaVersion: number
  theme: ThemeSettings
  locale: string
  library: {
    roots: Record<LibraryKind, string>
    autoOcr: boolean
    ocrLanguage: string
  }
  ai: AIConfig
  companion: {
    activeCharacterId: string | null
    proactive: boolean
    proactiveIntervalMinutes: number
    proactivePrompt: string
    showBubbles: boolean
  }
  home: {
    sceneId: string
    autoScene: boolean
    customScenes: CustomScene[]
  }
  quiz: {
    /** 每读完一幕自动出题 */
    autoAtSceneEnd: boolean
    /** 每组题目数量 */
    count: number
    /**
     * 到检测点再用「已经读到的台词」现场出题（更贴合进度，但每个检测点多一次模型调用）。
     * 关闭时用随剧本预生成的题目（已按段锚定，不会一次问完）。
     */
    generateAtCheckpoint?: boolean
  }
  live2d: {
    enabled: boolean
    modelPath: string | null
    coreUrl: string
    scale: number
    x: number
    y: number
    opacity: number
  }
  editor: {
    fontFamily: string
    fontSize: number
    autosave: boolean
    autosaveMs: number
  }
  developer: {
    enabled: boolean
    terminalShell: string
    openDevToolsOnStart: boolean
  }
  telemetry: {
    crashReporting: boolean
    autoIssueDraft: boolean
  }
  sync: {
    autoSync: boolean
    intervalMinutes: number
    mountId: string | null
  }
  playground: {
    installed: boolean
    installPath: string
  }
  xuexitong: {
    enabled: boolean
    baseUrl: string
  }
  desktop: {
    trayEnabled: boolean
    closeToTray: boolean
    globalAskShortcut: string
  }
  workshop: {
    registryUrl: string
  }
  nav: {
    pinned: string[]
    hidden: string[]
  }
}
