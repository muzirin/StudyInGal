import type { DialogueLine } from '@shared/types'

export interface Scene {
  index: number
  title: string
  start: number
  end: number
}

const MAX_SCENE_LINES = 14

const clean = (text: string): string => text.replace(/[#*>\n]/g, ' ').trim()

/**
 * 把扁平的剧本按「叙述断点 + 长度」切成幕。
 * - 遇到旁白且当前幕已有 2 行以上时开新幕
 * - 超过 MAX_SCENE_LINES 行强制切分
 */
export function buildScenes(lines: DialogueLine[]): Scene[] {
  if (lines.length === 0) return []
  const scenes: Scene[] = []
  let start = 0

  const push = (end: number): void => {
    const slice = lines.slice(start, end + 1)
    const firstCharacter = slice.find((line) => line.speaker === 'character')
    const title = clean((firstCharacter ?? slice[0]).text).slice(0, 22) || `第 ${scenes.length + 1} 幕`
    scenes.push({ index: scenes.length, title, start, end })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const isNarrationBreak = line.speaker === 'narration' && index - start >= 2
    const isTooLong = index - start >= MAX_SCENE_LINES
    if (isNarrationBreak || isTooLong) {
      push(index - 1)
      start = index
    }
  }
  push(lines.length - 1)
  return scenes
}
