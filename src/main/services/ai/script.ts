import { basename, extname } from 'node:path'
import { newId } from '../../lib/util'
import { parseDialogueJson } from '../../lib/jsonLines'
import { parseQuizQuestions } from '../../lib/quizParse'
import { assignCheckpoints, progressiveQuizInstruction } from '../../lib/quizCheckpoints'
import { completeBranches } from '../../lib/quizBranches'
import { applyExcerpt, isChapterPathAllowed, pickChapter } from '../../lib/excerpt'
import {
  SAFE_FALLBACK_TOKENS,
  isMaxTokenError,
  parseAllowedMaxTokens,
  tokenCandidates
} from '../../lib/aiTokens'
import { emitEvent } from '../../lib/events'
import { findNode } from '../library'
import { detectChapters, mergeNode, pathExists, readDocument, readPathText } from '../documents'
import { listCharacters } from '../characters'
import { saveScript } from '../scripts'
import { chat, resolveProvider } from './client'
import type { ChatRequest, ChatResponse, DialogueLine, GalGenerateOptions, GalScript, QuizQuestion } from '@shared/types'

const EMOTIONS = ['neutral', 'happy', 'thinking', 'surprised', 'serious', 'shy', 'excited', 'sad', 'angry']

const DEPTH_BUDGET: Record<GalGenerateOptions['depth'], { chars: number; instruction: string }> = {
  summary: { chars: 8000, instruction: '用少量对话概括核心结论与动机，不要展开推导细节。' },
  standard: { chars: 20000, instruction: '覆盖研究问题、方法、结论与关键实验，适度展开讲解。' },
  deep: { chars: 40000, instruction: '逐节深入讲解，包含方法细节、公式直觉、实验设计权衡与可能的局限。' }
}

const HARD_CAP = 16384
const SAFE_FALLBACK = SAFE_FALLBACK_TOKENS

/** 一次调用同时产出剧本与题目，所以预算要同时覆盖两者。 */
const estimateTokens = (maxLines: number, questionCount: number): number =>
  Math.min(HARD_CAP, 1100 + Math.floor(maxLines) * 150 + Math.floor(questionCount) * 260)

/** 题目数量：按行数自适应（每 6 行 1 题，3~10 题）。 */
const questionCountFor = (maxLines: number, explicit?: number): number =>
  explicit && explicit > 0 ? Math.min(explicit, 12) : Math.max(3, Math.min(10, Math.round(maxLines / 6)))

