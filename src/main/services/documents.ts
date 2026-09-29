import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  ChapterRef,
  DocumentContent,
  DocumentFormat,
  DocumentPreview,
  LibraryNode,
  MergedDocument,
  OcrResult
} from '@shared/types'
import { EDITABLE_EXTENSIONS } from '@shared/constants'

const TEXT_EXTENSIONS = new Set(EDITABLE_EXTENSIONS)
/**
 * 分册教材里被当作「章节」的扩展名。
 * 含 PDF/DOCX：它们同样能抽取纯文本（见 extractPlainText），
 * 若只认 Markdown/LaTeX，用户导入一个全是 PDF 的文件夹就会看到「空目录」。
 */
const CHAPTER_EXTENSIONS = new Set(['.md', '.markdown', '.tex', '.latex', '.txt', '.pdf', '.docx', '.doc'])

export function detectFormat(target: string, isDirectory: boolean): DocumentFormat {
  if (isDirectory) return 'folder'
  const ext = extname(target).toLowerCase()
  switch (ext) {
    case '.md':
    case '.markdown':
      return 'md'
    case '.tex':
    case '.latex':
      return 'latex'
    case '.pdf':
      return 'pdf'
    case '.doc':
      return 'doc'
    case '.docx':
      return 'docx'
    case '.txt':
      return 'txt'
    case '.html':
    case '.htm':
      return 'html'
    case '.epub':
      return 'epub'
    default:
      return 'other'
  }
}

export function isEditable(format: DocumentFormat): boolean {
  if (format === 'folder') return false
  const ext = format === 'latex' ? '.tex' : `.${format}`
  return EDITABLE_EXTENSIONS.includes(ext)
}

async function walkChapters(dir: string, depth = 0): Promise<string[]> {
  if (depth > 4) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walkChapters(full, depth + 1)))
    else if (CHAPTER_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(full)
  }
  return files.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }))
}

function headingTitle(content: string, fallback: string): string {
  const match = content.match(/^\s*(?:#{1,6}\s+(.+)|\\chapter\{(.+?)\}|\\section\{(.+?)\}|\\title\{(.+?)\})/m)
  const title = match?.[1] ?? match?.[2] ?? match?.[3] ?? match?.[4]
  return (title ?? fallback).trim()
}

async function stripChapterMarker(content: string): Promise<string> {
  return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').trim()
}

export async function detectChapters(node: LibraryNode): Promise<ChapterRef[]> {
  if (node.format !== 'folder') {
    return [{ id: `${node.id}:0`, title: node.title, path: node.path, order: 0 }]
  }
  const files = await walkChapters(node.path)
  const chapters: ChapterRef[] = []
  for (const [index, file] of files.entries()) {
    let title = basename(file, extname(file))
    try {
      const raw = await readFile(file, 'utf8')
      title = headingTitle(raw, title)
    } catch {
      /* keep filename */
    }
    chapters.push({ id: `${node.id}:${index}`, title, path: file, order: index })
  }
  return chapters
}

async function extractPlainText(target: string, format: DocumentFormat): Promise<string> {
  if (format === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const data = await readFile(target)
    const parser = new PDFParse({ data: new Uint8Array(data) })
    try {
      const result = await parser.getText()
      return result.text ?? ''
    } finally {
      await parser.destroy().catch(() => undefined)
    }
  }
  if (format === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ path: target })
    return result.value ?? ''
  }
  if (format === 'doc') {
    return `[StudyInGal] 旧版 .doc 需要先转换为 .docx 或 PDF 才能解析：${target}`
  }
  return readFile(target, 'utf8')
}

export async function readDocument(node: LibraryNode): Promise<DocumentContent> {
  const format = node.format
  if (format === 'folder') {
    const merged = await mergeNode(node)
    return {
      nodeId: node.id,
      format,
      text: merged.markdown,
      html: null,
      isBinary: false,
      editable: false
    }
  }
  const editable = EDITABLE_EXTENSIONS.includes(extname(node.path).toLowerCase())
  if (editable) {
    const text = await readFile(node.path, 'utf8')
    return { nodeId: node.id, format, text, html: null, isBinary: false, editable: true }
  }
  const text = await extractPlainText(node.path, format)
  return {
    nodeId: node.id,
    format,
    text,
    html: null,
    isBinary: format !== 'txt' && !text.startsWith('['),
    editable: false
  }
}

