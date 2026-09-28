export interface FlatSection {
  title: string
  anchor: string
  content: string
}

const HEADING = /^(#{1,3})\s+(.+)$/

/**
 * 从 Markdown 中抽取 1-3 级标题，产出扁平目录。
 * 用于单文件论文 / 教材的目录导航。
 */
export function sectionsFromMarkdown(markdown: string): FlatSection[] {
  const lines = markdown.split('\n')
  const sections: FlatSection[] = []
  let current: FlatSection | null = null

  for (const line of lines) {
    const match = line.match(HEADING)
    if (match) {
      if (current) sections.push(current)
      const title = match[2].trim()
      current = { title, anchor: `#${title}`, content: '' }
    } else if (current) {
      current.content += `${line}\n`
    }
  }
  if (current) sections.push(current)

  return sections.filter((section) => section.content.trim().length > 0)
}
