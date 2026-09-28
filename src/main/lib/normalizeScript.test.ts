import { describe, expect, it } from 'vitest'
import { normalizeScript, normalizeScripts } from './normalizeScript'
import type { GalScript } from '@shared/types'

const legacy = {
  id: 's1',
  sourceId: 'n1',
  sourceKind: 'paper',
  title: '旧剧本',
  characterId: 'c1',
  lines: [{ id: 'l1', speaker: 'character', text: '嗨', emotion: 'neutral' }],
  providerId: null,
  model: null,
  createdAt: 0,
  updatedAt: 0
} as unknown as GalScript

describe('normalizeScript', () => {
  it('给旧数据补上 questions / sceneId', () => {
    const fixed = normalizeScript(legacy)
    expect(fixed.questions).toEqual([])
    expect(fixed.sceneId).toBeNull()
    expect(fixed.lines).toHaveLength(1)
  })

  it('不覆盖已有题目', () => {
    const withQuestions = normalizeScript({
      ...legacy,
      sceneId: 'room',
      questions: [{ id: 'q1', index: 0, question: '题', options: ['A', 'B'], answerIndex: 0, explanation: '', sourceId: 'n1', scriptId: 's1', createdAt: 0 }]
    })
    expect(withQuestions.questions).toHaveLength(1)
    expect(withQuestions.sceneId).toBe('room')
  })

  it('lines 非法时回退为空数组', () => {
    const broken = normalizeScript({ ...legacy, lines: undefined } as unknown as GalScript)
    expect(broken.lines).toEqual([])
  })

  it('normalizeScripts 批量处理', () => {
    expect(normalizeScripts([legacy, legacy])[1].questions).toEqual([])
  })
})
