/**
 * 答题分支（QuizQuestion.branches）的归一化与补全。
 *
 * 模型只被要求给「每个选项一句角色台词」这种扁平结构，这里负责：
 * - 过滤非法项（下标越界、空文本、重复下标）
 * - 情绪缺省为 neutral，未知情绪按 neutral 处理
 * - 模型漏给某些选项时，用 explanation + 正确选项文本合成一条，保证运行时/EIPF 导出永远拿得到分支
 */
import type { QuizBranch, QuizQuestion } from '@shared/types'

export const QUIZ_EMOTIONS: string[] = [
  'neutral',
  'happy',
  'excited',
  'serious',
  'sad',
  'angry',
  'shy',
  'thinking',
  'surprised'
]

const toEmotion = (value: unknown): string =>
  typeof value === 'string' && QUIZ_EMOTIONS.includes(value) ? value : 'neutral'

/** 归一化模型返回的分支数组（扁平结构：[{choiceIndex, text, emotion}]） */
export function normalizeBranches(input: unknown, optionCount: number): QuizBranch[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<number>()
  const branches: QuizBranch[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const choiceIndex = Number(record.choiceIndex)
    const text = typeof record.text === 'string' ? record.text.trim() : ''
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= optionCount) continue
    if (!text || seen.has(choiceIndex)) continue
    seen.add(choiceIndex)
    branches.push({ choiceIndex, text, emotion: toEmotion(record.emotion) })
  }
  return branches.sort((left, right) => left.choiceIndex - right.choiceIndex)
}

/**
 * 保证每个选项都有一条分支台词：
 * - 答对的合成「答对了！<解释>」这一类强化
 * - 答错的合成「这里正确答案是「X」。<解释>」这一类解释
 */
export function completeBranches(question: Pick<QuizQuestion, 'options' | 'answerIndex' | 'explanation' | 'branches'>): QuizBranch[] {
  const existing = normalizeBranches(question.branches, question.options.length)
  const byIndex = new Map(existing.map((branch) => [branch.choiceIndex, branch]))
  const explanation = question.explanation.trim()
  const correctOption = question.options[question.answerIndex] ?? ''
  return question.options.map((_option, choiceIndex) => {
    const found = byIndex.get(choiceIndex)
    if (found) return found
    const correct = choiceIndex === question.answerIndex
    const text = correct
      ? explanation
        ? `答对了！${explanation}`
        : '答对了，这一处你抓得很准。'
      : correctOption
        ? `这里的正确答案是「${correctOption}」。${explanation}`.trim()
        : '再回到刚才那一段看看，重点不在这个选项上。'
    return { choiceIndex, text, emotion: correct ? 'happy' : 'serious' }
  })
}

/** 取出某个选项对应的分支台词（没有就返回 null，由调用方决定回退文案） */
export function pickBranch(question: Pick<QuizQuestion, 'branches'>, choiceIndex: number): QuizBranch | null {
  if (!Array.isArray(question.branches)) return null
  return question.branches.find((branch) => branch.choiceIndex === choiceIndex) ?? null
}
