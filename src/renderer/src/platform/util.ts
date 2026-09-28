export const newId = (prefix = 'id'): string => {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${prefix}_${uuid}`
}

type Plain = Record<string, unknown>

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return (patch === undefined ? base : (patch as T))
  const output: Plain = isPlainObject(base) ? { ...base } : {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const previous = output[key]
    output[key] = isPlainObject(value) && isPlainObject(previous) ? deepMerge(previous, value) : value
  }
  return output as T
}

/** base64（不带 data: 前缀）→ UTF-8 文本 */
export function base64ToText(base64: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new TextDecoder('utf-8').decode(bytes)
}

/** UTF-8 文本 → base64 */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
