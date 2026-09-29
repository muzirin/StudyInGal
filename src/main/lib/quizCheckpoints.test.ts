import { describe, expect, it } from 'vitest'
import { assignCheckpoints, hasCheckpoint, planSegments, progressiveQuizInstruction, segmentBlocks } from './quizCheckpoints'

describe('planSegments', () => {
  it('平均分段且首尾连续', () => {
    const segments = planSegments(3, 30)
    expect(segments).toEqual([
      { index: 0, start: 0, end: 10 },
      { index: 1, start: 10, end: 20 },
      { index: 2, start: 20, end: 30 }
    ])
    expect(segments[0].end).toBe(segments[1].start)
  })

  it('行数少于题数时允许空段', () => {
    expect(planSegments(3, 1).map((segment) => segment.end)).toEqual([0, 0, 1])
  })

  it('没有题目时返回空', () => {
    expect(planSegments(0, 30)).toEqual([])
  })
})

describe('assignCheckpoints', () => {
  it('与分段一致：落在该段最后一行', () => {
    expect(assignCheckpoints(6, 60)).toEqual([9, 19, 29, 39, 49, 59])
    expect(planSegments(6, 60).map((segment) => segment.end - 1)).toEqual(assignCheckpoints(6, 60))
  })

  it('单调不减，且都在行范围内', () => {
    const points = assignCheckpoints(5, 7)
    expect(points).toEqual([...points].sort((a, b) => a - b))
    expect(points.every((point) => point >= 0 && point <= 6)).toBe(true)
  })

  it('行数少于题数时允许同一点连续检测', () => {
    expect(assignCheckpoints(3, 2)).toEqual([0, 0, 1])
  })

  it('没有题目或没有行时的边界', () => {
    expect(assignCheckpoints(0, 60)).toEqual([])
    expect(assignCheckpoints(3, 0)).toEqual([0, 0, 0])
  })
})

describe('progressiveQuizInstruction', () => {
  const text = progressiveQuizInstruction(3, 30)

  it('写明按段渐进，并给出每段大致行数', () => {
    expect(text).toContain('平均分成 3 段')
    expect(text).toContain('每段约 10 行')
    expect(text).toContain('第 1 题只考第 1 段')
    expect(text).toContain('第 3 题只考第 3 段')
  })

  it('明确禁止超纲问后面的内容', () => {
    expect(text).toContain('严禁考察后面段落')
    expect(text).toContain('整篇主旨')
  })

  it('没有题目时给出空串', () => {
    expect(progressiveQuizInstruction(0, 30)).toBe('')
  })
})

describe('segmentBlocks', () => {
  const lines = Array.from({ length: 30 }, (_, index) => ({ speaker: index % 2 ? 'user' : 'character', text: `第${index + 1}句` }))

  it('按题数切块并标出范围，第 i 块只含第 i 段台词', () => {
    const blocks = segmentBlocks(lines, 3).split('\n\n')
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toContain('【第 1 题：只能考这一段（第 1-10 行）】')
    expect(blocks[0]).toContain('第10句')
    expect(blocks[0]).not.toContain('第11句')
    expect(blocks[2]).toContain('【第 3 题：只能考这一段（第 21-30 行）】')
    expect(blocks[2]).toContain('第30句')
  })

  it('支持自定义行标签与每块字符预算', () => {
    const blocks = segmentBlocks(lines.slice(0, 4), 2, { perBlockChars: 800, label: (line) => `【${line.speaker}】${line.text}` })
    expect(blocks).toContain('【第 1 题：只能考这一段（第 1-2 行）】')
    expect(blocks).toContain('【character】第1句')
  })

  it('没有题目或没有台词时返回空串', () => {
    expect(segmentBlocks(lines, 0)).toBe('')
    expect(segmentBlocks([], 3)).toBe('')
  })
})

describe('hasCheckpoint', () => {
  it('区分新旧数据', () => {
    expect(hasCheckpoint({ checkpoint: 3 })).toBe(true)
    expect(hasCheckpoint({ checkpoint: 0 })).toBe(true)
    expect(hasCheckpoint({ checkpoint: null })).toBe(false)
    expect(hasCheckpoint({})).toBe(false)
  })
})
