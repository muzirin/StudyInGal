/**
 * 解析模型返回的「对话行」JSON。
 *
 * 现实情况：模型（尤其 DeepSeek 等）在 max_tokens 用尽时会把 JSON 截断在数组中间，
 * 直接 JSON.parse 会整体失败。这里做三级容错：
 *   1. 严格 JSON.parse（数组 或 { lines: [] }）
 *   2. 按字符扫描数组，逐个提取「完整的对象」，丢弃最后一个不完整对象
 *   3. 对仍无法解析的对象，用正则逐字段抽取（容忍未转义的换行等）
 */
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

const stripFences = (value: string): string =>
  value
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

/** 从 start 处的 '[' 开始，找到与之匹配的 ']'；被截断时返回剩余全部内容。 */
function sliceArray(text: string, start: number): string {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '[') depth += 1
    else if (char === ']') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return text.slice(start)
}

/** 取出 JSON 主体：优先 {"lines": [...]}，其次顶层数组。 */
function slicePayload(content: string): string {
  const text = stripFences(content)
  const linesIndex = text.search(/"lines"\s*:/)
  if (linesIndex >= 0) {
    const arrayStart = text.indexOf('[', linesIndex)
    if (arrayStart >= 0) return sliceArray(text, arrayStart)
  }
  const arrayStart = text.indexOf('[')
  if (arrayStart >= 0) return sliceArray(text, arrayStart)
  return text
}

/** 从被截断的数组文本里，扫描出所有「完整的」顶层对象。 */
function scanObjects(arrayText: string): { objects: string[]; truncated: boolean } {
  const objects: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < arrayText.length; index += 1) {
    const char = arrayText[index]

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      if (depth === 0) start = index
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        objects.push(arrayText.slice(start, index + 1))
        start = -1
      }
      continue
    }
  }

  // 结尾仍在字符串或对象中间 → 说明被截断
  const truncated = depth > 0 || inString
  return { objects, truncated }
}

const unescape = (value: string): string =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')

/** 对象级 JSON.parse 失败时，按字段正则抽取。 */
function extractFields(objectText: string): RawDialogueLine | null {
  const field = (name: string): string | null => {
    const match = objectText.match(new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
    return match ? unescape(match[1]) : null
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
  const payload = slicePayload(content)

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
