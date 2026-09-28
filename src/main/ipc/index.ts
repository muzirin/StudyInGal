import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { basename, join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { ALL_CHANNELS, CHANNELS } from '@shared/channels'
import { GITHUB_URL, SUPPORTED_DOCUMENT_EXTENSIONS } from '@shared/constants'
import type { AppInfo, AppSettings, Character, ImportRequest, LibraryKind } from '@shared/types'
import { archiveDir, charactersDir, libraryDir } from '../lib/paths'
import { bus } from '../lib/events'
import * as settingsService from '../services/settings'
import * as libraryService from '../services/library'
import { mergeNode, readDocument, runOcr, writeDocument } from '../services/documents'
import * as cloud from '../services/cloud/index'
import * as ai from '../services/ai/client'
import { generateScript } from '../services/ai/script'
import * as characters from '../services/characters'
import * as scripts from '../services/scripts'
import * as archive from '../services/archive'
import * as schedule from '../services/schedule'
import * as workshop from '../services/workshop'
import * as errors from '../services/errors'
import * as terminal from '../services/terminal'
import * as playground from '../services/playground'
import * as xuexitong from '../services/xuexitong'
import * as history from '../services/history'
import * as notes from '../services/notes'
import * as conversations from '../services/conversations'
import * as focus from '../services/focus'
import { broadcastWindowState } from '../window'

type Payload = Record<string, unknown>
type Handler = (payload: Payload, event: Electron.IpcMainInvokeEvent) => unknown | Promise<unknown>

const firstWindow = (): BrowserWindow | null => BrowserWindow.getAllWindows()[0] ?? null

const docFilters = [
  { name: '?????', extensions: SUPPORTED_DOCUMENT_EXTENSIONS.map((ext) => ext.replace('.', '')) }
]

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const asNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

const handlers: Record<string, Handler> = {
  /* ----------------------------------- app ---------------------------------- */
  [CHANNELS.app.info]: (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    userDataPath: app.getPath('userData'),
    isDev: !app.isPackaged
  }),
  [CHANNELS.app.openExternal]: async (payload) => {
    await shell.openExternal(asString(payload.url))
  },
  [CHANNELS.app.openPath]: (payload) => shell.openPath(asString(payload.target)),
  [CHANNELS.app.revealPath]: (payload) => {
    shell.showItemInFolder(asString(payload.target))
  },
  [CHANNELS.app.window]: (payload, event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? firstWindow()
    if (!window) return
    switch (asString(payload.action)) {
      case 'minimize':
        window.minimize()
        break
      case 'maximize':
        window.maximize()
        break
      case 'unmaximize':
        window.unmaximize()
        break
      case 'toggle-maximize':
        if (window.isMaximized()) window.unmaximize()
        else window.maximize()
        break
      case 'toggle-fullscreen':
        window.setFullScreen(!window.isFullScreen())
        break
      case 'close':
        window.close()
        break
    }
    broadcastWindowState(window)
  },
  [CHANNELS.app.windowState]: (_payload, event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? firstWindow()
    if (!window) return { maximized: false, fullscreen: false, focused: true }
    return {
      maximized: window.isMaximized(),
      fullscreen: window.isFullScreen(),
      focused: window.isFocused()
    }
  },
  [CHANNELS.app.devtools]: () => {
    firstWindow()?.webContents.openDevTools({ mode: 'detach' })
  },
  [CHANNELS.app.relaunch]: () => {
    app.relaunch()
    app.exit(0)
  },
  [CHANNELS.app.checkUpdate]: async () => {
    const current = app.getVersion()
    try {
      const response = await fetch(`https://api.github.com/repos/muzirin/StudyInGal/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'StudyInGal' }
      })
      if (!response.ok) {
        return { ok: false, current, latest: null, hasUpdate: false, url: null, message: `GitHub ?? ${response.status}` }
      }
      const data = (await response.json()) as { tag_name?: string; html_url?: string; published_at?: string; body?: string }
      const latest = (data.tag_name ?? '').replace(/^v/, '')
      const toParts = (value: string): number[] => value.split('.').map((part) => Number.parseInt(part, 10) || 0)
      const [a, b] = [toParts(latest), toParts(current.replace(/^v/, ''))]
      let hasUpdate = false
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        if ((a[index] ?? 0) > (b[index] ?? 0)) {
          hasUpdate = true
          break
        }
        if ((a[index] ?? 0) < (b[index] ?? 0)) break
      }
      return {
        ok: true,
        current,
        latest: data.tag_name ?? latest,
        hasUpdate,
        url: data.html_url ?? null,
        publishedAt: data.published_at ?? null,
        message: hasUpdate ? '?????' : '??????'
      }
    } catch (error) {
      return { ok: false, current, latest: null, hasUpdate: false, url: null, message: (error as Error).message }
    }
  },
  [CHANNELS.app.quit]: () => {
    app.quit()
  },

  /* --------------------------------- dialogs -------------------------------- */
  [CHANNELS.dialogs.pickFiles]: async (payload) => {
    const window = firstWindow()
    const options: Electron.OpenDialogOptions = {
      properties: payload.multi === false ? ['openFile'] : ['openFile', 'multiSelections'],
      filters: (payload.filters as Electron.FileFilter[] | undefined) ?? docFilters
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  },
  [CHANNELS.dialogs.pickDirectory]: async () => {
    const window = firstWindow()
    const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0] ?? null
  },
  [CHANNELS.dialogs.saveFile]: async (payload) => {
    const window = firstWindow()
    const options: Electron.SaveDialogOptions = { defaultPath: payload.defaultPath as string | undefined }
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    return result.canceled ? null : result.filePath ?? null
  },

  /* -------------------------------- settings -------------------------------- */
  [CHANNELS.settings.get]: () => settingsService.getSettings(),
  [CHANNELS.settings.update]: (payload) => settingsService.updateSettings(payload as Partial<AppSettings>),
  [CHANNELS.settings.reset]: () => settingsService.resetSettings(),

  /* --------------------------------- library -------------------------------- */
  [CHANNELS.library.snapshot]: (payload) => libraryService.getSnapshot(payload.kind as LibraryKind),
  [CHANNELS.library.import]: (payload) => libraryService.importPaths(payload as unknown as ImportRequest),
  [CHANNELS.library.remove]: (payload) => {
    libraryService.removeNode(payload.kind as LibraryKind, asString(payload.id))
  },
  [CHANNELS.library.update]: (payload) =>
    libraryService.updateNode(payload.kind as LibraryKind, asString(payload.id), payload.patch as never),
  [CHANNELS.library.read]: async (payload) => {
    const found = libraryService.findNode(asString(payload.nodeId))
    if (!found) throw new Error('?????')
    const document = await readDocument(found.node)
    history.addHistory({
      kind: found.kind,
      title: found.node.title,
      subtitle: `${document.format.toUpperCase()} � ${
        found.kind === 'paper' ? '??' : '??'
      }${found.node.format === 'folder' ? ` � ${found.node.chapters.length} ?` : ''}`,
      refId: found.node.id,
      route: `/reader/${found.kind}/${found.node.id}`
    })
    return document
  },
  [CHANNELS.library.write]: async (payload) => {
    const found = libraryService.findNode(asString(payload.nodeId))
    if (!found) throw new Error('?????')
    await writeDocument(found.node, asString(payload.content), payload.targetPath as string | undefined)
    libraryService.updateNode(found.kind, found.node.id, { updatedAt: Date.now() })
  },
  [CHANNELS.library.merge]: async (payload) => {
    const found = libraryService.findNode(asString(payload.nodeId))
    if (!found) throw new Error('?????')
    return mergeNode(found.node)
  },
  [CHANNELS.library.mergeExport]: async (payload) => {
    const found = libraryService.findNode(asString(payload.nodeId))
    if (!found) throw new Error('?????')
    const merged = await mergeNode(found.node)
    const target = asString(payload.target)
    await mkdir(join(target, '..'), { recursive: true }).catch(() => undefined)
    await writeFile(target, merged.markdown, 'utf8')
    return target
  },
  [CHANNELS.library.chapters]: (payload) => {
    const found = libraryService.findNode(asString(payload.nodeId))
    if (!found) throw new Error('?????')
    return found.node.chapters
  },
  [CHANNELS.library.ocr]: async (payload) => {
    const found = libraryService.findNode(asString(payload.nodeId))
    if (!found) throw new Error('?????')
    libraryService.updateNode(found.kind, found.node.id, { ocrStatus: 'running' })
    try {
      const result = await runOcr(found.node, asString(payload.language, 'chi_sim+eng'))
      libraryService.updateNode(found.kind, found.node.id, { ocrStatus: 'done' })
      const target = join(libraryDir(), `${found.node.id}.ocr.txt`)
      await writeFile(target, result.text, 'utf8')
      return { ...result, path: target }
    } catch (error) {
      libraryService.updateNode(found.kind, found.node.id, { ocrStatus: 'failed' })
      throw error
    }
  },
  [CHANNELS.library.ocrText]: async (payload) => {
    const nodeId = asString(payload.nodeId)
    const target = join(libraryDir(), `${nodeId}.ocr.txt`)
    try {
      const text = await readFile(target, 'utf8')
      return { exists: true, text }
    } catch {
      return { exists: false, text: '' }
    }
  },
  [CHANNELS.library.createFolder]: (payload) =>
    libraryService.createFolder(payload as unknown as { kind: LibraryKind; name: string; parentId: string | null }),
  [CHANNELS.library.createSeries]: (payload) =>
    libraryService.createSeries(payload as unknown as { kind: LibraryKind; name: string; description?: string }),
  [CHANNELS.library.createCategory]: (payload) =>
    libraryService.createCategory(payload as unknown as { kind: LibraryKind; name: string; color?: string }),
  [CHANNELS.library.createTag]: (payload) => libraryService.createTag(payload as unknown as { name: string; color?: string }),
  [CHANNELS.library.removeMeta]: (payload) =>
    libraryService.removeMeta(payload as unknown as { kind: LibraryKind; meta: 'folder' | 'series' | 'category' | 'tag'; id: string }),

  /* ---------------------------------- cloud --------------------------------- */
  [CHANNELS.cloud.list]: () => cloud.listMounts(),
  [CHANNELS.cloud.upsert]: (payload) => cloud.upsertMount(payload as never),
  [CHANNELS.cloud.remove]: (payload) => {
    cloud.removeMount(asString(payload.id))
  },
  [CHANNELS.cloud.test]: (payload) => cloud.testMount(asString(payload.id)),
  [CHANNELS.cloud.listRemote]: (payload) => cloud.listRemote(asString(payload.id), asString(payload.path, '/')),
  [CHANNELS.cloud.sync]: (payload) => cloud.syncMount(asString(payload.id)),
  [CHANNELS.cloud.log]: () => cloud.listSyncLog(),
  [CHANNELS.cloud.upload]: (payload) =>
    cloud.uploadToMount(asString(payload.id), asString(payload.localPath), asString(payload.remotePath)),
  [CHANNELS.cloud.download]: (payload) =>
    cloud.downloadFromMount(asString(payload.id), asString(payload.remotePath), asString(payload.localPath)),

  /* ------------------------------------ ai ---------------------------------- */
  [CHANNELS.ai.listProviders]: () => ai.listProviders(),
  [CHANNELS.ai.saveProvider]: (payload) => ai.saveProvider(payload as never),
  [CHANNELS.ai.removeProvider]: (payload) => ai.removeProvider(asString(payload.id)),
  [CHANNELS.ai.setRouting]: (payload) => ai.setRouting(payload.routing as Record<string, string | null>),
  [CHANNELS.ai.test]: (payload) => ai.testProvider(asString(payload.id)),
  [CHANNELS.ai.chat]: (payload) => ai.chat(payload as never),
  [CHANNELS.ai.generateScript]: async (payload) => {
    const script = await generateScript(payload as never)
    history.addHistory({
      kind: 'script',
      title: script.title,
      subtitle: `${script.lines.length} ? � ${script.model ?? '????'}`,
      refId: script.id,
      route: `/galgame/${script.id}`
    })
    return script
  },

  /* ------------------------------- characters ------------------------------- */
  [CHANNELS.characters.list]: () => characters.listCharacters(),
  [CHANNELS.characters.upsert]: (payload) => characters.upsertCharacter(payload as never),
  [CHANNELS.characters.remove]: (payload) => {
    characters.removeCharacter(asString(payload.id))
  },
  [CHANNELS.characters.import]: async () => {
    const window = firstWindow()
    const result = window
      ? await dialog.showOpenDialog(window, {
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: '???', extensions: ['json'] }]
        })
      : { canceled: true, filePaths: [] as string[] }
    if (result.canceled) return characters.listCharacters()
    for (const file of result.filePaths) {
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8')) as Character
        characters.upsertCharacter({ ...parsed, id: undefined })
      } catch (error) {
        console.warn('[characters] ????', file, (error as Error).message)
      }
    }
    return characters.listCharacters()
  },
  [CHANNELS.characters.export]: async (payload) => {
    const character = characters.listCharacters().find((item) => item.id === asString(payload.id))
    if (!character) return null
    const target = join(charactersDir(), `${character.id}.json`)
    await writeFile(target, JSON.stringify(character, null, 2), 'utf8')
    return target
  },

  /* ----------------------------------- gal ---------------------------------- */
  [CHANNELS.gal.listScripts]: () => scripts.listScripts(),
  [CHANNELS.gal.getScript]: (payload) => scripts.getScript(asString(payload.id)),
  [CHANNELS.gal.saveScript]: (payload) => scripts.saveScript(payload as never),
  [CHANNELS.gal.deleteScript]: (payload) => {
    scripts.deleteScript(asString(payload.id))
  },
  [CHANNELS.gal.exportSave]: async (payload) => {
    const script = scripts.getScript(asString(payload.scriptId))
    if (!script) throw new Error('?????')
    const save = archive.upsertSave({
      title: script.title,
      kind: script.sourceKind,
      sourceId: script.sourceId,
      scriptId: script.id,
      characterId: script.characterId,
      totalLines: script.lines.length
    })
    const target = join(archiveDir(), `${save.id}.json`)
    await writeFile(target, JSON.stringify({ save, script }, null, 2), 'utf8')
    const mountId = payload.mountId ? asString(payload.mountId) : null
    let storage: typeof save.storage = 'local'
    if (mountId) {
      await cloud.uploadToMount(mountId, target, `archive/${basename(target)}`)
      storage = (cloud.getMount(mountId)?.kind ?? 'local') as typeof save.storage
    }
    return archive.upsertSave({ id: save.id, dataPath: target, storage, mountId })
  },

  /* -------------------------------- archive --------------------------------- */
  [CHANNELS.archive.list]: () => archive.listSaves(),
  [CHANNELS.archive.upsert]: (payload) => {
    const isNew = !payload.id
    const save = archive.upsertSave(payload as never)
    if (isNew && save.scriptId) {
      history.addHistory({
        kind: 'save',
        title: save.title,
        subtitle: `?? � ${save.kind === 'paper' ? '??' : '??'}`,
        refId: save.scriptId,
        route: `/galgame/${save.scriptId}`
      })
    }
    return save
  },
  [CHANNELS.archive.remove]: (payload) => {
    archive.removeSave(asString(payload.id))
  },
  [CHANNELS.archive.updateProgress]: (payload) =>
    archive.updateProgress(asString(payload.id), asNumber(payload.progress), asNumber(payload.linesRead)),

  /* -------------------------------- schedule -------------------------------- */
  [CHANNELS.schedule.list]: () => schedule.listEvents(),
  [CHANNELS.schedule.upsert]: (payload) => schedule.upsertEvent(payload as never),
  [CHANNELS.schedule.remove]: (payload) => {
    schedule.removeEvent(asString(payload.id))
  },
  [CHANNELS.schedule.importIcs]: async () => {
    const window = firstWindow()
    const result = window
      ? await dialog.showOpenDialog(window, {
          properties: ['openFile'],
          filters: [{ name: 'iCalendar', extensions: ['ics'] }]
        })
      : { canceled: true, filePaths: [] as string[] }
    if (result.canceled || !result.filePaths[0]) return schedule.listEvents()
    schedule.importIcsFile(result.filePaths[0])
    return schedule.listEvents()
  },
  [CHANNELS.schedule.exportIcs]: (payload) => schedule.exportIcs(asString(payload.target)),

  /* -------------------------------- workshop -------------------------------- */
  [CHANNELS.workshop.list]: () => workshop.listInstalledAsync(),
  [CHANNELS.workshop.export]: (payload) => workshop.exportBundle(payload as never),
  [CHANNELS.workshop.exportConfig]: (payload) => workshop.exportConfig(asString(payload.target)),
  [CHANNELS.workshop.validate]: (payload) => workshop.validateBundle(asString(payload.bundlePath)),
  [CHANNELS.workshop.install]: (payload) => workshop.installBundle(asString(payload.bundlePath)),

  /* --------------------------------- errors --------------------------------- */
  [CHANNELS.errors.capture]: (payload) => errors.captureError(payload as never),
  [CHANNELS.errors.list]: () => errors.listErrors(),
  [CHANNELS.errors.clear]: () => errors.clearErrors(),
  [CHANNELS.errors.draftIssue]: (payload) => errors.draftIssue(payload.id as string | undefined),
  [CHANNELS.errors.openIssue]: async (payload) => {
    const draft = errors.draftIssue(payload.id as string | undefined)
    await shell.openExternal(draft.url)
  },

  /* -------------------------------- terminal -------------------------------- */
  [CHANNELS.terminal.create]: (payload) => terminal.createTerminal(payload as never),
  [CHANNELS.terminal.write]: (payload) => {
    terminal.writeTerminal(asString(payload.sessionId), asString(payload.data))
  },
  [CHANNELS.terminal.resize]: (payload) => {
    terminal.resizeTerminal(asString(payload.sessionId), asNumber(payload.cols), asNumber(payload.rows))
  },
  [CHANNELS.terminal.kill]: (payload) => {
    terminal.killTerminal(asString(payload.sessionId))
  },
  [CHANNELS.terminal.list]: () => terminal.listTerminals(),

  /* ------------------------------- playground ------------------------------- */
  [CHANNELS.playground.runtimes]: () => playground.listRuntimes(),
  [CHANNELS.playground.run]: (payload) => playground.runCode(payload as never),
  [CHANNELS.playground.status]: () => playground.playgroundStatus(),
  [CHANNELS.playground.install]: () => playground.installPlayground(),

  /* ------------------------------- xuexitong -------------------------------- */
  [CHANNELS.xuexitong.status]: () => xuexitong.status(),
  [CHANNELS.xuexitong.launch]: () => xuexitong.launch(),
  [CHANNELS.xuexitong.submit]: (payload) => xuexitong.submit(payload as never),
  [CHANNELS.xuexitong.config]: (payload) => xuexitong.configure(payload as never),

  /* --------------------------------- history -------------------------------- */
  [CHANNELS.history.list]: (payload) => history.listHistory(asNumber(payload.limit, 0)),
  [CHANNELS.history.add]: (payload) => history.addHistory(payload as never),
  [CHANNELS.history.remove]: (payload) => history.removeHistory(asString(payload.id)),
  [CHANNELS.history.clear]: () => history.clearHistory(),

  /* ---------------------------------- notes --------------------------------- */
  [CHANNELS.notes.list]: (payload) => notes.listNotes(payload.nodeId ? asString(payload.nodeId) : undefined),
  [CHANNELS.notes.upsert]: (payload) => notes.upsertNote(payload as never),
  [CHANNELS.notes.remove]: (payload) => notes.removeNote(asString(payload.id)),
  [CHANNELS.notes.clear]: (payload) => notes.clearNotes(asString(payload.nodeId)),

  /* ----------------------------- conversations ------------------------------ */
  [CHANNELS.conversations.list]: (payload) =>
    conversations.listConversations(payload.characterId ? asString(payload.characterId) : undefined),
  [CHANNELS.conversations.append]: (payload) => conversations.appendMessage(payload as never),
  [CHANNELS.conversations.rename]: (payload) =>
    conversations.renameConversation(asString(payload.id), asString(payload.title)),
  [CHANNELS.conversations.remove]: (payload) => conversations.removeConversation(asString(payload.id)),

  /* ---------------------------------- stats --------------------------------- */
  [CHANNELS.stats.addFocus]: (payload) => focus.addFocus(payload as never),
  [CHANNELS.stats.focusSummary]: () => focus.summary(),

  /* ---------------------------------- sync ---------------------------------- */
  [CHANNELS.sync.status]: () => ({
    running: false,
    lastRun: cloud
      .listMounts()
      .reduce<number | null>(
        (acc, mount) => (mount.lastSyncAt && (!acc || mount.lastSyncAt > acc) ? mount.lastSyncAt : acc),
        null
      ),
    mountId: settingsService.getSettings().sync.mountId
  }),
  [CHANNELS.sync.run]: async () => {
    const mounts = cloud.listMounts().filter((mount) => mount.enabled)
    const results = []
    for (const mount of mounts) results.push(await cloud.syncMount(mount.id))
    return results
  }
}

export function registerIpc(): void {
  for (const channel of ALL_CHANNELS) {
    const handler = handlers[channel]
    ipcMain.handle(channel, async (event, payload) => {
      if (!handler) throw new Error(`???????${channel}`)
      try {
        return await handler((payload ?? {}) as Payload, event)
      } catch (error) {
        const captured = errors.captureError({
          message: (error as Error).message,
          stack: (error as Error).stack,
          context: channel,
          extra: { payload: JSON.stringify(payload).slice(0, 2000) }
        })
        bus.emit('event', { type: 'error-captured', payload: { id: captured.id, message: captured.message } })
        throw error
      }
    })
  }

  bus.on('event', (event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(CHANNELS.event, event)
    }
  })

  console.info(
    `[StudyInGal] ??? ${ALL_CHANNELS.length} ? IPC ?? � ???? ${app.getPath('userData')} � ${GITHUB_URL}`
  )
}
