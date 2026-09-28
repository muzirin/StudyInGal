/**
 * 移动端的文档读取：文件保存在应用 Documents 目录（Capacitor Filesystem），
 * 支持 txt / md / tex / html 与「文件夹分册」的只读合并；PDF/DOCX 解析暂不支持。
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { extname } from '@renderer/platform/path'
import type { ChapterRef, DocumentContent, DocumentFormat, LibraryNode, MergedDocument } from '@shared/types'

export const LIBRARY_DIR = 'StudyInGal/library'

export const detectFormat = (name: string, isDirectory = false): DocumentFormat => {
  if (isDirectory) return 'folder'
  switch (extname(name)) {
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
    default:
      return 'other'
  }
}

const TEXT_FORMATS: DocumentFormat[] = ['md', 'latex', 'txt', 'html']

export const isReadableText = (format: DocumentFormat): boolean => TEXT_FORMATS.includes(format)

/** 把 base64 或 Blob 结果统一成文本 */
async function readTextFile(path: string): Promise<string> {
  const result = await Filesystem.readFile({ path })
  if (typeof result.data === 'string') return decodeURIComponent(escape(atob(result.data)))
  const blob = result.data as unknown as Blob
  return await blob.text()
}

export async function readNodeText(node: LibraryNode): Promise<string> {
  if (node.format === 'folder') {
    const merged = await mergeNode(node)
    return merged.markdown
  }
  if (isReadableText(node.format)) return readTextFile(node.path)
  if (node.format === 'pdf' || node.format === 'doc' || node.format === 'docx') {
    return `[StudyInGal 移动端] ${node.format.toUpperCase()} 解析暂未支持（桌面端可用）。文件已保存在：${node.path}`
  }
  return readTextFile(node.path)
}

export async function readDocument(node: LibraryNode): Promise<DocumentContent> {
  if (node.format === 'folder') {
    const merged = await mergeNode(node)
    return { nodeId: node.id, format: node.format, text: merged.markdown, html: null, isBinary: false, editable: false }
  }
  const text = await readNodeText(node)
  return {
    nodeId: node.id,
    format: node.format,
    text,
    html: null,
    isBinary: !isReadableText(node.format),
    editable: isReadableText(node.format)
  }
}

export async function writeDocument(node: LibraryNode, content: string, targetPath?: string): Promise<void> {
  const path = targetPath ?? node.path
  if (node.format === 'folder' && !targetPath) throw new Error('文件夹节点需要指定要写入的章节文件')
  if (!isReadableText(detectFormat(path))) throw new Error('该格式不可直接编辑')
  await Filesystem.writeFile({ path, data: content, encoding: Encoding.UTF8, recursive: true })
}

export async function mergeNode(node: LibraryNode): Promise<MergedDocument> {
  const refs: ChapterRef[] =
    node.format === 'folder'
      ? node.chapters
      : [{ id: `${node.id}:0`, title: node.title, path: node.path, order: 0 }]
  const chapters: MergedDocument['chapters'] = []
  for (const ref of refs) {
    let content = ''
    try {
      content = await readTextFile(ref.path)
    } catch (error) {
      content = `> ⚠️ 无法读取该章节：${(error as Error).message}`
    }
    chapters.push({ title: ref.title, path: ref.path, content })
  }
  const markdown = [
    `# ${node.title}`,
    '',
    `> 移动端合并视图（只读），共 ${chapters.length} 个章节。`,
    '',
    ...chapters.map((chapter, index) => `## ${index + 1}. ${chapter.title}\n\n${chapter.content}`)
  ].join('\n\n')
  return { nodeId: node.id, title: node.title, mergedAt: Date.now(), markdown, chapters }
}

/** 把浏览器里的 File 复制进应用文档目录，返回可长期访问的路径 */
export async function importFile(file: File, title: string): Promise<string> {
  const target = `${LIBRARY_DIR}/${Date.now()}-${title}`
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
  await Filesystem.writeFile({ path: target, data: base64, recursive: true })
  return target
}

export const toDisplayUri = (path: string): string => Capacitor.convertFileSrc(path)

export type { Directory }
