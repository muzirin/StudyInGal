/**
 * 解析模型返回的「对话行」JSON。
 *
 * 现实情况：模型（尤其 DeepSeek 等）在 max_tokens 用尽时会把 JSON 截断在数组中间，
 * 直接 JSON.parse 会整体失败。这里做三级容错：
 *   1. 严格 JSON.parse（数组 或 { lines: [] }）
 *   2. 按字符扫描数组，逐个提取「完整的对象」，丢弃最后一个不完整对象
 *   3. 对仍无法解析的对象，用正则逐字段抽取（容忍未转义的换行等）
 */
import { findArrayPayload, scanJsonObjects, unescapeJsonString } from './jsonScan'

export interface RawDialogueLine {
  speaker: string
  text: string
  emotion: string
}

export interface ParseDialogueResult {
  lines: RawDialogueLine[]
  /** 严格解析失败，走了容错路径 */
  salvaged: boolean
  /** 数组似乎被截断（有未闭合的对象） */
  truncated: boolean
}

const SPEAKERS = new Set(['character', 'user', 'narration'])

/** 从被截断的数组文本里，扫描出所有「完整的」顶层对象。 */
const scanObjects = scanJsonObjects

/** 对象级 JSON.parse 失败时，按字段正则抽取。 */
function extractFields(objectText: string): RawDialogueLine | null {
  const field = (name: string): string | null => {
    const match = objectText.match(new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
    return match ? unescapeJsonString(match[1]) : null
  }
  const text = field('text')
  if (!text) return null
  return {
    speaker: field('speaker') ?? 'character',
    text,
    emotion: field('emotion') ?? 'neutral'
  }
}

const normalize = (input: unknown, emotions: readonly string[]): RawDialogueLine | null => {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const text = typeof record.text === 'string' ? record.text.trim() : ''
  if (!text) return null
  const speaker = typeof record.speaker === 'string' && SPEAKERS.has(record.speaker) ? record.speaker : 'character'
  const emotion = typeof record.emotion === 'string' && emotions.includes(record.emotion) ? record.emotion : 'neutral'
  return { speaker, text, emotion }
}

export function parseDialogueJson(content: string, emotions: readonly string[]): ParseDialogueResult {
  const payload = findArrayPayload(content, 'lines')

  // 1) 严格解析
  try {
    const direct = JSON.parse(payload) as unknown
    const array = Array.isArray(direct) ? direct : (direct as { lines?: unknown }).lines
    if (Array.isArray(array)) {
      const lines = array
        .map((item) => normalize(item, emotions))
        .filter((item): item is RawDialogueLine => item !== null)
      if (lines.length > 0) return { lines, salvaged: false, truncated: false }
    }
  } catch {
    /* 继续走容错路径 */
  }

  // 2) 扫描完整对象
  const { objects, truncated } = scanObjects(payload)
  const lines: RawDialogueLine[] = []
  for (const objectText of objects) {
    let parsed: unknown
    try {
      parsed = JSON.parse(objectText)
    } catch {
      const extracted = extractFields(objectText)
      if (extracted) lines.push(extracted)
      continue
    }
    const normalized = normalize(parsed, emotions)
    if (normalized) lines.push(normalized)
  }

  return { lines, salvaged: true, truncated }
}