/** 读取任意路径的纯文本（按扩展名解析），供剧本生成按章节取材使用 */
export async function readPathText(target: string): Promise<string> {
  return stripChapterMarker(await extractPlainText(target, detectFormat(target, false)))
}

/** 单个文件超过这个大小就不做渲染视图（避免几十 MB 的 base64 在 IPC 上来回搬） */
const PREVIEW_MAX_BYTES = 80 * 1024 * 1024

/**
 * 渲染视图数据：不是「抽取文本」，而是让界面能把原始文档画出来。
 * - PDF：直接把原始字节交给前端（pdf.js 画到 canvas），不经过 OCR/文本抽取
 * - DOCX：用 mammoth 转成保留格式的 HTML
 * - DOC：老格式无法解析，返回原因让界面提示「先用外部程序转换」
 */
export async function renderPreview(node: LibraryNode): Promise<DocumentPreview> {
  if (node.format === 'pdf') {
    const info = await stat(node.path)
    if (info.isDirectory()) return { mode: 'none', reason: '这不是一个文件' }
    if (info.size > PREVIEW_MAX_BYTES) {
      return { mode: 'none', reason: `文件约 ${Math.round(info.size / 1024 / 1024)}MB，过大暂不渲染，可「外部打开」查看` }
    }
    const data = await readFile(node.path)
    return { mode: 'pdf', base64: data.toString('base64'), sizeBytes: info.size }
  }

  if (node.format === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ path: node.path })
    return { mode: 'html', html: result.value ?? '' }
  }

  return {
    mode: 'none',
    reason:
      node.format === 'doc'
        ? '旧版 .doc 无法渲染，请先转换成 .docx 或 PDF'
        : '该格式没有渲染视图，可切换到文本视图查看提取的内容'
  }
}

export async function writeDocument(node: LibraryNode, content: string, targetPath?: string): Promise<void> {
  const path = targetPath ?? node.path
  if (node.format === 'folder' && !targetPath) {
    throw new Error('文件夹节点需要指定要写入的章节文件')
  }
  if (!EDITABLE_EXTENSIONS.includes(extname(path).toLowerCase())) {
    throw new Error(`该格式不可直接编辑：${extname(path) || '未知'}`)
  }
  await writeFile(path, content, 'utf8')
}

export async function mergeNode(node: LibraryNode): Promise<MergedDocument> {
  const refs = node.format === 'folder' ? await detectChapters(node) : [{ id: `${node.id}:0`, title: node.title, path: node.path, order: 0 }]
  const chapters: MergedDocument['chapters'] = []
  for (const ref of refs) {
    let content = ''
    try {
      content = await stripChapterMarker(await extractPlainText(ref.path, detectFormat(ref.path, false)))
    } catch (error) {
      content = `> ⚠️ 无法读取该章节：${(error as Error).message}`
    }
    chapters.push({ title: ref.title, path: ref.path, content })
  }
  const sections = chapters.map((chapter, index) => `## ${index + 1}. ${chapter.title}\n\n${chapter.content}`)
  const markdown = [`# ${node.title}`, '', `> 自动合并视图（只读，不修改磁盘文件），共 ${chapters.length} 个章节。`, '', ...sections].join('\n\n')
  return { nodeId: node.id, title: node.title, chapters, markdown, mergedAt: Date.now() }
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

export async function runOcr(node: LibraryNode, language: string): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js')
  const targets: string[] = []
  if (node.format === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const data = await readFile(node.path)
    const parser = new PDFParse({ data: new Uint8Array(data) })
    try {
      const shots = await parser.getScreenshot({ imageDataUrl: true })
      for (const page of shots.pages ?? []) {
        if (page.dataUrl) targets.push(page.dataUrl)
      }
    } finally {
      await parser.destroy().catch(() => undefined)
    }
  } else {
    targets.push(node.path)
  }

  const worker = await createWorker(language || 'chi_sim+eng')
  try {
    const chunks: string[] = []
    for (const target of targets) {
      const result = await worker.recognize(target)
      chunks.push(result.data.text)
    }
    return { nodeId: node.id, text: chunks.join('\n\n'), engine: 'tesseract.js', finishedAt: Date.now() }
  } finally {
    await worker.terminate()
  }
}
