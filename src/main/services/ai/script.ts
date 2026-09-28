import { newId } from '../../lib/util'
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

function parseLines(content: string): { speaker: DialogueLine['speaker']; text: string; emotion: string }[] {
  let payload: unknown
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    payload = JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('模型未返回可解析的 JSON 剧本')
    payload = JSON.parse(trimmed.slice(start, end + 1))
  }
  const raw = Array.isArray(payload) ? payload : (payload as { lines?: unknown }).lines
  if (!Array.isArray(raw)) throw new Error('剧本 JSON 缺少 lines 数组')
  return raw
    .map((item) => {
      const line = item as { speaker?: string; text?: string; emotion?: string }
      const speaker: DialogueLine['speaker'] =
        line.speaker === 'user' || line.speaker === 'narration' ? line.speaker : 'character'
      return {
        speaker,
        text: String(line.text ?? '').trim(),
        emotion: EMOTIONS.includes(String(line.emotion)) ? String(line.emotion) : 'neutral'
      }
    })
    .filter((line) => line.text.length > 0)
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
  const content = found.node.format === 'folder' ? (await mergeNode(found.node)).markdown : (await readDocument(found.node)).text
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
    '只输出 JSON，不要任何解释文本，结构为：{"lines":[{"speaker":"character","text":"...","emotion":"neutral"}]}',
    '--- 文献内容开始 ---',
    excerpt,
    '--- 文献内容结束 ---'
  ]
    .filter(Boolean)
    .join('\n')

  const response = await chat({
    providerId: provider.id,
    capability: 'script',
    json: true,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  })

  const parsed = parseLines(response.content).slice(0, options.maxLines)
  const lines: DialogueLine[] = parsed.map((line) => ({ id: newId('line'), ...line }))

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
