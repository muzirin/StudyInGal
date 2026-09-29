import { describe, expect, it } from 'vitest'
import { applyExcerpt, isChapterPathAllowed, isInsideFolder, normalizePathKey, parentPath, pickChapter } from './excerpt'
import type { ChapterRef } from '@shared/types'

const chapters: ChapterRef[] = [
  { id: 'n:0', title: '第一章', path: '/book/01.md', order: 0 },
  { id: 'n:1', title: '第二章', path: '/book/02.md', order: 1 }
]

describe('pickChapter', () => {
  it('按路径挑出章节', () => {
    expect(pickChapter(chapters, '/book/02.md')?.title).toBe('第二章')
  })

  it('分隔符 / 末尾斜杠 / Windows 大小写差异都能匹配上', () => {
    expect(pickChapter(chapters, '/book\\02.md')?.title).toBe('第二章')
    const windows: ChapterRef[] = [{ id: 'n', title: '第五章', path: 'D:\\Books\\Ch5.md', order: 0 }]
    expect(pickChapter(windows, 'd:/books/ch5.md')?.title).toBe('第五章')
    expect(pickChapter(windows, 'D:\\Books\\Ch5.md\\')?.title).toBe('第五章')
  })

  it('未指定路径时返回 null（表示整本合并）', () => {
    expect(pickChapter(chapters, '')).toBeNull()
    expect(pickChapter(chapters, undefined)).toBeNull()
  })

  it('路径已失效时返回 null，交给调用方决定', () => {
    expect(pickChapter(chapters, '/book/99.md')).toBeNull()
  })
})

describe('normalizePathKey', () => {
  it('统一分隔符并去掉末尾斜杠', () => {
    expect(normalizePathKey('D:\\a\\b\\')).toBe('d:/a/b')
    expect(normalizePathKey('/a/b///')).toBe('/a/b')
  })

  it('非 Windows 路径保留大小写', () => {
    expect(normalizePathKey('/StudyInGal/Ch1.md')).toBe('/StudyInGal/Ch1.md')
  })
})

describe('isInsideFolder', () => {
  it('子文件判定为真，目录本身与外部路径为假', () => {
    expect(isInsideFolder('/book/01.md', '/book')).toBe(true)
    expect(isInsideFolder('/book', '/book')).toBe(false)
    expect(isInsideFolder('/other/01.md', '/book')).toBe(false)
    expect(isInsideFolder('/bookish/01.md', '/book')).toBe(false)
  })

  it('Windows 路径忽略大小写', () => {
    expect(isInsideFolder('D:\\Books\\Ch5.md', 'd:/books')).toBe(true)
  })
})

describe('parentPath', () => {
  it('取父目录并保留原分隔符风格', () => {
    expect(parentPath('StudyInGal/library/a.md')).toBe('StudyInGal/library')
    expect(parentPath('D:\\Books\\Ch5.md')).toBe('D:\\Books')
    expect(parentPath('a.md')).toBe('')
  })
})

describe('isChapterPathAllowed', () => {
  it('落在教材目录内允许', () => {
    expect(isChapterPathAllowed('/book/05.md', '/book', [])).toBe(true)
  })

  it('教材目录不是目录（移动端句柄）时，允许与已知章节同目录', () => {
    const known: ChapterRef[] = [{ id: 'n:0', title: '第一章', path: 'StudyInGal/library/01.md', order: 0 }]
    expect(isChapterPathAllowed('StudyInGal/library/05.md', 'mobile-dir:0', known)).toBe(true)
  })

  it('目录外的路径不允许', () => {
    const known: ChapterRef[] = [{ id: 'n:0', title: '第一章', path: 'StudyInGal/library/01.md', order: 0 }]
    expect(isChapterPathAllowed('C:/Windows/System32/config', 'mobile-dir:0', known)).toBe(false)
  })
})

describe('applyExcerpt', () => {
  const text = '0123456789'

  it('没有区间时原样返回整篇', () => {
    expect(applyExcerpt(text, undefined)).toBe(text)
    expect(applyExcerpt(text, { title: '仅标题' })).toBe(text)
  })

  it('按 [start, end) 截取', () => {
    expect(applyExcerpt(text, { start: 2, end: 5 })).toBe('234')
  })

  it('只给 start 时取到结尾', () => {
    expect(applyExcerpt(text, { start: 8 })).toBe('89')
  })

  it('只给 end 时从头取起', () => {
    expect(applyExcerpt(text, { end: 3 })).toBe('012')
  })

  it('越界区间会被夹紧，且 start > end 时返回空串', () => {
    expect(applyExcerpt(text, { start: -5, end: 999 })).toBe(text)
    expect(applyExcerpt(text, { start: 7, end: 4 })).toBe('')
  })
})
