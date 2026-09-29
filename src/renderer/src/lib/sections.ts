export interface DocumentSection {
  index: number
  title: string
  /** 在原文中的字符区间 [start, end) */
  start: number
  end: number
}

interface Heading {
  level: number
  line: number
  title: string
}

const MARKDOWN_HEADING = /^ {0,3}(#{1,6})\s+(.+?)\s*$/
const LATEX_HEADING = /^\s*\\(chapter|section|subsection)\*?\{(.+?)\}/

const LATEX_LEVEL: Record<string, number> = { chapter: 1, section: 2, subsection: 3 }

/** 原文小于约 2 万字时没必要按节取材，一次就能贴进上下文 */
export const SECTION_SPLIT_THRESHOLD = 20000

function collectHeadings(text: string): { headings: Heading[]; offsets: number[] } {
  const headings: Heading[] = []
  const offsets: number[] = []
  let cursor = 0
  for (const line of text.split('\n')) {
    offsets.push(cursor)
    cursor += line.length + 1
    const markdown = line.match(MARKDOWN_HEADING)
    if (markdown) {
      headings.push({ level: markdown[1].length, line: offsets.length - 1, title: markdown[2].trim() })
      continue
    }
    const latex = line.match(LATEX_HEADING)
    if (latex) {
      headings.push({ level: LATEX_LEVEL[latex[1]] ?? 3, line: offsets.length - 1, title: latex[2].trim() })
    }
  }
  return { headings, offsets }
}

/**
 * 按原文里最高层级的标题把长文切成小节，用于「只生成某一节」。
 * 标题少于两个（切了也没意义）时返回空数组。
 */
export function splitSections(text: string): DocumentSection[] {
  if (text.length < SECTION_SPLIT_THRESHOLD) return []
  const { headings, offsets } = collectHeadings(text)
  if (headings.length < 2) return []
  const topLevel = Math.min(...headings.map((heading) => heading.level))
  const picked = headings.filter((heading) => heading.level === topLevel)
  if (picked.length < 2) return []
  return picked.map((heading, index) => ({
    index,
    title: heading.title,
    start: index === 0 ? 0 : offsets[heading.line],
    end: index + 1 < picked.length ? offsets[picked[index + 1].line] : text.length
  }))
}
