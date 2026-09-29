import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { parseQuizQuestions } from '../lib/quizParse'
import { assignCheckpoints, segmentBlocks } from '../lib/quizCheckpoints'
import { completeBranches } from '../lib/quizBranches'
import { estimateScriptTokens, isMaxTokenError } from '../lib/aiTokens'
import { chat, resolveProvider } from './ai/client'
import { findNode } from './library'
import { mergeNode, readDocument } from './documents'
import { getScript, saveScript } from './scripts'
import type { DialogueLine, QuizAttempt, QuizBranch, QuizQuestion, QuizResult, QuizStats } from '@shared/types'

const store = new JsonStore<QuizAttempt[]>(join(dataDir(), 'quizzes.json'), [])
const MAX_ATTEMPTS = 2000

/* ------------------------------- 记录与统计 ------------------------------- */

export function listAttempts(filter: { sourceId?: string; scriptId?: string } = {}): QuizAttempt[] {
  return store
    .read()
    .filter((item) => (filter.sourceId ? item.sourceId === filter.sourceId : true))
    .filter((item) => (filter.scriptId ? item.scriptId === filter.scriptId : true))
    .sort((a, b) => b.at - a.at)
}

export function stats(filter: { sourceId?: string; scriptId?: string } = {}): QuizStats {
  const attempts = listAttempts(filter)
  const correct = attempts.filter((item) => item.correct).length
  return {
    total: attempts.length,
    correct,
    accuracy: attempts.length > 0 ? correct / attempts.length : 0
  }
}

function saveAttempt(input: Omit<QuizAttempt, 'id' | 'at'>): QuizAttempt {
  const attempt: QuizAttempt = { ...input, id: newId('attempt'), at: Date.now() }
  store.write([attempt, ...store.read()].slice(0, MAX_ATTEMPTS))
  return attempt
}

/* --------------------------------- 出题 --------------------------------- */

export interface GenerateQuizInput {
  sourceId?: string
  scriptId?: string | null
  /** 直接给正文（例如「刚刚读过的这几句」），优先于 sourceId */
  contextText?: string
  title?: string
  count?: number
}

const QUESTION_RULES = [
  '每题 4 个选项，只有一个正确；',
  '选项要合理，不要出现「以上都对」「都不是」这类选项；',
  '题目考察理解、原理或易错点，不要照抄原文句子；',
  '每题还要给每个选项写一句「答完题后角色接着说的话」branches：正确选项写强化（肯定 + 一句话点出关键），错误选项写纠正（先用角色口吻指出误解，再点出正确要点），每句不超过 45 字；',
  '只输出 JSON，不要任何解释文字，结构为：',
  '{"questions":[{"question":"题干","options":["A","B","C","D"],"answerIndex":0,"explanation":"为什么选它、其他选项错在哪","branches":[{"choiceIndex":0,"text":"答对时的强化台词","emotion":"happy"},{"choiceIndex":1,"text":"选它时的纠正台词","emotion":"serious"}]}]}'
].join('\n')

export const QUIZ_RULES = QUESTION_RULES

const buildQuestionPrompt = (title: string, text: string, count: number, extra?: string): string =>
  [
    '你是出题老师。请根据下面的学习内容出单选题，考察「理解」而不是背诵原文。',
    `内容标题：${title}`,
    `题目数量：${count} 道。`,
    extra ?? '',
    QUESTION_RULES,
    '--- 内容开始 ---',
    text,
    '--- 内容结束 ---'
  ]
    .filter(Boolean)
    .join('\n')

function toQuestions(
  parsed: { question: string; options: string[]; answerIndex: number; explanation: string; branches?: QuizBranch[] }[],
  sourceId: string,
  scriptId: string | null,
  startIndex = 0
): QuizQuestion[] {
  const now = Date.now()
  return parsed.map((item, offset) => ({
    id: newId('quiz'),
    index: startIndex + offset,
    question: item.question,
    options: item.options,
    answerIndex: item.answerIndex,
    explanation: item.explanation,
    // 每个选项都要有分支台词，模型漏了就按 explanation 补齐
    branches: completeBranches({
      options: item.options,
      answerIndex: item.answerIndex,
      explanation: item.explanation,
      branches: item.branches ?? []
    }),
    sourceId,
    scriptId,
    createdAt: now
  }))
}

