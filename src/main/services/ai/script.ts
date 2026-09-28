import { newId } from '../../lib/util'
import { parseDialogueJson } from '../../lib/jsonLines'
import { emitEvent } from '../../lib/events'
import { findNode } from '../library'
import { mergeNode, readDocument } from '../documents'
import { listCharacters } from '../characters'
import { saveScript } from '../scripts'
import { chat, resolveProvider } from './client'
import type { DialogueLine, GalGenerateOptions, GalScript } from '@shared/types'

const EMOTIONS = ['neutral', 'happy', 'thinking', 'surprised', 'serious', 'shy', 'excited', 'sad', 'angry']

const DEPTH_BUDGET: Record<GalGenerateOptions['depth'], { chars: number; instruction: string }> = {
  summary: { chars: 8000, instruction: '用少量对话概括核心结论与动机，不要展开推导细节。' },
  standard: { chars: 20000, instruction: '覆盖研究问题、方法、结论与关键实验，适度展开讲解。' },
  deep: { chars: 40000, instruction: '逐节深入讲解，包含方法细节、公式直觉、实验设计权衡与可能的局限。' }
}

/**
 * 剧本输出所需的 max_tokens 预算。
 * 中文对话 + JSON 结构大约每行 100~150 tokens，这里按 150 估算并留出固定开销。
 * 上限取 8192：DeepSeek 等主流模型的单次输出上限，超过会被 API 直接拒绝。
 */
const SCRIPT_MAX_TOKENS = 8192
const estimateTokens = (maxLines: number): number => Math.min(SCRIPT_MAX_TOKENS, 900 + maxLines * 150)

const isMaxTokenError = (message: string): boolean => /max_?tokens|maximum context|too large/i.test(message)

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

  const requestedTokens = Math.max(provider.maxTokens, estimateTokens(options.maxLines))
  let response
  try {
    response = await chat({ providerId: provider.id, capability: 'script', json: true, messages, maxTokens: requestedTokens })
  } catch (error) {
    const message = (error as Error).message
    // 某些模型拒绝偏大的 max_tokens，回退到用户配置的值再试一次
    if (isMaxTokenError(message) && requestedTokens > provider.maxTokens) {
      response = await chat({ providerId: provider.id, capability: 'script', json: true, messages, maxTokens: provider.maxTokens })
    } else {
      throw error
    }
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
