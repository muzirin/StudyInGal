import { describe, expect, it } from 'vitest'
import { dialogueToEntry, questionToEntries, questionToEntry, scriptToEntries, toBodyXhtml } from './eipf'
import type { DialogueLine, QuizQuestion } from '@shared/types'

const line = (speaker: DialogueLine['speaker'], text: string): DialogueLine => ({
  id: `l-${speaker}-${text}`,
  speaker,
  text,
  emotion: 'happy'
})

const question = (overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: 'q1',
  index: 0,
  question: '梯度指向哪个方向？',
  options: ['最陡上坡', '最陡下坡', '随机'],
  answerIndex: 0,
  explanation: '梯度是最陡上坡。',
  branches: [
    { choiceIndex: 0, text: '对，梯度就是最陡上坡方向。', emotion: 'happy' },
    { choiceIndex: 1, text: '下坡是负梯度，别搞混啦。', emotion: 'serious' },
    { choiceIndex: 2, text: '它是确定的方向，不是随机的。', emotion: 'serious' }
  ],
  sourceId: 'node_1',
  scriptId: 'script_1',
  createdAt: 0,
  ...overrides
})

describe('EIPF 映射', () => {
  it('对话映射为 dialog 条目，旁白标记 thought', () => {
    const role = dialogueToEntry(line('character', '你好'), 0)
    expect(role.type).toBe('dialog')
    expect(role.cmd).toBe('Dialog')
    expect(role.thought).toBe(false)
    expect(role.params).toEqual({ emotion: 'happy' })

    const narration = dialogueToEntry(line('narration', '（旁白）'), 1)
    expect(narration.thought).toBe(true)
    expect(narration.speaker).toBe('')
  })

  it('题目映射为 decision 条目，选项顺序即 data-choice-index', () => {
    const entry = questionToEntry(question(), 5)
    expect(entry.type).toBe('decision')
    expect(entry.cmd).toBe('Quiz')
    expect(entry.options?.map((item) => item.index)).toEqual([0, 1, 2])
    expect(entry.params.answerIndex).toBe(0)
    expect(entry.params.options).toEqual(['最陡上坡', '最陡下坡', '随机'])
  })

  it('按选项输出分支：predicate → 角色台词 → navigate 回到主线', () => {
    // 主线恢复点在 decision 之后 = 4（1 个 decision + 3 个分支 × 3 条）
    const entries = questionToEntries(question(), 0, 10, '小樱')
    expect(entries.map((item) => item.type)).toEqual([
      'decision',
      'predicate',
      'dialog',
      'navigate',
      'predicate',
      'dialog',
      'navigate',
      'predicate',
      'dialog',
      'navigate'
    ])
    expect(entries.map((item) => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const first = entries[1]
    expect(first.references).toBe(0)
    expect(first.params.correct).toBe(true)
    const firstLine = entries[2]
    expect(firstLine.speaker).toBe('小樱')
    expect(firstLine.text).toBe('对，梯度就是最陡上坡方向。')
    expect(firstLine.params.branch).toBe(true)
    expect(entries[3].target).toBe(10)
    expect(entries[4].params.correct).toBe(false)
  })

  it('scriptToEntries 按 checkpoint 把题目穿插到对应台词之后', () => {
    const lines = [line('character', 'a'), line('character', 'b'), line('character', 'c')]
    const entries = scriptToEntries(lines, [
      question({ id: 'q2', checkpoint: 2, branches: [] }),
      question({ id: 'q1', checkpoint: 0, branches: [] })
    ])
    expect(entries.map((item) => item.type)).toEqual(['dialog', 'decision', 'dialog', 'dialog', 'decision'])
    expect(entries.map((item) => item.index)).toEqual([0, 1, 2, 3, 4])
    expect(entries[1].text).toBe('梯度指向哪个方向？')
  })

  it('没有 checkpoint 的老题目接在末尾', () => {
    const entries = scriptToEntries([line('character', 'a')], [question({ branches: [] })])
    expect(entries.map((item) => item.type)).toEqual(['dialog', 'decision'])
  })

  it('toBodyXhtml 输出合法片段并转义特殊字符', () => {
    const entries = scriptToEntries([line('character', 'a < b & "c"')], [question()])
    const xhtml = toBodyXhtml(entries, { title: '第一章 & 开场' })
    expect(xhtml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xhtml).toContain('data-type="dialog" data-index="0"')
    expect(xhtml).toContain('data-type="decision" data-index="1"')
    expect(xhtml).toContain('a &lt; b &amp; &quot;c&quot;')
    expect(xhtml).toContain('<title>第一章 &amp; 开场</title>')
    expect(xhtml).toContain('data-choice-index="0"')
    expect(xhtml).toContain('data-type="predicate"')
    expect(xhtml).toContain('data-references="2"')
    expect(xhtml).toContain('data-type="navigate"')
  })
})
