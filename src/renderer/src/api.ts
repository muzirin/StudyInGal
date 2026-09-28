import { CHANNELS } from '@shared/channels'
import type { StudyApi } from '@shared/api'

const invoke = <T>(channel: string, payload?: unknown): Promise<T> =>
  window.study.invoke(channel, payload) as Promise<T>

export const api: StudyApi = {
  app: {
    info: () => invoke(CHANNELS.app.info),
    openExternal: (url) => invoke(CHANNELS.app.openExternal, { url }),
    openPath: (target) => invoke(CHANNELS.app.openPath, { target }),
    revealPath: (target) => invoke(CHANNELS.app.revealPath, { target }),
    window: (action) => invoke(CHANNELS.app.window, { action }),
    windowState: () => invoke(CHANNELS.app.windowState),
    devtools: () => invoke(CHANNELS.app.devtools),
    relaunch: () => invoke(CHANNELS.app.relaunch),
    quit: () => invoke(CHANNELS.app.quit),
    checkUpdate: () => invoke(CHANNELS.app.checkUpdate)
  },
  dialogs: {
    pickFiles: (options) => invoke(CHANNELS.dialogs.pickFiles, options ?? {}),
    pickDirectory: () => invoke(CHANNELS.dialogs.pickDirectory),
    saveFile: (options) => invoke(CHANNELS.dialogs.saveFile, options ?? {})
  },
  settings: {
    get: () => invoke(CHANNELS.settings.get),
    update: (patch) => invoke(CHANNELS.settings.update, patch),
    reset: () => invoke(CHANNELS.settings.reset)
  },
  library: {
    snapshot: (kind) => invoke(CHANNELS.library.snapshot, { kind }),
    import: (request) => invoke(CHANNELS.library.import, request),
    remove: (kind, id) => invoke(CHANNELS.library.remove, { kind, id }),
    update: (kind, id, patch) => invoke(CHANNELS.library.update, { kind, id, patch }),
    read: (nodeId) => invoke(CHANNELS.library.read, { nodeId }),
    write: (nodeId, content, targetPath) => invoke(CHANNELS.library.write, { nodeId, content, targetPath }),
    merge: (nodeId) => invoke(CHANNELS.library.merge, { nodeId }),
    mergeExport: (nodeId, target) => invoke(CHANNELS.library.mergeExport, { nodeId, target }),
    chapters: (nodeId) => invoke(CHANNELS.library.chapters, { nodeId }),
    ocr: (nodeId, language) => invoke(CHANNELS.library.ocr, { nodeId, language }),
    ocrText: (nodeId) => invoke(CHANNELS.library.ocrText, { nodeId }),
    createFolder: (input) => invoke(CHANNELS.library.createFolder, input),
    createSeries: (input) => invoke(CHANNELS.library.createSeries, input),
    createCategory: (input) => invoke(CHANNELS.library.createCategory, input),
    createTag: (input) => invoke(CHANNELS.library.createTag, input),
    removeMeta: (input) => invoke(CHANNELS.library.removeMeta, input)
  },
  cloud: {
    list: () => invoke(CHANNELS.cloud.list),
    upsert: (mount) => invoke(CHANNELS.cloud.upsert, mount),
    remove: (id) => invoke(CHANNELS.cloud.remove, { id }),
    test: (id) => invoke(CHANNELS.cloud.test, { id }),
    listRemote: (id, path) => invoke(CHANNELS.cloud.listRemote, { id, path }),
    sync: (id) => invoke(CHANNELS.cloud.sync, { id }),
    log: () => invoke(CHANNELS.cloud.log),
    upload: (id, localPath, remotePath) => invoke(CHANNELS.cloud.upload, { id, localPath, remotePath }),
    download: (id, remotePath, localPath) => invoke(CHANNELS.cloud.download, { id, remotePath, localPath })
  },
  ai: {
    listProviders: () => invoke(CHANNELS.ai.listProviders),
    saveProvider: (provider) => invoke(CHANNELS.ai.saveProvider, provider),
    removeProvider: (id) => invoke(CHANNELS.ai.removeProvider, { id }),
    setRouting: (routing) => invoke(CHANNELS.ai.setRouting, { routing }),
    test: (id) => invoke(CHANNELS.ai.test, { id }),
    chat: (request) => invoke(CHANNELS.ai.chat, request),
    generateScript: (options) => invoke(CHANNELS.ai.generateScript, options)
  },
  characters: {
    list: () => invoke(CHANNELS.characters.list),
    upsert: (character) => invoke(CHANNELS.characters.upsert, character),
    remove: (id) => invoke(CHANNELS.characters.remove, { id }),
    import: () => invoke(CHANNELS.characters.import),
    export: (id) => invoke(CHANNELS.characters.export, { id })
  },
  gal: {
    listScripts: () => invoke(CHANNELS.gal.listScripts),
    getScript: (id) => invoke(CHANNELS.gal.getScript, { id }),
    saveScript: (script) => invoke(CHANNELS.gal.saveScript, script),
    deleteScript: (id) => invoke(CHANNELS.gal.deleteScript, { id }),
    exportSave: (scriptId, mountId) => invoke(CHANNELS.gal.exportSave, { scriptId, mountId }),
    exportMarkdown: (id, target) => invoke(CHANNELS.gal.exportMarkdown, { id, target }),
    seedExamples: (force) => invoke(CHANNELS.gal.seedExamples, { force })
  },
  archive: {
    list: () => invoke(CHANNELS.archive.list),
    upsert: (save) => invoke(CHANNELS.archive.upsert, save),
    remove: (id) => invoke(CHANNELS.archive.remove, { id }),
    updateProgress: (id, progress, linesRead) => invoke(CHANNELS.archive.updateProgress, { id, progress, linesRead })
  },
  schedule: {
    list: () => invoke(CHANNELS.schedule.list),
    upsert: (event) => invoke(CHANNELS.schedule.upsert, event),
    remove: (id) => invoke(CHANNELS.schedule.remove, { id }),
    importIcs: () => invoke(CHANNELS.schedule.importIcs),
    exportIcs: (target) => invoke(CHANNELS.schedule.exportIcs, { target })
  },
  workshop: {
    list: () => invoke(CHANNELS.workshop.list),
    export: (input) => invoke(CHANNELS.workshop.export, input),
    exportConfig: (target) => invoke(CHANNELS.workshop.exportConfig, { target }),
    validate: (bundlePath) => invoke(CHANNELS.workshop.validate, { bundlePath }),
    install: (bundlePath) => invoke(CHANNELS.workshop.install, { bundlePath })
  },
  errors: {
    capture: (error) => invoke(CHANNELS.errors.capture, error),
    list: () => invoke(CHANNELS.errors.list),
    clear: () => invoke(CHANNELS.errors.clear),
    draftIssue: (id) => invoke(CHANNELS.errors.draftIssue, { id }),
    openIssue: (id) => invoke(CHANNELS.errors.openIssue, { id })
  },
  terminal: {
    create: (options) => invoke(CHANNELS.terminal.create, options),
    write: (sessionId, data) => invoke(CHANNELS.terminal.write, { sessionId, data }),
    resize: (sessionId, cols, rows) => invoke(CHANNELS.terminal.resize, { sessionId, cols, rows }),
    kill: (sessionId) => invoke(CHANNELS.terminal.kill, { sessionId }),
    list: () => invoke(CHANNELS.terminal.list)
  },
  playground: {
    runtimes: () => invoke(CHANNELS.playground.runtimes),
    run: (request) => invoke(CHANNELS.playground.run, request),
    status: () => invoke(CHANNELS.playground.status),
    install: () => invoke(CHANNELS.playground.install)
  },
  xuexitong: {
    status: () => invoke(CHANNELS.xuexitong.status),
    launch: () => invoke(CHANNELS.xuexitong.launch),
    submit: (input) => invoke(CHANNELS.xuexitong.submit, input),
    config: (patch) => invoke(CHANNELS.xuexitong.config, patch)
  },
  sync: {
    status: () => invoke(CHANNELS.sync.status),
    run: () => invoke(CHANNELS.sync.run)
  },
  history: {
    list: (limit) => invoke(CHANNELS.history.list, { limit }),
    add: (entry) => invoke(CHANNELS.history.add, entry),
    remove: (id) => invoke(CHANNELS.history.remove, { id }),
    clear: () => invoke(CHANNELS.history.clear)
  },
  notes: {
    list: (nodeId) => invoke(CHANNELS.notes.list, { nodeId }),
    upsert: (entry) => invoke(CHANNELS.notes.upsert, entry),
    remove: (id) => invoke(CHANNELS.notes.remove, { id }),
    clear: (nodeId) => invoke(CHANNELS.notes.clear, { nodeId }),
    export: (nodeId, target) => invoke(CHANNELS.notes.export, { nodeId, target })
  },
  conversations: {
    list: (characterId) => invoke(CHANNELS.conversations.list, { characterId }),
    append: (input) => invoke(CHANNELS.conversations.append, input),
    rename: (id, title) => invoke(CHANNELS.conversations.rename, { id, title }),
    remove: (id) => invoke(CHANNELS.conversations.remove, { id })
  },
  stats: {
    addFocus: (input) => invoke(CHANNELS.stats.addFocus, input),
    focusSummary: () => invoke(CHANNELS.stats.focusSummary)
  },
  assets: {
    list: () => invoke(CHANNELS.assets.list)
  },
  events: {
    subscribe: (listener) => window.study.on(listener as (event: unknown) => void)
  }
}
