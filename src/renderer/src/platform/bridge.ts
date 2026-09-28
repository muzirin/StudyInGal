/**
 * 移动端（Capacitor/WebView）的 `window.study` 桥。
 *
 * 桌面端由 Electron preload 提供同样的 `invoke/on/pathForFile` 接口；
 * 移动端没有主进程，这里用浏览器 API + Capacitor 插件实现同一套通道，
 * 让渲染层代码完全不用改。
 *
 * 不支持的能力（终端、代码练习场、学习通、SMB/夸克、PDF/DOCX 解析、OCR）
 * 会返回明确的错误信息，而不是静默失败。
 */
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import { CHANNELS, type StudyEvent } from '@shared/channels'
import { APP_NAME, DEFAULT_SETTINGS, GITHUB_ISSUES_URL, GITHUB_URL } from '@shared/constants'
import { readKey, writeKey } from './jsonStore'
import * as store from './store'
import * as ai from './ai'
import * as docs from './documents'
import { basename, extname, stripExtension } from './path'
import { base64ToText, deepMerge, newId, textToBase64 } from './util'
import type { CloudMount, LibraryNode, QuizQuestion } from '@shared/types'

const CHANNEL_VALUES = Object.values(CHANNELS)
const ALL: string[] = []
const collect = (value: unknown): void => {
  if (typeof value === 'string') {
    ALL.push(value)
    return
  }
  if (value && typeof value === 'object') Object.values(value).forEach(collect)
}
CHANNEL_VALUES.forEach(collect)
const allowedChannels = new Set(ALL)

const listeners = new Set<(event: StudyEvent) => void>()
const emit = (event: StudyEvent): void => listeners.forEach((listener) => listener(event))

const unsupported = (feature: string): never => {
  throw new Error(`移动端暂不支持：${feature}（桌面端可用）`)
}

/* ------------------------------ 文件选择注册表 ------------------------------ */

const fileRegistry = new Map<string, File>()
const dirRegistry = new Map<string, File[]>()
let fileSeq = 0

function pickViaInput(accept: string, directory = false, multi = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multi
    if (directory) input.setAttribute('webkitdirectory', 'true')
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => {
      const files = Array.from(input.files ?? [])
      input.remove()
      resolve(files)
    }
    input.oncancel = () => {
      input.remove()
      resolve([])
    }
    input.click()
  })
}

const acceptFromFilters = (filters?: { name: string; extensions: string[] }[]): string => {
  if (!filters || filters.length === 0) return '*/*'
  return filters.flatMap((filter) => filter.extensions.map((ext) => `.${ext.replace(/^\./, '')}`)).join(',')
}

/* --------------------------------- WebDAV --------------------------------- */

interface WebdavConfig {
  url: string
  username: string
  password: string
  basePath: string
}

const webdavHeaders = (config: WebdavConfig): Record<string, string> => {
  const headers: Record<string, string> = {}
  if (config.username) headers.Authorization = `Basic ${btoa(`${config.username}:${config.password ?? ''}`)}`
  return headers
}

const webdavUrl = (config: WebdavConfig, remotePath: string): string =>
  `${(config.url ?? '').replace(/\/+$/, '')}${(config.basePath ?? '').replace(/\/+$/, '')}/${remotePath.replace(/^\/+/, '')}`

