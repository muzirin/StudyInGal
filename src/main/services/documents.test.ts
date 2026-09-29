import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { detectChapters, mergeNode, renderPreview } from './documents'
import type { LibraryNode } from '@shared/types'

let root = ''

const folderNode = (): LibraryNode => ({
  id: 'node_test',
  kind: 'textbook',
  title: '测试教材',
  authors: [],
  abstract: '',
  tags: [],
  folderId: null,
  seriesId: null,
  categoryId: null,
  path: root,
  format: 'folder',
  sizeBytes: 0,
  createdAt: 0,
  updatedAt: 0,
  favorite: false,
  readingProgress: 0,
  lastOpenedAt: null,
  ocrStatus: 'none',
  chapters: [],
  meta: {}
})

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'sig-doc-'))
  await writeFile(join(root, '01-第一章.md'), '# 第一章 绪论\n\n正文', 'utf8')
  // 内容不是合法 PDF，但足以验证「PDF 会被当作章节列出来」以及读取失败不会炸掉合并视图
  await writeFile(join(root, '02-扫描章节.pdf'), '%PDF-1.4\nnot a real pdf\n%%EOF', 'utf8')
  await mkdir(join(root, 'sub'), { recursive: true })
  await writeFile(join(root, 'sub', '03-第三章.tex'), '\\chapter{第三章}\n\n正文', 'utf8')
  await writeFile(join(root, 'ignore.png'), 'binary', 'utf8')
})

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})

/** 生成一个最小可用 .docx（用于验证 mammoth 转 HTML 的通路） */
async function buildDocx(heading: string, body: string): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  )
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${heading}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>${body}</w:t></w:r></w:p>` +
      '</w:body></w:document>'
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('detectChapters', () => {
  it('把 PDF 也当成章节，而不是只认 Markdown/LaTeX', async () => {
    const chapters = await detectChapters(folderNode())
    expect(chapters.map((chapter) => chapter.title)).toEqual(['第一章 绪论', '02-扫描章节', '第三章'])
  })

  it('仍然忽略非文档类型（如图片）', async () => {
    const chapters = await detectChapters(folderNode())
    expect(chapters.some((chapter) => chapter.path.endsWith('.png'))).toBe(false)
  })

  it('PDF 章节取不到标题时退回文件名，不会抛错', async () => {
    const chapters = await detectChapters(folderNode())
    const pdf = chapters.find((chapter) => chapter.path.endsWith('.pdf'))
    expect(pdf?.title).toBe('02-扫描章节')
  })
})

describe('mergeNode', () => {
  it('单个章节读取失败时给出提示，其余章节照常合并', async () => {
    const merged = await mergeNode(folderNode())
    expect(merged.chapters).toHaveLength(3)
    expect(merged.markdown).toContain('第一章 绪论')
    const pdf = merged.chapters.find((chapter) => chapter.path.endsWith('.pdf'))
    expect(pdf && pdf.content.length > 0).toBe(true)
  })
})

describe('renderPreview', () => {
  it('PDF 直接给原始字节（不经过 OCR/文本抽取）', async () => {
    const path = join(root, '02-扫描章节.pdf')
    const preview = await renderPreview({ ...folderNode(), format: 'pdf', path })
    expect(preview.mode).toBe('pdf')
    if (preview.mode !== 'pdf') throw new Error('unreachable')
    expect(Buffer.from(preview.base64, 'base64').toString('utf8')).toContain('%PDF-1.4')
    expect(preview.sizeBytes).toBeGreaterThan(0)
  })

  it('DOCX 转成保留结构的 HTML', async () => {
    const path = join(root, '带格式.docx')
    await writeFile(path, await buildDocx('绪论', '正文内容在这里。'))
    const preview = await renderPreview({ ...folderNode(), format: 'docx', path })
    expect(preview.mode).toBe('html')
    if (preview.mode !== 'html') throw new Error('unreachable')
    expect(preview.html).toContain('绪论')
    expect(preview.html).toContain('正文内容在这里。')
    expect(preview.html).toContain('<p>')
  })

  it('老格式 .doc 明确给出「无法渲染」的原因', async () => {
    const path = join(root, '旧格式.doc')
    await writeFile(path, 'not really a doc', 'utf8')
    const preview = await renderPreview({ ...folderNode(), format: 'doc', path })
    expect(preview.mode).toBe('none')
    if (preview.mode !== 'none') throw new Error('unreachable')
    expect(preview.reason).toContain('.doc')
  })
})
