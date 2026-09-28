import { newId } from '../../lib/util'
import { parseDialogueJson } from '../../lib/jsonLines'
import {
  SAFE_FALLBACK_TOKENS,
  estimateScriptTokens,
  isMaxTokenError,
  parseAllowedMaxTokens,
  tokenCandidates
} from '../../lib/aiTokens'
import { emitEvent } from '../../lib/events'
import { findNode } from '../library'
import { mergeNode, readDocument } from '../documents'
import { listCharacters } from '../characters'
import { saveScript } from '../scripts'
import { chat, resolveProvider } from './client'
import type { ChatRequest, ChatResponse, DialogueLine, GalGenerateOptions, GalScript } from '@shared/types'

const EMOTIONS = ['neutral', 'happy', 'thinking', 'surprised', 'serious', 'shy', 'excited', 'sad', 'angry']

const DEPTH_BUDGET: Record<GalGenerateOptions['depth'], { chars: number; instruction: string }> = {
  summary: { chars: 8000, instruction: '用少量对话概括核心结论与动机，不要展开推导细节。' },
  standard: { chars: 20000, instruction: '覆盖研究问题、方法、结论与关键实验，适度展开讲解。' },
  deep: { chars: 40000, instruction: '逐节深入讲解，包含方法细节、公式直觉、实验设计权衡与可能的局限。' }
}

/**
 * 剧本输出所需的 max_tokens 预算。
 * 中文对话 + JSON 结构大约每行 100~150 tokens，这里按 150 估算并留出固定开销。
 * 各家的上限差异很大（DeepSeek 8192、部分网关 393216），所以这里只给一个保守的期望值，
 * 真正的上限由「被拒绝时按错误信息回退」来处理。
 */
const HARD_CAP = 16384
const SAFE_FALLBACK = SAFE_FALLBACK_TOKENS
const estimateTokens = estimateScriptTokens

/** 依次尝试一组 token 预算，直到成功；都是 max_tokens 类错误时抛最后一个。 */
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
  const content =
    found.node.format === 'folder' ? (await mergeNode(found.node)).markdown : (await readDocument(found.node)).text
  const excerpt = content.slice(0, budget.chars)

  const system = [
    character.systemPrompt,
    `人物设定：${character.personality}`,
    `说话风格：${character.speakingStyle}`,
    '现在你要把用户提供的论文/教材内容改写为一段用于学习的 Galgame 对话剧本。'
  ].join('\n')

  const user = [
    `源文献标题：${found.node.title}`,
    `语言：${options.language === 'zh' ? '中文' : 'English'}`,
    `讲解深度指令：${budget.instruction}`,
    `输出上限：${options.maxLines} 行对话。`,
    options.focus ? `重点聚焦：${options.focus}` : '',
    '要求：角色是你（speaker=character），用户是「我」（speaker=user），旁白用 narration。',
    `emotion 只能取以下之一：${EMOTIONS.join(', ')}。`,
    '每行台词尽量控制在 60 字以内，保持简洁，不要输出任何解释性文字。',
    '只输出 JSON，结构为：{"lines":[{"speaker":"character","text":"...","emotion":"neutral"}]}',
    '--- 文献内容开始 ---',
    excerpt,
    '--- 文献内容结束 ---'
  ]
    .filter(Boolean)
    .join('\n')

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user }
  ]

  const request: Omit<ChatRequest, 'maxTokens'> = {
    providerId: provider.id,
    capability: 'script',
    json: true,
    messages
  }
  const target = estimateTokens(options.maxLines)
  const providerMax = Number.isFinite(provider.maxTokens) && provider.maxTokens > 0 ? provider.maxTokens : SAFE_FALLBACK

  let response: ChatResponse
  try {
    response = await chatWithTokenLadder(request, [target])
  } catch (error) {
    const message = (error as Error).message
    if (!isMaxTokenError(message)) throw error
    // 按网关给出的上限回退，其次依次尝试更保守的值
    response = await chatWithTokenLadder(
      request,
      tokenCandidates(parseAllowedMaxTokens(message) ?? Math.min(providerMax, SAFE_FALLBACK), [SAFE_FALLBACK, 4096, 2048])
    )
  }

  const parsed = parseDialogueJson(response.content, EMOTIONS)
  if (parsed.lines.length === 0) {
    throw new Error(
      '模型没有返回可解析的 JSON 剧本。可尝试：换用能力更强的模型、降低「最大对话行数」、或在提供商设置里调大 Max tokens。'
    )
  }

  const hitLengthLimit = response.finishReason === 'length' || /length/i.test(response.finishReason ?? '')
  const truncated = parsed.truncated || hitLengthLimit

  const lines: DialogueLine[] = parsed.lines.slice(0, options.maxLines).map((line) => ({
    id: newId('line'),
    speaker: line.speaker as DialogueLine['speaker'],
    text: line.text,
    emotion: line.emotion
  }))

  if (truncated) {
    emitEvent({
      type: 'toast',
      payload: {
        severity: 'warning',
        message: `模型输出被 max tokens 截断，已保留前 ${lines.length} 行。可减少「最大对话行数」或在提供商设置里调大 Max tokens。`
      }
    })
  }

  return saveScript({
    sourceId: found.node.id,
    sourceKind: found.kind,
    title: `${found.node.title} · ${character.name}`,
    characterId: character.id,
    lines,
    providerId: provider.id,
    model: response.model
  })
}