async function chatWithTokenLadder(
  request: Omit<ChatRequest, 'maxTokens'>,
  candidates: number[]
): Promise<ChatResponse> {
  let lastError: unknown = null
  for (const tokens of candidates) {
    try {
      return await chat({ ...request, maxTokens: tokens })
    } catch (error) {
      lastError = error
      if (!isMaxTokenError((error as Error).message)) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('模型拒绝了当前的 max_tokens 设置')
}

export async function generateScript(options: GalGenerateOptions): Promise<GalScript> {
  const found = findNode(options.sourceId)
  if (!found) throw new Error('找不到源文献，请刷新论文/教材库')

  const characters = listCharacters()
  const character =
    characters.find((item) => item.id === options.characterId) ?? characters.find((item) => item.isCompanion) ?? characters[0]
  if (!character) throw new Error('请先创建至少一个角色')

  const provider = resolveProvider('script')
  const budget = DEPTH_BUDGET[options.depth] ?? DEPTH_BUDGET.standard
  // 教材分册优先按「单个章节文件」取材：一次性把整本丢给模型既贵又难讲清楚
  let sourceChapter: string | null = options.excerpt?.title ?? null
  let content: string
  if (found.node.format === 'folder') {
    const chapters = await detectChapters(found.node)
    const requested = options.excerpt?.path
    // 先按（归一化后的）路径在目录里找，找不到再直接按用户选的那条路径读，
    // 都不行就明确报错——绝不能悄悄退回「整本合并」，否则会从第一章重新讲起。
    const matched = pickChapter(chapters, requested)
    if (matched) {
      content = await readPathText(matched.path)
      sourceChapter = matched.title
    } else if (requested) {
      if (!isChapterPathAllowed(requested, found.node.path, chapters)) {
        throw new Error('所选章节不属于这本教材，请回到 Gal 工坊重新选择')
      }
      if (!(await pathExists(requested))) {
        throw new Error('所选章节文件已不存在（可能被移动或改名），请回到 Gal 工坊重新选择')
      }
      content = await readPathText(requested)
      sourceChapter = sourceChapter?.trim() || basename(requested, extname(requested))
    } else {
      const merged = await mergeNode(found.node)
      content = merged.markdown
      sourceChapter = null
    }
  } else {
    const text = (await readDocument(found.node)).text
    content = applyExcerpt(text, options.excerpt)
  }
  const excerpt = content.slice(0, budget.chars)
  const questionCount = questionCountFor(options.maxLines, options.questionCount)

  const system = [
    character.systemPrompt,
    `人物设定：${character.personality}`,
    `说话风格：${character.speakingStyle}`,
    '现在你要把用户提供的论文/教材内容改写为一段用于学习的 Galgame 对话剧本，并同时出一组随堂单选题。'
  ].join('\n')

  const user = [
    `源文献标题：${found.node.title}`,
    sourceChapter ? `取材范围：${sourceChapter}（本次只讲这一部分，不要涉及其他章节的内容）` : '',
    `语言：${options.language === 'zh' ? '中文' : 'English'}`,
    `讲解深度指令：${budget.instruction}`,
    `剧本：最多 ${options.maxLines} 行对话。`,
    options.focus ? `重点聚焦：${options.focus}` : '',
    '剧本要求：角色是你（speaker=character），用户是「我」（speaker=user），旁白用 narration。',
    `emotion 只能取以下之一：${EMOTIONS.join(', ')}。`,
    '每行台词尽量控制在 60 字以内，保持简洁。',
    progressiveQuizInstruction(questionCount, options.maxLines),
    '只输出 JSON，不要任何解释文字，结构为：',
    '{"lines":[{"speaker":"character","text":"...","emotion":"neutral"}],"questions":[{"question":"题干","options":["A","B","C","D"],"answerIndex":0,"explanation":"为什么选它、其他选项错在哪","branches":[{"choiceIndex":0,"text":"答对时的强化台词","emotion":"happy"},{"choiceIndex":1,"text":"选它时的纠正台词","emotion":"serious"}]}]}',
    '--- 文献内容开始 ---',
    excerpt,
    '--- 文献内容结束 ---'
  ]
    .filter(Boolean)
    .join('\n')

  const request: Omit<ChatRequest, 'maxTokens'> = {
    providerId: provider.id,
    capability: 'script',
    json: true,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  }
  const target = estimateTokens(options.maxLines, questionCount)
  const providerMax = Number.isFinite(provider.maxTokens) && provider.maxTokens > 0 ? provider.maxTokens : SAFE_FALLBACK

  let response: ChatResponse
  try {
    response = await chatWithTokenLadder(request, [target])
  } catch (error) {
    const message = (error as Error).message
    if (!isMaxTokenError(message)) throw error
    response = await chatWithTokenLadder(
      request,
      tokenCandidates(parseAllowedMaxTokens(message) ?? Math.min(providerMax, SAFE_FALLBACK), [SAFE_FALLBACK, 4096, 2048])
    )
  }

  const parsedLines = parseDialogueJson(response.content, EMOTIONS)
  if (parsedLines.lines.length === 0) {
    throw new Error(
      '模型没有返回可解析的 JSON 剧本。可尝试：换用能力更强的模型、降低「最大对话行数」、或在提供商设置里调大 Max tokens。'
    )
  }

  const hitLengthLimit = response.finishReason === 'length' || /length/i.test(response.finishReason ?? '')
  const truncated = parsedLines.truncated || hitLengthLimit

  const lines: DialogueLine[] = parsedLines.lines.slice(0, options.maxLines).map((line) => ({
    id: newId('line'),
    speaker: line.speaker as DialogueLine['speaker'],
    text: line.text,
    emotion: line.emotion
  }))

  // 题目与剧本同批产出，直接存进剧本（之后读取无需再调用模型）
  const scriptId = newId('script')
  const parsedQuestions = parseQuizQuestions(response.content)
  // 每道题锚到剧本进度上：读到该段落后插入一次阶段性检测
  const checkpoints = assignCheckpoints(parsedQuestions.questions.length, lines.length)
  const questions: QuizQuestion[] = parsedQuestions.questions.map((item, offset) => ({
    id: newId('quiz'),
    index: offset,
    question: item.question,
    options: item.options,
    answerIndex: item.answerIndex,
    explanation: item.explanation,
    // 模型漏给分支时用 explanation 补齐，保证每个选项都有「强化/纠正」台词
    branches: completeBranches({
      options: item.options,
      answerIndex: item.answerIndex,
      explanation: item.explanation,
      branches: item.branches
    }),
    sourceId: found.node.id,
    scriptId,
    checkpoint: checkpoints[offset] ?? null,
    createdAt: Date.now()
  }))

  if (truncated) {
    emitEvent({
      type: 'toast',
      payload: {
        severity: 'warning',
        message: `模型输出被 max tokens 截断，已保留 ${lines.length} 行剧本、${questions.length} 道题。可减少「最大对话行数」或调大 Max tokens。`
      }
    })
  } else if (questions.length === 0) {
    emitEvent({
      type: 'toast',
      payload: { severity: 'info', message: '这次没有生成到题目，可在 Gal 工坊点「重新出题」补上。' }
    })
  }

  return saveScript({
    id: scriptId,
    sourceId: found.node.id,
    sourceKind: found.kind,
    title: sourceChapter ? `${sourceChapter} · ${character.name}` : `${found.node.title} · ${character.name}`,
    sourceChapter,
    characterId: character.id,
    lines,
    questions,
    providerId: provider.id,
    model: response.model
  })
}
