import { randomUUID } from 'node:crypto'

export const newId = (prefix = 'id'): string => `${prefix}_${randomUUID()}`

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

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))
