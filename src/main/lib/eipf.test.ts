import { describe, expect, it } from 'vitest'
import { dialogueToEntry, questionToEntry, scriptToEntries, toBodyXhtml } from './eipf'
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

  it('scriptToEntries 生成线性连续的 index（对话在前、题目在后）', () => {
    const entries = scriptToEntries([line('character', 'a'), line('user', 'b')], [question()])
    expect(entries.map((item) => item.index)).toEqual([0, 1, 2])
    expect(entries.map((item) => item.type)).toEqual(['dialog', 'dialog', 'decision'])
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
  })
})
