/** 容错解析模型返回的单选题 JSON（被截断时保留已完整的题目）。 */
import { findArrayPayload, scanJsonObjects, unescapeJsonString } from './jsonScan'
import { normalizeBranches } from './quizBranches'
import type { QuizBranch } from '@shared/types'

export interface ParsedQuestion {
  question: string
  options: string[]
  answerIndex: number
  explanation: string
  /** 每个选项的分支台词（答对强化 / 答错解释），模型没给就是空数组 */
  branches: QuizBranch[]
}

const extractField = (objectText: string, name: string): string | null => {
  const match = objectText.match(new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
  return match ? unescapeJsonString(match[1]) : null
}

const extractOptions = (objectText: string): string[] => {
  const match = objectText.match(/"options"\s*:\s*\[([\s\S]*?)\]/)
  if (!match) return []
  const items = match[1].match(/"((?:[^"\\]|\\.)*)"/g)
  return items ? items.map((item) => unescapeJsonString(item.slice(1, -1))) : []
}

/** 只有「2~6 个选项 + 合法 answerIndex」才算有效单选题。 */
const build = (input: unknown): ParsedQuestion | null => {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const question = typeof record.question === 'string' ? record.question.trim() : ''
  if (!question) return null
  const options = Array.isArray(record.options) ? record.options.map((item) => String(item).trim()).filter(Boolean) : []
  const rawIndex = Number(record.answerIndex)
  if (options.length < 2 || options.length > 6) return null
  if (!Number.isInteger(rawIndex) || rawIndex < 0) return null
  return {
    question,
    options,
    answerIndex: Math.min(rawIndex, options.length - 1),
    explanation: typeof record.explanation === 'string' ? record.explanation : '',
    branches: normalizeBranches(record.branches, options.length)
  }
}

export function parseQuizQuestions(content: string): { questions: ParsedQuestion[]; truncated: boolean } {
  const payload = findArrayPayload(content, 'questions')

  try {
    const direct = JSON.parse(payload) as unknown
    const array = Array.isArray(direct) ? direct : (direct as { questions?: unknown }).questions
    if (Array.isArray(array)) {
      const questions = array.map(build).filter((item): item is ParsedQuestion => item !== null)
      if (questions.length > 0) return { questions, truncated: false }
    }
  } catch {
    /* 容错路径 */
  }

  const { objects, truncated } = scanJsonObjects(payload)
  const questions: ParsedQuestion[] = []
  for (const objectText of objects) {
    let parsed: unknown
    try {
      parsed = JSON.parse(objectText)
    } catch {
      const questionText = extractField(objectText, 'question')
      if (!questionText) continue
      const options = extractOptions(objectText)
      const indexMatch = objectText.match(/"answerIndex"\s*:\s*(\d+)/)
      const index = indexMatch ? Number(indexMatch[1]) : -1
      if (options.length < 2 || index < 0) continue
      questions.push({
        question: questionText,
        options,
        answerIndex: Math.min(index, options.length - 1),
        explanation: extractField(objectText, 'explanation') ?? '',
        // 截断容错路径下嵌套的 branches 解析不可靠，交给 completeBranches 用 explanation 补齐
        branches: []
      })
      continue
    }
    const normalized = build(parsed)
    if (normalized) questions.push(normalized)
  }
  return { questions, truncated }
}
