import type {
  AIProviderConfig,
  AppInfo,
  AppSettings,
  ArchiveSave,
  BundledAssets,
  CapturedError,
  ChapterRef,
  Character,
  CloudEntry,
  CloudMount,
  Conversation,
  DialogueLine,
  DocumentContent,
  DocumentPreview,
  FocusSummary,
  FolderNode,
  GalGenerateOptions,
  GalScript,
  HistoryEntry,
  IssueDraft,
  LibraryKind,
  LibraryNode,
  LibrarySnapshot,
  MergedDocument,
  NoteEntry,
  OcrResult,
  QuizAttempt,
  QuizQuestion,
  QuizResult,
  QuizStats,
  RunCodeRequest,
  RunCodeResult,
  RuntimeInfo,
  ScheduleEvent,
  SyncResult,
  TerminalChunk,
  TerminalSpawnOptions,
  WorkshopExportResult,
  WorkshopManifest,
  WindowState,
  CategoryNode,
  SeriesNode,
  TagNode,
  ImportRequest,
  ChatRequest,
  ChatResponse
} from './types'

export interface StudyApi {
  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    openPath(target: string): Promise<string>
    revealPath(target: string): Promise<void>
    window(action: WindowAction): Promise<void>
    windowState(): Promise<WindowState>
    devtools(): Promise<void>
    relaunch(): Promise<void>
    quit(): Promise<void>
    checkUpdate(): Promise<{
      ok: boolean
      current: string
      latest: string | null
      hasUpdate: boolean
      url: string | null
      publishedAt?: string | null
      message: string
    }>
  }
  dialogs: {
    pickFiles(options?: { filters?: { name: string; extensions: string[] }[]; multi?: boolean }): Promise<string[]>
    pickDirectory(): Promise<string | null>
    saveFile(options?: { defaultPath?: string }): Promise<string | null>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings> | Record<string, unknown>): Promise<AppSettings>
    reset(): Promise<AppSettings>
  }
  library: {
    snapshot(kind: LibraryKind): Promise<LibrarySnapshot>
    import(request: ImportRequest): Promise<LibraryNode[]>
    remove(kind: LibraryKind, id: string): Promise<void>
    update(kind: LibraryKind, id: string, patch: Partial<LibraryNode>): Promise<LibraryNode | null>
    read(nodeId: string): Promise<DocumentContent>
    write(nodeId: string, content: string, targetPath?: string): Promise<void>
    merge(nodeId: string): Promise<MergedDocument>
    mergeExport(nodeId: string, target: string): Promise<string>
    chapters(nodeId: string): Promise<ChapterRef[]>
    /** 渲染视图数据：PDF 原始字节 / DOCX 转出的 HTML */
    preview(nodeId: string): Promise<DocumentPreview>
    ocr(nodeId: string, language: string): Promise<OcrResult>
    ocrText(nodeId: string): Promise<{ exists: boolean; text: string }>
    createFolder(input: { kind: LibraryKind; name: string; parentId: string | null }): Promise<FolderNode>
    createSeries(input: { kind: LibraryKind; name: string; description?: string }): Promise<SeriesNode>
    createCategory(input: { kind: LibraryKind; name: string; color?: string }): Promise<CategoryNode>
    createTag(input: { name: string; color?: string }): Promise<TagNode>
    removeMeta(input: { kind: LibraryKind; meta: 'folder' | 'series' | 'category' | 'tag'; id: string }): Promise<void>
  }
  cloud: {
    list(): Promise<CloudMount[]>
    upsert(mount: Partial<CloudMount> & { kind: CloudMount['kind'] }): Promise<CloudMount>
    remove(id: string): Promise<void>
    test(id: string): Promise<{ ok: boolean; message: string }>
    listRemote(id: string, path: string): Promise<CloudEntry[]>
    sync(id: string): Promise<SyncResult>
    log(): Promise<
      {
        id: string
        mountId: string
        mountName: string
        at: number
        uploaded: number
        downloaded: number
        skipped: number
        conflicts: number
        ok: boolean
        message: string
      }[]
    >
    upload(id: string, localPath: string, remotePath: string): Promise<void>
    download(id: string, remotePath: string, localPath: string): Promise<void>
  }
  ai: {
    listProviders(): Promise<AIProviderConfig[]>
    saveProvider(provider: AIProviderConfig): Promise<AIProviderConfig[]>
    removeProvider(id: string): Promise<AIProviderConfig[]>
    setRouting(routing: Record<string, string | null>): Promise<AppSettings>
    test(id: string): Promise<{ ok: boolean; message: string; model?: string }>
    chat(request: ChatRequest): Promise<ChatResponse>
    generateScript(options: GalGenerateOptions): Promise<GalScript>
  }
  characters: {
    list(): Promise<Character[]>
    upsert(character: Partial<Character>): Promise<Character>
    remove(id: string): Promise<void>
    import(): Promise<Character[]>
    export(id: string): Promise<string | null>
  }
  gal: {
    listScripts(): Promise<GalScript[]>
    getScript(id: string): Promise<GalScript | null>
    saveScript(script: Partial<GalScript> & { id?: string }): Promise<GalScript>
    deleteScript(id: string): Promise<void>
    exportSave(scriptId: string, mountId: string | null): Promise<ArchiveSave>
    exportMarkdown(id: string, target: string): Promise<{ path: string; lines: number }>
    seedExamples(force?: boolean): Promise<{ added: number; total: number }>
  }
  archive: {
    list(): Promise<ArchiveSave[]>
    upsert(save: Partial<ArchiveSave>): Promise<ArchiveSave>
    remove(id: string): Promise<void>
    updateProgress(id: string, progress: number, linesRead: number): Promise<ArchiveSave | null>
  }
  schedule: {
    list(): Promise<ScheduleEvent[]>
    upsert(event: Partial<ScheduleEvent>): Promise<ScheduleEvent>
    remove(id: string): Promise<void>
    importIcs(): Promise<ScheduleEvent[]>
    exportIcs(target: string): Promise<string>
  }
  workshop: {
    list(): Promise<WorkshopManifest[]>
    export(input: { manifest: Partial<WorkshopManifest>; target: string; include: string[] }): Promise<WorkshopExportResult>
    exportConfig(target: string): Promise<{ path: string; bytes: number; redacted: boolean }>
    validate(bundlePath: string): Promise<{ ok: boolean; errors: string[]; manifest: WorkshopManifest | null }>
    install(bundlePath: string): Promise<{ ok: boolean; message: string }>
  }
  errors: {
    capture(error: { message: string; stack?: string; context?: string; extra?: Record<string, unknown> }): Promise<CapturedError>
    list(): Promise<CapturedError[]>
    clear(): Promise<void>
    draftIssue(id?: string): Promise<IssueDraft>
    openIssue(id?: string): Promise<void>
  }
  terminal: {
    create(options: TerminalSpawnOptions): Promise<{ sessionId: string }>
    write(sessionId: string, data: string): Promise<void>
    resize(sessionId: string, cols: number, rows: number): Promise<void>
    kill(sessionId: string): Promise<void>
    list(): Promise<string[]>
  }
  playground: {
    runtimes(): Promise<RuntimeInfo[]>
    run(request: RunCodeRequest): Promise<RunCodeResult>
    status(): Promise<{ installed: boolean; installPath: string }>
    install(): Promise<{ ok: boolean; message: string; path: string }>
  }
  xuexitong: {
    status(): Promise<{ configured: boolean; baseUrl: string; running: boolean }>
    launch(): Promise<{ ok: boolean; message: string }>
    submit(input: { taskId: string; content: string }): Promise<{ ok: boolean; message: string }>
    config(patch: { enabled?: boolean; baseUrl?: string }): Promise<AppSettings>
  }
  sync: {
    status(): Promise<{ running: boolean; lastRun: number | null; mountId: string | null }>
    run(): Promise<SyncResult[]>
  }
  history: {
    list(limit?: number): Promise<HistoryEntry[]>
    add(entry: Partial<HistoryEntry>): Promise<HistoryEntry[]>
    remove(id: string): Promise<HistoryEntry[]>
    clear(): Promise<void>
  }
  notes: {
    list(nodeId?: string): Promise<NoteEntry[]>
    upsert(entry: Partial<NoteEntry> & { nodeId: string }): Promise<NoteEntry>
    remove(id: string): Promise<NoteEntry[]>
    clear(nodeId: string): Promise<NoteEntry[]>
    export(nodeId: string | null, target: string): Promise<{ path: string; count: number }>
  }
  conversations: {
    list(characterId?: string): Promise<Conversation[]>
    append(input: {
      conversationId?: string
      characterId: string
      sourceId?: string
      message: { role: 'user' | 'assistant'; content: string; emotion?: string }
    }): Promise<Conversation>
    rename(id: string, title: string): Promise<Conversation[]>
    remove(id: string): Promise<Conversation[]>
  }
  stats: {
    addFocus(input: { minutes: number; kind?: 'work' | 'break' }): Promise<FocusSummary>
    focusSummary(): Promise<FocusSummary>
  }
  assets: {
    list(): Promise<BundledAssets>
  }
  quiz: {
    generate(input: {
      sourceId?: string
      scriptId?: string | null
      contextText?: string
      title?: string
      characterId?: string | null
      count?: number
    }): Promise<{ questions: QuizQuestion[]; truncated: boolean }>
    evaluate(input: { question: QuizQuestion; answer: string }): Promise<QuizResult>
    generateForScript(scriptId: string, count?: number): Promise<{ questions: QuizQuestion[]; truncated: boolean }>
    list(filter?: { sourceId?: string; scriptId?: string }): Promise<QuizAttempt[]>
    stats(filter?: { sourceId?: string; scriptId?: string }): Promise<QuizStats>
  }
  events: {
    subscribe(listener: (event: import('./channels').StudyEvent) => void): () => void
  }
}

export type WindowAction =
  | 'minimize'
  | 'maximize'
  | 'unmaximize'
  | 'toggle-maximize'
  | 'close'
  | 'toggle-fullscreen'
