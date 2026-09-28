import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  ChapterRef,
  DocumentContent,
  DocumentFormat,
  LibraryNode,
  MergedDocument,
  OcrResult
} from '@shared/types'
import { EDITABLE_EXTENSIONS } from '@shared/constants'

const TEXT_EXTENSIONS = new Set(EDITABLE_EXTENSIONS)
const CHAPTER_EXTENSIONS = new Set(['.md', '.markdown', '.tex', '.latex', '.txt'])

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
