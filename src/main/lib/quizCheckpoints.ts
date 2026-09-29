export interface QuizSegment {
  /** 第几题（0 起） */
  index: number
  /** 允许考察的行区间 [start, end)，行号 0 起、含头不含尾 */
  start: number
  end: number
}

/**
 * 把剧本按题目数平均分成段落：第 i 题只考第 i 段（以及它之前已经出现的内容）。
 * 出题提示词和播放器的检测点都由这里派生，保证「提示模型的范围」＝「运行时插入的位置」。
 */
export function planSegments(questionCount: number, lineCount: number): QuizSegment[] {
  const questions = Math.max(0, Math.floor(questionCount))
  const lines = Math.max(0, Math.floor(lineCount))
  if (questions === 0) return []
  if (lines === 0) return Array.from({ length: questions }, (_, index) => ({ index, start: 0, end: 0 }))
  return Array.from({ length: questions }, (_, index) => ({
    index,
    start: Math.floor((index / questions) * lines),
    end: Math.floor(((index + 1) / questions) * lines)
  }))
}

/**
 * 把题目铺到剧本的行进度上，用于「读完这一段就检测一次」。
 * 第 i 题的检测点 = 它那一段的最后一行（`lines` 下标，0 起）。
 */
export function assignCheckpoints(questionCount: number, lineCount: number): number[] {
  const lines = Math.max(0, Math.floor(lineCount))
  return planSegments(questionCount, lineCount).map((segment) => Math.max(0, Math.min(Math.max(0, lines - 1), segment.end - 1)))
}

/**
 * 生成「循序渐进出题」的提示词片段（用于「台词 + 题目」同一次生成）。
 *
 * 此时还没拿到最终台词，所以按「平均分成 N 段」来描述，与 `planSegments` 的分段方式一致；
 * 关键是约束模型：第 i 题只能考第 i 段里已经出现过的内容，不许超纲问后面的。
 */
export function progressiveQuizInstruction(questionCount: number, plannedLines: number): string {
  const segments = planSegments(questionCount, plannedLines)
  if (segments.length === 0) return ''
  const perSegment = Math.max(1, Math.round(Math.max(0, plannedLines) / segments.length))
  const ranges = segments
    .map((segment) => (segment.index === 0 ? '第 1 题只考第 1 段' : `第 ${segment.index + 1} 题只考第 ${segment.index + 1} 段（可回扣更早的内容）`))
    .join('；')
  return [
    `题目：${segments.length} 道单选题，随剧情循序渐进，不要当成一套整卷。`,
    `出题范围：把台词按顺序平均分成 ${segments.length} 段（每段约 ${perSegment} 行），${ranges}。`,
    '严禁考察后面段落才出现的情节、术语或结论，也不要出「整篇主旨」这类必须读完全篇才能回答的题；每题只考它所在那一段刚讲过的内容。',
    '每题 4 个选项，只有一个正确；选项要合理，不要出现「以上都对」「都不是」这类选项；不要照抄原文句子。',
    '每题还要给每个选项写一句「答完题后角色接着说的话」branches：正确选项写强化（肯定 + 一句话点出关键），错误选项写纠正（先用角色口吻指出误解，再点出正确要点）。',
    'branches 格式为 {"choiceIndex":选项下标,"text":"角色台词","emotion":"happy|serious 等"}，每句不超过 45 字，不要重复题干或照抄选项文字。'
  ].join('\n')
}

/**
 * 把已知台词按题目数切成带范围标记的文本块（用于「重新出题」这类已知剧本的场景）。
 * 第 i 块就是第 i 题唯一允许考察的范围。
 */
export function segmentBlocks<T extends { speaker: string; text: string }>(
  lines: T[],
  questionCount: number,
  options: { perBlockChars?: number; label?: (line: T) => string } = {}
): string {
  const segments = planSegments(questionCount, lines.length)
  if (segments.length === 0 || lines.length === 0) return ''
  const perBlockChars = options.perBlockChars ?? 12000
  const label = options.label ?? ((line: T) => line.text)
  const budget = Math.max(400, Math.floor(perBlockChars / segments.length))
  return segments
    .map((segment) => {
      const end = Math.max(segment.start + 1, segment.end)
      const body = lines
        .slice(segment.start, segment.end)
        .map(label)
        .join('\n')
        .slice(0, budget)
      return `【第 ${segment.index + 1} 题：只能考这一段（第 ${segment.start + 1}-${end} 行）】\n${body}`
    })
    .join('\n\n')
}

/** 题目是否带有阶段性位置（旧数据没有） */
export const hasCheckpoint = (question: { checkpoint?: number | null }): boolean =>
  typeof question.checkpoint === 'number'
