import { describe, expect, it } from 'vitest'
import { SECTION_SPLIT_THRESHOLD, splitSections } from './sections'

const long = (body: string): string => body.padEnd(SECTION_SPLIT_THRESHOLD + 10, '　')

describe('splitSections', () => {
  it('短文不切分', () => {
    expect(splitSections('# 一\n\n内容\n\n# 二\n\n内容')).toEqual([])
  })

  it('按 Markdown 最高层级切分并给出字符区间', () => {
    const text = long('# 第一章\n\n甲\n\n# 第二章\n\n乙')
    const sections = splitSections(text)
    expect(sections.map((section) => section.title)).toEqual(['第一章', '第二章'])
    expect(sections[0].start).toBe(0)
    expect(text.slice(sections[1].start, sections[1].end)).toContain('第二章')
    expect(sections[1].end).toBe(text.length)
  })

  it('只按最高层级切分，忽略更深层的标题', () => {
    const text = long('# 第一章\n\n## 小节\n\n甲\n\n# 第二章\n\n乙')
    expect(splitSections(text).map((section) => section.title)).toEqual(['第一章', '第二章'])
  })

  it('识别 LaTeX 章节命令', () => {
    const text = long('\\section{绪论}\n\n甲\n\n\\section{方法}\n\n乙')
    expect(splitSections(text).map((section) => section.title)).toEqual(['绪论', '方法'])
  })

  it('只有一个顶层标题时不切分（chapter 与 section 不同级）', () => {
    expect(splitSections(long('\\chapter{绪论}\n\n甲\n\n\\section{方法}\n\n乙'))).toEqual([])
  })

  it('标题不足两个时不切分', () => {
    expect(splitSections(long('# 唯一标题\n\n甲'))).toEqual([])
  })

  it('区间首尾相接且不重叠', () => {
    const text = long('# 一\n\n甲\n\n# 二\n\n乙')
    const sections = splitSections(text)
    expect(sections[0].end).toBe(sections[1].start)
    expect(sections[1].end).toBe(text.length)
  })
})