/** 供阅读器 / 即时出题使用：不落库，直接返回题目。 */
export async function generateQuestions(input: GenerateQuizInput): Promise<{ questions: QuizQuestion[]; truncated: boolean }> {
  const count = Math.min(Math.max(input.count ?? 3, 1), 8)
  let text = input.contextText ?? ''
  let title = input.title ?? '当前内容'
  let sourceId = input.sourceId ?? ''

  if (!text.trim()) {
    if (!input.sourceId) throw new Error('缺少出题所需的正文')
    const found = findNode(input.sourceId)
    if (!found) throw new Error('找不到源文献')
    text = found.node.format === 'folder' ? (await mergeNode(found.node)).markdown : (await readDocument(found.node)).text
    title = input.title ?? found.node.title
    sourceId = found.node.id
  }

  const provider = resolveProvider('chat')
  const request = {
    providerId: provider.id,
    capability: 'chat' as const,
    json: true,
    messages: [
      { role: 'system' as const, content: '你是一位善于设计理解型单选题的老师。' },
      { role: 'user' as const, content: buildQuestionPrompt(title, text.slice(0, 12000), count) }
    ]
  }
  const budget = estimateScriptTokens(count * 4)
  let response
  try {
    response = await chat({ ...request, maxTokens: budget })
  } catch (error) {
    if (!isMaxTokenError((error as Error).message)) throw error
    response = await chat({ ...request, maxTokens: 4096 })
  }

  const parsed = parseQuizQuestions(response.content)
  if (parsed.questions.length === 0) {
    throw new Error('模型没有返回可解析的单选题，请重试或换一个模型。')
  }
  return {
    questions: toQuestions(parsed.questions.slice(0, count), sourceId, input.scriptId ?? null),
    truncated: parsed.truncated
  }
}

/** 给「已有的」剧本补出题：生成后写回剧本，之后读取无需再调用模型。 */
export async function generateForScript(scriptId: string, count = 6): Promise<{ questions: QuizQuestion[]; truncated: boolean }> {
  const script = getScript(scriptId)
  if (!script) throw new Error('剧本不存在')
  const label = (item: DialogueLine): string =>
    `${item.speaker === 'character' ? '角色' : item.speaker === 'user' ? '我' : '旁白'}：${item.text}`
  // 按段投喂：第 i 题只能考第 i 段，避免一口气把整篇当一套卷子问完
  const blocks = segmentBlocks(script.lines, count, { label })

  const provider = resolveProvider('chat')
  const request = {
    providerId: provider.id,
    capability: 'chat' as const,
    json: true,
    messages: [
      { role: 'system' as const, content: '你是一位善于设计理解型单选题的老师。' },
      {
        role: 'user' as const,
        content: buildQuestionPrompt(
          script.title,
          blocks,
          count,
          '下面是按阅读顺序分好的段落：第 i 题只能考第 i 块（以及更早的块）里出现过的内容，严禁考察后面块里才出现的情节，也不要出「整篇主旨」这类必须读完全篇才能回答的题。'
        )
      }
    ]
  }
  const budget = estimateScriptTokens(count * 4)
  let response
  try {
    response = await chat({ ...request, maxTokens: budget })
  } catch (error) {
    if (!isMaxTokenError((error as Error).message)) throw error
    response = await chat({ ...request, maxTokens: 4096 })
  }

  const parsed = parseQuizQuestions(response.content)
  if (parsed.questions.length === 0) {
    throw new Error('模型没有返回可解析的单选题，请重试或换一个模型。')
  }
  const questions = toQuestions(parsed.questions.slice(0, count), script.sourceId, script.id)
  // 把每题锚到剧本进度上，播放器就能「读完这一段再检测」
  const checkpoints = assignCheckpoints(questions.length, script.lines.length)
  questions.forEach((question, offset) => {
    question.checkpoint = checkpoints[offset] ?? null
  })
  saveScript({ id: script.id, questions })
  return { questions, truncated: parsed.truncated }
}

/* --------------------------------- 判分 --------------------------------- */

/** 单选题本地判分：不消耗额度，也不需要联网。 */
export function evaluateAnswer(input: { question: QuizQuestion; answer: string }): QuizResult {
  const { question } = input
  const picked = Number(input.answer.trim())
  const answered = Number.isInteger(picked) && picked >= 0
  const correct = answered && picked === question.answerIndex

  const result: QuizResult = {
    correct,
    score: correct ? 1 : 0,
    feedback: correct
      ? '回答正确！'
      : answered
        ? `正确答案是：${question.options[question.answerIndex] ?? ''}`
        : '还没有作答哦。',
    explanation: question.explanation,
    reference: question.options[question.answerIndex] ?? ''
  }

  saveAttempt({
    questionId: question.id,
    sourceId: question.sourceId,
    scriptId: question.scriptId,
    question: question.question,
    answer: answered ? String(picked) : '',
    // 记下走了哪条分支（答对强化 / 答错解释）
    choiceIndex: answered ? picked : null,
    correct
  })
  return result
}

