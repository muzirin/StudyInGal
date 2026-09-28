import type { GalScript } from '@shared/types'

/**
 * 兼容旧版本数据：v0.5.0 之前的剧本没有 `questions` / `sceneId` 字段，
 * 直接读 `.questions.length` 会崩。统一在读取时补齐。
 */
export function normalizeScript(script: GalScript): GalScript {
  return {
    ...script,
    sceneId: script.sceneId ?? null,
    lines: Array.isArray(script.lines) ? script.lines : [],
    questions: Array.isArray(script.questions) ? script.questions : []
  }
}

export function normalizeScripts(scripts: GalScript[]): GalScript[] {
  return scripts.map(normalizeScript)
}
