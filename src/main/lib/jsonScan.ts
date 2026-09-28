/** 从模型输出里「抢救」JSON 的通用工具（容错解析的基础）。 */

export const stripFences = (value: string): string =>
  value
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

/** 从 start 处的 '[' 开始，找到与之匹配的 ']'；被截断时返回剩余全部内容。 */
export function sliceJsonArray(text: string, start: number): string {
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

/**
 * 取出 JSON 数组主体：
 * - 优先 key 指定的数组（如 "lines" / "questions"）；
 * - 其次任意顶层数组；
 * - 都没有时返回原文（交给调用方容错处理）。
 */
export function findArrayPayload(content: string, key?: string): string {
  const text = stripFences(content)
  if (key) {
    const keyIndex = text.search(new RegExp(`"${key}"\\s*:`, 'i'))
    if (keyIndex >= 0) {
      const arrayStart = text.indexOf('[', keyIndex)
      if (arrayStart >= 0) return sliceJsonArray(text, arrayStart)
    }
  }
  const arrayStart = text.indexOf('[')
  if (arrayStart >= 0) return sliceJsonArray(text, arrayStart)
  return text
}

/** 扫描数组文本里所有「完整的」顶层对象；末尾未闭合则标记为截断。 */
export function scanJsonObjects(arrayText: string): { objects: string[]; truncated: boolean } {
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
    if (char === '"') inString = true
    else if (char === '{') {
      if (depth === 0) start = index
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        objects.push(arrayText.slice(start, index + 1))
        start = -1
      }
    }
  }

  return { objects, truncated: depth > 0 || inString }
}

export const unescapeJsonString = (value: string): string =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
