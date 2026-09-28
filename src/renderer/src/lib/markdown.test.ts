import { describe, expect, it } from 'vitest'
import { sectionsFromMarkdown } from './markdown'

describe('sectionsFromMarkdown', () => {
  it('按 1-3 级标题切分，并保留正文', () => {
    const markdown = [
      '# 第一章',
      '引入文字',
      '## 1.1 小节',
      '小节内容',
      '### 更深的标题',
      'x',
      '#### 四级标题不该切分',
      'y'
    ].join('\n')

    const sections = sectionsFromMarkdown(markdown)
    expect(sections.map((section) => section.title)).toEqual(['第一章', '1.1 小节', '更深的标题'])
    expect(sections[0].content).toContain('引入文字')
    expect(sections[2].content).toContain('#### 四级标题不该切分')
  })

  it('丢弃没有正文的空章节', () => {
    const sections = sectionsFromMarkdown(['# 空标题', '# 有内容', '正文'].join('\n'))
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('有内容')
  })

  it('没有标题时返回空目录', () => {
    expect(sectionsFromMarkdown('只有正文\n没有标题')).toEqual([])
  })
})
