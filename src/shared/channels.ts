export const CHANNELS = {
  app: {
    info: 'app:info',
    openExternal: 'app:openExternal',
    openPath: 'app:openPath',
    revealPath: 'app:revealPath',
    window: 'app:window',
    windowState: 'app:windowState',
    quit: 'app:quit',
    devtools: 'app:devtools',
    relaunch: 'app:relaunch'
  },
  dialogs: {
    pickFiles: 'dialogs:pickFiles',
    pickDirectory: 'dialogs:pickDirectory',
    saveFile: 'dialogs:saveFile'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    reset: 'settings:reset'
  },
  library: {
    snapshot: 'library:snapshot',
    import: 'library:import',
    remove: 'library:remove',
    update: 'library:update',
    read: 'library:read',
    write: 'library:write',
    merge: 'library:merge',
    mergeExport: 'library:mergeExport',
    chapters: 'library:chapters',
    ocr: 'library:ocr',
    createFolder: 'library:createFolder',
    createSeries: 'library:createSeries',
    createCategory: 'library:createCategory',
    createTag: 'library:createTag',
    removeMeta: 'library:removeMeta'
  },
  cloud: {
    list: 'cloud:list',
    upsert: 'cloud:upsert',
    remove: 'cloud:remove',
    test: 'cloud:test',
    listRemote: 'cloud:listRemote',
    sync: 'cloud:sync',
    upload: 'cloud:upload',
    download: 'cloud:download'
  },
  ai: {
    listProviders: 'ai:listProviders',
    saveProvider: 'ai:saveProvider',
    removeProvider: 'ai:removeProvider',
    setRouting: 'ai:setRouting',
    test: 'ai:test',
    chat: 'ai:chat',
    generateScript: 'ai:generateScript'
  },
  characters: {
    list: 'characters:list',
    upsert: 'characters:upsert',
    remove: 'characters:remove',
    import: 'characters:import',
    export: 'characters:export'
  },
  gal: {
    listScripts: 'gal:listScripts',
    getScript: 'gal:getScript',
    saveScript: 'gal:saveScript',
    deleteScript: 'gal:deleteScript',
    exportSave: 'gal:exportSave'
  },
  archive: {
    list: 'archive:list',
    upsert: 'archive:upsert',
    remove: 'archive:remove',
    updateProgress: 'archive:updateProgress'
  },
  schedule: {
    list: 'schedule:list',
    upsert: 'schedule:upsert',
    remove: 'schedule:remove',
    importIcs: 'schedule:importIcs',
    exportIcs: 'schedule:exportIcs'
  },
  workshop: {
    list: 'workshop:list',
    export: 'workshop:export',
    validate: 'workshop:validate',
    install: 'workshop:install'
  },
  errors: {
    capture: 'errors:capture',
    list: 'errors:list',
    clear: 'errors:clear',
    draftIssue: 'errors:draftIssue',
    openIssue: 'errors:openIssue'
  },
  terminal: {
    create: 'terminal:create',
    write: 'terminal:write',
    resize: 'terminal:resize',
    kill: 'terminal:kill',
    list: 'terminal:list'
  },
  playground: {
    runtimes: 'playground:runtimes',
    run: 'playground:run',
    install: 'playground:install',
    status: 'playground:status'
  },
  xuexitong: {
    status: 'xuexitong:status',
    launch: 'xuexitong:launch',
    submit: 'xuexitong:submit',
    config: 'xuexitong:config'
  },
  sync: {
    status: 'sync:status',
    run: 'sync:run'
  },
  history: {
    list: 'history:list',
    add: 'history:add',
    remove: 'history:remove',
    clear: 'history:clear'
  },
  notes: {
    list: 'notes:list',
    upsert: 'notes:upsert',
    remove: 'notes:remove',
    clear: 'notes:clear'
  },
  event: 'study:event'
} as const

type Leaves<T> = T extends object ? { [K in keyof T]: Leaves<T[K]> }[keyof T] : T

export type Channel = Leaves<typeof CHANNELS>

const collect = (value: unknown, out: string[]): string[] => {
  if (typeof value === 'string') {
    out.push(value)
    return out
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) collect(nested, out)
  }
  return out
}

export const ALL_CHANNELS: string[] = collect(CHANNELS, [])

export type StudyEvent =
  | { type: 'terminal-data'; payload: { sessionId: string; type: 'stdout' | 'stderr' | 'exit'; data: string; code?: number } }
  | { type: 'error-captured'; payload: { id: string; message: string } }
  | { type: 'companion-bubble'; payload: { characterId: string; text: string } }
  | { type: 'sync-progress'; payload: { mountId: string; phase: string; current: number; total: number } }
  | { type: 'toast'; payload: { severity: 'success' | 'info' | 'warning' | 'error'; message: string } }
  | { type: 'proactive'; payload: { characterId: string; text: string } }
  | { type: 'library-changed'; payload: { kind: string } }
  | { type: 'window-state'; payload: { maximized: boolean; fullscreen: boolean; focused: boolean } }
  | { type: 'history-changed'; payload: { reason: string } }