async function webdavList(mount: CloudMount, remotePath: string): Promise<{ name: string; path: string; isDirectory: boolean; sizeBytes: number; modifiedAt: number | null }[]> {
  const config = mount.config as unknown as WebdavConfig
  const url = webdavUrl(config, remotePath)
  const response = await fetch(url, {
    method: 'PROPFIND',
    headers: { ...webdavHeaders(config), Depth: '1', 'Content-Type': 'application/xml' },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>'
  })
  if (!response.ok) throw new Error(`WebDAV ${response.status}`)
  const xml = await response.text()
  const blocks = xml.match(/<(?:[\w-]+:)?response[\s>][\s\S]*?<\/(?:[\w-]+:)?response>/gi) ?? []
  const self = new URL(url).pathname.replace(/\/+$/, '')
  const entries = []
  for (const block of blocks) {
    const href = block.match(/<(?:[\w-]+:)?href[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?href>/i)?.[1]?.trim()
    if (!href) continue
    const decoded = decodeURIComponent(href)
    if (decoded.replace(/\/+$/, '') === self) continue
    const isDirectory = /<(?:[\w-]+:)?collection/i.test(block)
    const size = Number(block.match(/<(?:[\w-]+:)?getcontentlength[^>]*>(\d+)/i)?.[1] ?? 0)
    const modified = block.match(/<(?:[\w-]+:)?getlastmodified[^>]*>([\s\S]*?)</i)?.[1]
    const name = decodeURIComponent(decoded.replace(/\/+$/, '').split('/').pop() ?? '')
    entries.push({ name, path: `${remotePath.replace(/\/+$/, '')}/${name}`, isDirectory, sizeBytes: size, modifiedAt: modified ? Date.parse(modified) || null : null })
  }
  return entries
}

/* --------------------------------- 收藏/历史 -------------------------------- */

async function addHistory(entry: Partial<import('@shared/types').HistoryEntry> & { title: string }): Promise<void> {
  const list = await store.listHistory()
  const now = Date.now()
  const refId = entry.refId ?? ''
  const route = entry.route ?? ''
  const index = refId ? list.findIndex((item) => item.refId === refId && item.route === route) : -1
  if (index >= 0) {
    const existing = list[index]
    list.splice(index, 1)
    list.unshift({ ...existing, ...entry, kind: entry.kind ?? existing.kind, id: existing.id, at: now, count: existing.count + 1 })
  } else {
    list.unshift({
      id: newId('hist'),
      kind: entry.kind ?? 'action',
      title: entry.title,
      subtitle: entry.subtitle ?? '',
      refId,
      route,
      icon: entry.icon ?? 'bolt',
      at: now,
      count: 1
    })
  }
  await store.writeHistory(list.slice(0, 200))
  emit({ type: 'history-changed', payload: { reason: 'add' } })
}

/* --------------------------------- handlers -------------------------------- */

type Handler = (payload: Record<string, unknown>) => unknown | Promise<unknown>

const handlers: Record<string, Handler> = {
  /* app */
  [CHANNELS.app.info]: async () => ({
    name: APP_NAME,
    version: '0.5.3-android',
    electron: '—',
    chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? '—',
    node: '—',
    platform: Capacitor.getPlatform(),
    arch: 'arm64',
    userDataPath: 'Documents/StudyInGal',
    isDev: false
  }),
  [CHANNELS.app.openExternal]: (payload) => {
    window.open(String(payload.url), '_blank')
  },
  [CHANNELS.app.openPath]: (payload) => {
    window.open(docs.toDisplayUri(String(payload.target)), '_blank')
    return ''
  },
  [CHANNELS.app.revealPath]: () => undefined,
  [CHANNELS.app.window]: () => undefined,
  [CHANNELS.app.windowState]: () => ({ maximized: true, fullscreen: true, focused: true }),
  [CHANNELS.app.devtools]: () => undefined,
  [CHANNELS.app.relaunch]: () => App.exitApp(),
  [CHANNELS.app.quit]: () => App.exitApp(),
  [CHANNELS.app.checkUpdate]: async () => {
    const current = '0.5.3-android'
    try {
      const response = await fetch('https://api.github.com/repos/muzirin/StudyInGal/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      if (!response.ok) return { ok: false, current, latest: null, hasUpdate: false, url: null, message: `GitHub ${response.status}` }
      const data = (await response.json()) as { tag_name?: string; html_url?: string }
      const latest = (data.tag_name ?? '').replace(/^v/, '')
      const parts = (value: string): number[] => value.split('.').map((part) => Number.parseInt(part, 10) || 0)
      const [a, b] = [parts(latest), parts(current)]
      let hasUpdate = false
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        if ((a[index] ?? 0) > (b[index] ?? 0)) {
          hasUpdate = true
          break
        }
        if ((a[index] ?? 0) < (b[index] ?? 0)) break
      }
      return { ok: true, current, latest: data.tag_name ?? latest, hasUpdate, url: data.html_url ?? null, message: hasUpdate ? '发现新版本' : '已是最新版本' }
    } catch (error) {
      return { ok: false, current, latest: null, hasUpdate: false, url: null, message: (error as Error).message }
    }
  },

  /* dialogs */
  [CHANNELS.dialogs.pickFiles]: async (payload) => {
    const files = await pickViaInput(acceptFromFilters(payload.filters as never), false, payload.multi !== false)
    return files.map((file) => {
      const key = `mobile-file:${fileSeq++}`
      fileRegistry.set(key, file)
      return key
    })
  },
  [CHANNELS.dialogs.pickDirectory]: async () => {
    const files = await pickViaInput('*/*', true, true)
    if (files.length === 0) return null
    const key = `mobile-dir:${fileSeq++}`
    dirRegistry.set(key, files)
    return key
  },
  [CHANNELS.dialogs.saveFile]: async (payload) => {
    const name = String(payload.defaultPath ?? 'export.txt').split(/[\\/]/).pop() ?? 'export.txt'
    return `exports/${name}`
  },

  /* settings */
  [CHANNELS.settings.get]: async () => {
    const settings = await store.getSettings()
    // 移动端首次运行：默认开触屏大按钮，导航用底部条更顺手
    const stored = await readKey<Record<string, unknown>>('settings.json', {})
    if (!stored || Object.keys(stored).length === 0) {
      return store.patchSettings({
        theme: { ...settings.theme, touchOptimized: true, radius: 10 },
        nav: { ...settings.nav, pinned: ['dashboard', 'library-paper', 'companion', 'galgame'] }
      })
    }
    return settings
  },
  [CHANNELS.settings.update]: (payload) => store.patchSettings(payload),
  [CHANNELS.settings.reset]: () => store.resetSettings(),

  /* library */
  [CHANNELS.library.snapshot]: async (payload) => (await store.readLibrary())[payload.kind as 'paper' | 'textbook'],
  [CHANNELS.library.import]: async (payload) => {
    const kind = payload.kind as 'paper' | 'textbook'
    const created: LibraryNode[] = []
    const now = Date.now()
    const paths = (payload.paths as string[]) ?? []
    for (const path of paths) {
      const dirFiles = dirRegistry.get(path)
      if (dirFiles && dirFiles.length > 0) {
        const chapters = dirFiles
          .filter((file) => ['.md', '.markdown', '.tex', '.latex', '.txt'].includes(extname(file.name)))
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }))
        const stored: { ref: string; title: string }[] = []
        for (const file of chapters) {
          const ref = await docs.importFile(file, file.name)
          stored.push({ ref, title: stripExtension(basename(file.name)) })
        }
        if (stored.length === 0) continue
        const folderTitle = stripExtension(basename(dirFiles[0].webkitRelativePath || dirFiles[0].name)) || '教材文件夹'
        created.push({
          id: newId('node'),
          kind,
          title: folderTitle,
          authors: [],
          abstract: '',
          tags: (payload.tags as string[]) ?? [],
          folderId: (payload.folderId as string) ?? null,
          seriesId: (payload.seriesId as string) ?? null,
          categoryId: (payload.categoryId as string) ?? null,
          path: stored[0].ref,
          format: 'folder',
          sizeBytes: 0,
          createdAt: now,
          updatedAt: now,
          favorite: false,
          readingProgress: 0,
          lastOpenedAt: null,
          ocrStatus: 'none',
          chapters: stored.map((item, index) => ({ id: `ch-${index}`, title: item.title, path: item.ref, order: index })),
          meta: {}
        })
        continue
      }
      const file = fileRegistry.get(path)
      if (!file) continue
      const format = docs.detectFormat(file.name)
      const ref = await docs.importFile(file, file.name)
      created.push({
        id: newId('node'),
        kind,
        title: stripExtension(basename(file.name)),
        authors: [],
        abstract: '',
        tags: (payload.tags as string[]) ?? [],
        folderId: (payload.folderId as string) ?? null,
        seriesId: (payload.seriesId as string) ?? null,
        categoryId: (payload.categoryId as string) ?? null,
        path: ref,
        format,
        sizeBytes: file.size,
        createdAt: now,
        updatedAt: now,
        favorite: false,
        readingProgress: 0,
        lastOpenedAt: null,
        ocrStatus: 'none',
        chapters: [],
        meta: {}
      })
    }
    await store.updateLibrary((db) => {
      db[kind] = { ...db[kind], nodes: [...created, ...db[kind].nodes] }
    })
    return created
  },
  [CHANNELS.library.remove]: async (payload) => {
    await store.updateLibrary((db) => {
      const kind = payload.kind as 'paper' | 'textbook'
      db[kind] = { ...db[kind], nodes: db[kind].nodes.filter((node) => node.id !== payload.id) }
    })
  },
  [CHANNELS.library.update]: async (payload) => {
    let updated: LibraryNode | null = null
    await store.updateLibrary((db) => {
      const kind = payload.kind as 'paper' | 'textbook'
      db[kind] = {
        ...db[kind],
        nodes: db[kind].nodes.map((node) => {
          if (node.id !== payload.id) return node
          updated = { ...node, ...(payload.patch as Partial<LibraryNode>), id: node.id, updatedAt: Date.now() }
          return updated
        })
      }
    })
    return updated
  },
  [CHANNELS.library.read]: async (payload) => {
    const library = await store.readLibrary()
    const found = store.findNodeIn(library, String(payload.nodeId))
    if (!found) throw new Error('文献不存在')
    const document = await docs.readDocument(found.node)
    await addHistory({
      kind: found.kind,
      title: found.node.title,
      subtitle: `${document.format.toUpperCase()} · ${found.kind === 'paper' ? '论文' : '教材'}`,
      refId: found.node.id,
      route: `/reader/${found.kind}/${found.node.id}`
    })
    return document
  },
  [CHANNELS.library.write]: async (payload) => {
    const library = await store.readLibrary()
    const found = store.findNodeIn(library, String(payload.nodeId))
    if (!found) throw new Error('文献不存在')
    await docs.writeDocument(found.node, String(payload.content), payload.targetPath as string | undefined)
    await store.updateLibrary((db) => {
      db[found.kind] = { ...db[found.kind], nodes: db[found.kind].nodes.map((node) => (node.id === found.node.id ? { ...node, updatedAt: Date.now() } : node)) }
    })
  },
  [CHANNELS.library.merge]: async (payload) => {
    const library = await store.readLibrary()
    const found = store.findNodeIn(library, String(payload.nodeId))
    if (!found) throw new Error('文献不存在')
    return docs.mergeNode(found.node)
  },
  [CHANNELS.library.mergeExport]: async (payload) => {
    const library = await store.readLibrary()
    const found = store.findNodeIn(library, String(payload.nodeId))
    if (!found) throw new Error('文献不存在')
    const merged = await docs.mergeNode(found.node)
    const target = String(payload.target)
    await Filesystem.writeFile({ path: `exports/${basename(target)}`, data: merged.markdown, encoding: Encoding.UTF8, recursive: true })
    return target
  },
  [CHANNELS.library.chapters]: async (payload) => {
    const library = await store.readLibrary()
    const found = store.findNodeIn(library, String(payload.nodeId))
    return found?.node.chapters ?? []
  },
  [CHANNELS.library.ocr]: () => unsupported('本地 OCR'),
  [CHANNELS.library.ocrText]: () => ({ exists: false, text: '' }),
  [CHANNELS.library.createFolder]: async (payload) => {
    const folder = { id: newId('folder'), kind: payload.kind as 'paper' | 'textbook', name: String(payload.name), parentId: (payload.parentId as string) ?? null }
    await store.updateLibrary((db) => {
      db[folder.kind] = { ...db[folder.kind], folders: [...db[folder.kind].folders, folder] }
    })
    return folder
  },
  [CHANNELS.library.createSeries]: async (payload) => {
    const series = { id: newId('series'), kind: payload.kind as 'paper' | 'textbook', name: String(payload.name), description: String(payload.description ?? '') }
    await store.updateLibrary((db) => {
      db[series.kind] = { ...db[series.kind], series: [...db[series.kind].series, series] }
    })
    return series
  },
  [CHANNELS.library.createCategory]: async (payload) => {
    const category = { id: newId('cat'), kind: payload.kind as 'paper' | 'textbook', name: String(payload.name), color: String(payload.color ?? '') }
    await store.updateLibrary((db) => {
      db[category.kind] = { ...db[category.kind], categories: [...db[category.kind].categories, category] }
    })
    return category
  },
  [CHANNELS.library.createTag]: async (payload) => {
    const tag = { id: newId('tag'), name: String(payload.name), color: String(payload.color ?? '') }
    await store.updateLibrary((db) => {
      for (const kind of ['paper', 'textbook'] as const) {
        if (!db[kind].tags.some((item) => item.name === tag.name)) db[kind] = { ...db[kind], tags: [...db[kind].tags, tag] }
      }
    })
    return tag
  },
  [CHANNELS.library.removeMeta]: async (payload) => {
    await store.updateLibrary((db) => {
      const kind = payload.kind as 'paper' | 'textbook'
      const snapshot = db[kind]
      const id = String(payload.id)
      if (payload.meta === 'folder') db[kind] = { ...snapshot, folders: snapshot.folders.filter((item) => item.id !== id) }
      else if (payload.meta === 'series') db[kind] = { ...snapshot, series: snapshot.series.filter((item) => item.id !== id) }
      else if (payload.meta === 'category') db[kind] = { ...snapshot, categories: snapshot.categories.filter((item) => item.id !== id) }
      else db[kind] = { ...snapshot, tags: snapshot.tags.filter((item) => item.id !== id) }
    })
  },

  /* cloud（移动端仅 WebDAV） */
  [CHANNELS.cloud.list]: () => store.listMounts(),
  [CHANNELS.cloud.upsert]: async (payload) => {
    const list = await store.listMounts()
    const input = payload as Partial<CloudMount> & { kind: CloudMount['kind'] }
    if (input.kind !== 'webdav') unsupported('SMB / 夸克网盘 / 本地目录挂载（移动端仅支持 WebDAV）')
    if (input.id) {
      const index = list.findIndex((item) => item.id === input.id)
      if (index >= 0) {
        const merged = { ...list[index], ...input, id: list[index].id }
        list[index] = merged
        await store.writeMounts(list)
        return merged
      }
    }
    const created: CloudMount = {
      id: input.id ?? newId('mount'),
      name: input.name ?? 'WebDAV',
      kind: 'webdav',
      enabled: input.enabled ?? true,
      remotePath: input.remotePath ?? '/StudyInGal',
      config: input.config ?? {},
      status: 'unknown',
      lastError: null,
      lastSyncAt: null,
      readOnly: input.readOnly ?? false
    }
    await store.writeMounts([...list, created])
    return created
  },
  [CHANNELS.cloud.remove]: async (payload) => {
    await store.writeMounts((await store.listMounts()).filter((item) => item.id !== payload.id))
  },
  [CHANNELS.cloud.test]: async (payload) => {
    const mount = (await store.listMounts()).find((item) => item.id === payload.id)
    if (!mount) return { ok: false, message: '挂载不存在' }
    try {
      await webdavList(mount, mount.remotePath)
      return { ok: true, message: '连接成功' }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  },
  [CHANNELS.cloud.listRemote]: async (payload) => {
    const mount = (await store.listMounts()).find((item) => item.id === payload.id)
    if (!mount) throw new Error('挂载不存在')
    return webdavList(mount, String(payload.path ?? '/'))
  },
  [CHANNELS.cloud.sync]: () => unsupported('整库同步（移动端可手动上传/下载单个存档）'),
  [CHANNELS.cloud.upload]: async (payload) => {
    const mount = (await store.listMounts()).find((item) => item.id === payload.id)
    if (!mount) throw new Error('挂载不存在')
    const config = mount.config as unknown as WebdavConfig
    const data = await Filesystem.readFile({ path: String(payload.localPath) })
    const buffer = typeof data.data === 'string' ? Uint8Array.from(atob(data.data), (char) => char.charCodeAt(0)) : data.data
    const response = await fetch(webdavUrl(config, String(payload.remotePath)), {
      method: 'PUT',
      headers: { ...webdavHeaders(config), 'Content-Type': 'application/octet-stream' },
      body: buffer as unknown as BodyInit
    })
    if (!response.ok) throw new Error(`WebDAV PUT ${response.status}`)
  },
  [CHANNELS.cloud.download]: async (payload) => {
    const mount = (await store.listMounts()).find((item) => item.id === payload.id)
    if (!mount) throw new Error('挂载不存在')
    const response = await fetch(webdavUrl(mount.config as unknown as WebdavConfig, String(payload.remotePath)), { headers: webdavHeaders(mount.config as unknown as WebdavConfig) })
    if (!response.ok) throw new Error(`WebDAV GET ${response.status}`)
    const base64 = await response.arrayBuffer().then((buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))))
    await Filesystem.writeFile({ path: String(payload.localPath), data: base64, recursive: true })
  },
  [CHANNELS.cloud.log]: () => [],

  /* ai */
  [CHANNELS.ai.listProviders]: async () => (await store.getSettings()).ai.providers,
  [CHANNELS.ai.saveProvider]: async (payload) => {
    const settings = await store.getSettings()
    const providers = settings.ai.providers.filter((item) => item.id !== (payload as { id: string }).id)
    await store.patchSettings({ ai: { ...settings.ai, providers: [...providers, payload] } })
    return (await store.getSettings()).ai.providers
  },
  [CHANNELS.ai.removeProvider]: async (payload) => {
    const settings = await store.getSettings()
    const routing: Record<string, string | null> = { ...settings.ai.routing }
    const targetId = String(payload.id)
    for (const key of Object.keys(routing)) if (routing[key] === targetId) routing[key] = null
    await store.patchSettings({
      ai: { ...settings.ai, providers: settings.ai.providers.filter((item) => item.id !== targetId), routing }
    })
    return (await store.getSettings()).ai.providers
  },
  [CHANNELS.ai.setRouting]: async (payload) => {
    const settings = await store.getSettings()
    await store.patchSettings({ ai: { ...settings.ai, routing: { ...settings.ai.routing, ...(payload.routing as object) } } })
  },
  [CHANNELS.ai.test]: (payload) => ai.testProvider(String(payload.id)),
  [CHANNELS.ai.chat]: (payload) => ai.chat(payload as never),
  [CHANNELS.ai.generateScript]: async (payload) => {
    const options = payload as { sourceId: string }
    const library = await store.readLibrary()
    const found = store.findNodeIn(library, options.sourceId)
    if (!found) throw new Error('找不到源文献')
    const text = await docs.readNodeText(found.node)
    const script = await ai.generateScript(options as never, text)
    await addHistory({ kind: 'script', title: script.title, subtitle: `${script.lines.length} 行 · ${script.questions.length} 题`, refId: script.id, route: `/galgame/${script.id}` })
    return script
  },

  /* characters */
  [CHANNELS.characters.list]: () => store.listCharacters(),
  [CHANNELS.characters.upsert]: (payload) => store.upsertCharacter(payload as never),
  [CHANNELS.characters.remove]: (payload) => store.removeCharacter(String(payload.id)),
  [CHANNELS.characters.import]: () => unsupported('角色卡文件导入（可用「导出」再手动放置）'),
  [CHANNELS.characters.export]: async (payload) => {
    const character = (await store.listCharacters()).find((item) => item.id === payload.id)
    if (!character) return null
    const path = `exports/${character.id}.json`
    await Filesystem.writeFile({ path, data: JSON.stringify(character, null, 2), encoding: Encoding.UTF8, recursive: true })
    return path
  },

  /* gal */
  [CHANNELS.gal.listScripts]: () => store.listScripts(),
  [CHANNELS.gal.getScript]: (payload) => store.getScript(String(payload.id)),
  [CHANNELS.gal.saveScript]: (payload) => store.saveScript(payload as never),
  [CHANNELS.gal.deleteScript]: (payload) => store.deleteScript(String(payload.id)),
  [CHANNELS.gal.exportSave]: async (payload) => {
    const script = await store.getScript(String(payload.scriptId))
    if (!script) throw new Error('剧本不存在')
    const save = {
      id: newId('save'),
      title: script.title,
      kind: script.sourceKind,
      sourceId: script.sourceId,
      scriptId: script.id,
      characterId: script.characterId,
      progress: 0,
      linesRead: 0,
      totalLines: script.lines.length,
      favorite: false,
      tags: [],
      storage: 'local' as const,
      mountId: null,
      dataPath: `exports/${script.id}.save.json`,
      coverPath: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastPlayedAt: Date.now()
    }
    await Filesystem.writeFile({ path: save.dataPath, data: JSON.stringify({ save, script }, null, 2), encoding: Encoding.UTF8, recursive: true })
    await store.writeArchive([save, ...(await store.listArchive())])
    return save
  },
  [CHANNELS.gal.exportMarkdown]: async (payload) => {
    const script = await store.getScript(String(payload.id))
    if (!script) throw new Error('剧本不存在')
    const markdown = [
      `# ${script.title}`,
      '',
      ...script.lines.map((item) => (item.speaker === 'narration' ? `*（${item.text}）*` : `**${item.speaker === 'user' ? '我' : '角色'}**：${item.text}`)),
      '',
      '## 随堂题目',
      ...script.questions.map((item, index) => `${index + 1}. ${item.question}\n   - 答案：${item.options[item.answerIndex] ?? ''}\n   - ${item.explanation}`)
    ].join('\n')
    await Filesystem.writeFile({ path: `exports/${basename(String(payload.target))}`, data: markdown, encoding: Encoding.UTF8, recursive: true })
    return { path: String(payload.target), lines: script.lines.length }
  },
  [CHANNELS.gal.seedExamples]: () => ({ added: 0, total: 0 }),

  /* archive */
  [CHANNELS.archive.list]: async () => (await store.listArchive()).sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt)),
  [CHANNELS.archive.upsert]: async (payload) => {
    const list = await store.listArchive()
    const input = payload as Partial<import('@shared/types').ArchiveSave>
    const now = Date.now()
    if (input.id) {
      const index = list.findIndex((item) => item.id === input.id)
      if (index >= 0) {
        const merged = { ...list[index], ...input, id: list[index].id, updatedAt: now }
        list[index] = merged
        await store.writeArchive(list)
        return merged
      }
    }
    const created = {
      id: input.id ?? newId('save'),
      title: input.title ?? '未命名存档',
      kind: input.kind ?? 'paper',
      sourceId: input.sourceId ?? '',
      scriptId: input.scriptId ?? null,
      characterId: input.characterId ?? null,
      progress: input.progress ?? 0,
      linesRead: input.linesRead ?? 0,
      totalLines: input.totalLines ?? 0,
      favorite: input.favorite ?? false,
      tags: input.tags ?? [],
      storage: input.storage ?? 'local',
      mountId: input.mountId ?? null,
      dataPath: input.dataPath ?? '',
      coverPath: input.coverPath ?? null,
      createdAt: now,
      updatedAt: now,
      lastPlayedAt: now
    }
    await store.writeArchive([created, ...list])
    return created
  },
  [CHANNELS.archive.remove]: async (payload) => {
    await store.writeArchive((await store.listArchive()).filter((item) => item.id !== payload.id))
  },
  [CHANNELS.archive.updateProgress]: async (payload) => {
    const list = await store.listArchive()
    const index = list.findIndex((item) => item.id === payload.id)
    if (index < 0) return null
    list[index] = { ...list[index], progress: Number(payload.progress), linesRead: Number(payload.linesRead), lastPlayedAt: Date.now(), updatedAt: Date.now() }
    await store.writeArchive(list)
    return list[index]
  },

  /* schedule */
  [CHANNELS.schedule.list]: async () => (await store.listSchedule()).sort((a, b) => a.start - b.start),
  [CHANNELS.schedule.upsert]: async (payload) => {
    const list = await store.listSchedule()
    const input = payload as Partial<import('@shared/types').ScheduleEvent>
    if (input.id) {
      const index = list.findIndex((item) => item.id === input.id)
      if (index >= 0) {
        const merged = { ...list[index], ...input, id: list[index].id }
        list[index] = merged
        await store.writeSchedule(list)
        return merged
      }
    }
    const created = {
      id: input.id ?? newId('evt'),
      kind: input.kind ?? 'task',
      title: input.title ?? '新事件',
      description: input.description ?? '',
      start: input.start ?? Date.now(),
      end: input.end ?? null,
      allDay: input.allDay ?? false,
      location: input.location ?? '',
      repeat: input.repeat ?? 'none',
      weekdays: input.weekdays ?? [],
      color: input.color ?? '',
      done: input.done ?? false,
      tags: input.tags ?? [],
      reminderMinutes: input.reminderMinutes ?? null
    }
    await store.writeSchedule([...list, created])
    return created
  },
  [CHANNELS.schedule.remove]: async (payload) => {
    await store.writeSchedule((await store.listSchedule()).filter((item) => item.id !== payload.id))
  },
  [CHANNELS.schedule.importIcs]: () => unsupported('ICS 导入'),
  [CHANNELS.schedule.exportIcs]: () => unsupported('ICS 导出'),

  /* notes */
  [CHANNELS.notes.list]: async (payload) =>
    (await store.listNotes()).filter((item) => (payload.nodeId ? item.nodeId === payload.nodeId : true)).sort((a, b) => b.updatedAt - a.updatedAt),
  [CHANNELS.notes.upsert]: async (payload) => {
    const list = await store.listNotes()
    const input = payload as Partial<import('@shared/types').NoteEntry> & { nodeId: string }
    const now = Date.now()
    if (input.id) {
      const index = list.findIndex((item) => item.id === input.id)
      if (index >= 0) {
        const merged = { ...list[index], ...input, id: list[index].id, updatedAt: now }
        list[index] = merged
        await store.writeNotes(list)
        return merged
      }
    }
    const created = {
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
    await store.writeNotes([created, ...list])
    return created
  },
  [CHANNELS.notes.remove]: async (payload) => {
    const list = (await store.listNotes()).filter((item) => item.id !== payload.id)
    await store.writeNotes(list)
    return list
  },
  [CHANNELS.notes.clear]: async (payload) => {
    const list = (await store.listNotes()).filter((item) => item.nodeId !== payload.nodeId)
    await store.writeNotes(list)
    return list
  },
  [CHANNELS.notes.export]: async (payload) => {
    const list = (await store.listNotes()).filter((item) => (payload.nodeId ? item.nodeId === payload.nodeId : true))
    const markdown = [`# 笔记导出`, '', `共 ${list.length} 条`, '', ...list.map((note) => `## ${note.title}\n\n${note.content}`)].join('\n')
    await Filesystem.writeFile({ path: `exports/${basename(String(payload.target))}`, data: markdown, encoding: Encoding.UTF8, recursive: true })
    return { path: String(payload.target), count: list.length }
  },

  /* conversations */
  [CHANNELS.conversations.list]: async (payload) =>
    (await store.listConversations()).filter((item) => (payload.characterId ? item.characterId === payload.characterId : true)).sort((a, b) => b.updatedAt - a.updatedAt),
  [CHANNELS.conversations.append]: async (payload) => {
    const input = payload as { conversationId?: string; characterId: string; message: { role: 'user' | 'assistant'; content: string; emotion?: string } }
    const list = await store.listConversations()
    const now = Date.now()
    let conversation = input.conversationId ? list.find((item) => item.id === input.conversationId) : undefined
    if (!conversation) {
      conversation = {
        id: input.conversationId ?? newId('conv'),
        characterId: input.characterId,
        title: input.message.role === 'user' ? input.message.content.slice(0, 24) : '新的对话',
        sourceId: '',
        messages: [],
        createdAt: now,
        updatedAt: now
      }
      list.unshift(conversation)
    }
    conversation.messages = [...conversation.messages, { id: newId('msg'), role: input.message.role, content: input.message.content, emotion: input.message.emotion ?? 'neutral', at: now }]
    conversation.updatedAt = now
    if (conversation.title === '新的对话' && input.message.role === 'assistant') conversation.title = input.message.content.slice(0, 24)
    await store.writeConversations(list.slice(0, 200))
    return conversation
  },
  [CHANNELS.conversations.rename]: async (payload) => {
    const list = (await store.listConversations()).map((item) => (item.id === payload.id ? { ...item, title: String(payload.title), updatedAt: Date.now() } : item))
    await store.writeConversations(list)
    return list
  },
  [CHANNELS.conversations.remove]: async (payload) => {
    const list = (await store.listConversations()).filter((item) => item.id !== payload.id)
    await store.writeConversations(list)
    return list
  },

  /* history */
  [CHANNELS.history.list]: async (payload) => {
    const list = (await store.listHistory()).sort((a, b) => b.at - a.at)
    return payload.limit ? list.slice(0, Number(payload.limit)) : list
  },
  [CHANNELS.history.add]: async (payload) => {
    await addHistory(payload as never)
    return store.listHistory()
  },
  [CHANNELS.history.remove]: async (payload) => {
    const list = (await store.listHistory()).filter((item) => item.id !== payload.id)
    await store.writeHistory(list)
    return list
  },
  [CHANNELS.history.clear]: async () => {
    await store.writeHistory([])
    emit({ type: 'history-changed', payload: { reason: 'clear' } })
  },

  /* stats（番茄钟） */
  [CHANNELS.stats.addFocus]: async (payload) => {
    const list = await store.listFocus()
    const entry = { id: newId('focus'), at: Date.now(), minutes: Math.max(0, Math.round(Number(payload.minutes) || 0)), kind: (payload.kind as 'work' | 'break') ?? 'work' }
    await store.writeFocus([entry, ...list].slice(0, 5000))
    return summary((await store.listFocus()).filter((item) => item.kind === 'work'))
  },
  [CHANNELS.stats.focusSummary]: async () => summary((await store.listFocus()).filter((item) => item.kind === 'work')),

  /* quiz */
  [CHANNELS.quiz.generate]: async (payload) => {
    const input = payload as { sourceId?: string; scriptId?: string | null; contextText?: string; title?: string; count?: number }
    let text = input.contextText ?? ''
    if (!text && input.sourceId) {
      const library = await store.readLibrary()
      const found = store.findNodeIn(library, input.sourceId)
      if (found) text = await docs.readNodeText(found.node)
    }
    return ai.generateQuestions(input, text)
  },
  [CHANNELS.quiz.generateForScript]: (payload) => ai.generateForScript(String(payload.scriptId), Number(payload.count ?? 6)),
  [CHANNELS.quiz.evaluate]: (payload) => ai.evaluateAnswer((payload as { question: QuizQuestion }).question, String((payload as { answer: string }).answer)),
  [CHANNELS.quiz.list]: async (payload) => (await store.listAttempts()).filter((item) => (payload.sourceId ? item.sourceId === payload.sourceId : true)).sort((a, b) => b.at - a.at),
  [CHANNELS.quiz.stats]: (payload) => ai.stats({ sourceId: payload.sourceId as string | undefined, scriptId: payload.scriptId as string | undefined }),

  /* assets（随包素材） */
  [CHANNELS.assets.list]: async () => {
    try {
      const response = await fetch('assets-bundled/manifest.json')
      if (!response.ok) return { backgrounds: [], sprites: [], defaultSprite: null }
      const manifest = (await response.json()) as { backgrounds?: { id: string; name: string; file: string }[]; sprites?: { id: string; name: string; file: string }[]; defaultSprite?: string }
      const prefix = 'assets-bundled'
      return {
        backgrounds: (manifest.backgrounds ?? []).map((item) => ({ ...item, path: `${prefix}/${item.file}` })),
        sprites: (manifest.sprites ?? []).map((item) => ({ ...item, path: `${prefix}/${item.file}` })),
        defaultSprite: manifest.defaultSprite ?? null
      }
    } catch {
      return { backgrounds: [], sprites: [], defaultSprite: null }
    }
  },

  /* errors */
  [CHANNELS.errors.capture]: async (payload) => {
    const input = payload as { message: string; stack?: string; context?: string; extra?: Record<string, unknown> }
    const captured = {
      id: newId('err'),
      message: input.message || '未知错误',
      stack: input.stack ?? '',
      context: input.context ?? '',
      appVersion: '0.5.3-android',
      platform: `android-${Capacitor.getPlatform()}`,
      timestamp: Date.now(),
      extra: input.extra ?? {}
    }
    const list = await store.listErrors()
    await store.writeErrors([captured, ...list].slice(0, 200))
    return captured
  },
  [CHANNELS.errors.list]: () => store.listErrors(),
  [CHANNELS.errors.clear]: () => store.writeErrors([]),
  [CHANNELS.errors.draftIssue]: async (payload) => {
    const list = await store.listErrors()
    const error = (payload.id ? list.find((item) => item.id === payload.id) : list[0]) ?? null
    const title = error ? `[Bug] ${error.message.slice(0, 80)}` : '[Bug] 问题反馈'
    const body = ['## 问题描述', '', '## 复现步骤', '1. ', '', '## 环境', `- Android ${Capacitor.getPlatform()}`, error ? `\n\`\`\`\n${error.stack || error.message}\n\`\`\`` : ''].join('\n')
    return { title, body, url: `${GITHUB_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug` }
  },
  [CHANNELS.errors.openIssue]: async (payload) => {
    const draft = (await handlers[CHANNELS.errors.draftIssue](payload as Record<string, unknown>)) as { url: string }
    window.open(draft.url, '_blank')
  },

  /* workshop */
  [CHANNELS.workshop.list]: () => store.listWorkshop(),
  [CHANNELS.workshop.export]: () => unsupported('资源包打包'),
  [CHANNELS.workshop.validate]: () => unsupported('资源包校验'),
  [CHANNELS.workshop.install]: () => unsupported('资源包安装'),
  [CHANNELS.workshop.exportConfig]: async (payload) => {
    const settings = await store.getSettings()
    const payloadJson = {
      schemaVersion: 1,
      app: 'StudyInGal',
      exportedAt: Date.now(),
      settings: { ...settings, ai: { ...settings.ai, providers: settings.ai.providers.map((provider) => ({ ...provider, apiKey: provider.apiKey ? '__REDACTED__' : '' })) } },
      characters: await store.listCharacters(),
      mounts: (await store.listMounts()).map((mount) => ({ ...mount, config: { ...mount.config, password: '__REDACTED__' } }))
    }
    const text = JSON.stringify(payloadJson, null, 2)
    await Filesystem.writeFile({ path: `exports/${basename(String(payload.target))}`, data: text, encoding: Encoding.UTF8, recursive: true })
    return { path: String(payload.target), bytes: text.length, redacted: true }
  },

  /* 移动端不支持的能力 */
  [CHANNELS.terminal.create]: () => unsupported('内嵌终端'),
  [CHANNELS.terminal.write]: () => unsupported('内嵌终端'),
  [CHANNELS.terminal.resize]: () => undefined,
  [CHANNELS.terminal.kill]: () => undefined,
  [CHANNELS.terminal.list]: () => [],
  [CHANNELS.playground.runtimes]: () => [],
  [CHANNELS.playground.run]: () => unsupported('代码练习场'),
  [CHANNELS.playground.status]: () => ({ installed: false, installPath: '' }),
  [CHANNELS.playground.install]: () => unsupported('代码练习场'),
  [CHANNELS.xuexitong.status]: () => ({ configured: false, baseUrl: '', running: false }),
  [CHANNELS.xuexitong.launch]: () => unsupported('学习通托管'),
  [CHANNELS.xuexitong.submit]: () => unsupported('学习通托管'),
  [CHANNELS.xuexitong.config]: async (payload) => {
    const settings = await store.getSettings()
    return store.patchSettings({ xuexitong: { ...settings.xuexitong, ...(payload as object) } })
  },
  [CHANNELS.sync.status]: () => ({ running: false, lastRun: null, mountId: null }),
  [CHANNELS.sync.run]: () => []
}

