import type { ChapterRef, GalExcerpt } from '@shared/types'

/**
 * 归一化路径，用于跨来源比较章节路径（目录列表可能来自库索引、阅读器或另一个端）。
 * - 统一分隔符，去掉末尾斜杠
 * - Windows 路径（含盘符/UNC）按大小写不敏感比较
 */
export function normalizePathKey(path: string): string {
  const unified = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  const windowsLike = /^[a-zA-Z]:\//.test(unified) || unified.startsWith('//')
  return windowsLike ? unified.toLowerCase() : unified
}

/**
 * 分册教材里挑出要取材的章节。
 * 传空 path（用户选择「整本合并」）或路径已失效时返回 null，由调用方决定怎么处理。
 */
export function pickChapter(chapters: ChapterRef[], path?: string): ChapterRef | null {
  if (!path) return null
  const target = normalizePathKey(path)
  return chapters.find((chapter) => normalizePathKey(chapter.path) === target) ?? null
}

/** 文件是否位于给定目录之内（避免把任意路径当成章节去读） */
export function isInsideFolder(file: string, folder: string): boolean {
  if (!folder.trim()) return false
  const child = normalizePathKey(file)
  const parent = normalizePathKey(folder)
  return child !== parent && child.startsWith(`${parent}/`)
}

/** 取路径的父目录（无分隔符时返回空串） */
export function parentPath(path: string): string {
  const unified = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const index = unified.lastIndexOf('/')
  return index > 0 ? path.slice(0, path.length - (unified.length - index)) : ''
}

/**
 * 判断章节文件是否允许读取。
 * 教材目录本身不一定可靠：移动端分册节点的 path 是「选择器句柄」而不是目录，
 * 所以还允许「已知章节所在目录」（同一本教材的章节通常同目录）。
 */
export function isChapterPathAllowed(file: string, folder: string, knownChapters: ChapterRef[]): boolean {
  const anchors = [folder, ...knownChapters.map((chapter) => parentPath(chapter.path))].filter((anchor) => anchor.trim())
  return anchors.some((anchor) => isInsideFolder(file, anchor))
}

/**
 * 单文件按字符区间 [start, end) 取材，越界会夹紧到文本范围内。
 * 未给区间时原样返回，便于沿用「整篇按深度预算截断」的旧行为。
 */
export function applyExcerpt(text: string, excerpt?: GalExcerpt): string {
  if (!excerpt || (excerpt.start === undefined && excerpt.end === undefined)) return text
  const start = Math.max(0, Math.min(excerpt.start ?? 0, text.length))
  const end = Math.max(start, Math.min(excerpt.end ?? text.length, text.length))
  return text.slice(start, end)
}