function summary(sessions: { at: number; minutes: number }[]) {
  const dayKey = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10)
  const today = dayKey(Date.now())
  const byDay = new Map<string, number>()
  for (const session of sessions) byDay.set(dayKey(session.at), (byDay.get(dayKey(session.at)) ?? 0) + session.minutes)
  const last7Days: { date: string; minutes: number }[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    const key = dayKey(date.getTime())
    last7Days.push({ date: key, minutes: byDay.get(key) ?? 0 })
  }
  let streakDays = 0
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    if ((byDay.get(dayKey(date.getTime())) ?? 0) > 0) streakDays += 1
    else if (offset > 0) break
  }
  return {
    todayMinutes: byDay.get(today) ?? 0,
    todaySessions: sessions.filter((session) => dayKey(session.at) === today).length,
    totalMinutes: sessions.reduce((acc, session) => acc + session.minutes, 0),
    totalSessions: sessions.length,
    streakDays,
    last7Days
  }
}

/* --------------------------------- 桥对象 --------------------------------- */

export const mobileBridge = {
  invoke(channel: string, payload?: unknown): Promise<unknown> {
    if (!allowedChannels.has(channel)) return Promise.reject(new Error(`StudyInGal: 未授权的通道 ${channel}`))
    const handler = handlers[channel]
    if (!handler) return Promise.reject(new Error(`移动端尚未实现该通道：${channel}`))
    return Promise.resolve()
      .then(() => handler((payload ?? {}) as Record<string, unknown>))
      .catch((error: unknown) => {
        void handlers[CHANNELS.errors.capture]({
          message: (error as Error).message,
          stack: (error as Error).stack,
          context: channel
        })
        throw error
      })
  },
  on(listener: (event: StudyEvent) => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  pathForFile(file: File): string {
    const key = `mobile-file:${fileSeq++}`
    fileRegistry.set(key, file)
    return key
  },
  platform: 'android',
  versions: { electron: '—', chrome: navigator.userAgent, node: '—' }
}

/** 如果没有 Electron 提供的 window.study，就装上移动端实现。 */
export function installMobileBridge(): void {
  const target = window as unknown as { study?: unknown }
  if (target.study) return
  target.study = mobileBridge
}

export { Preferences, Filesystem, Directory, writeKey, readKey, deepMerge, base64ToText, textToBase64, GITHUB_URL, DEFAULT_SETTINGS }
