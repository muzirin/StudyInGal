/**
 * StudyInGal → EIPF（Electric Interactive Publications Format）映射。
 *
 * EIPF 的内容模型是 **线性的 `scene-entry` 序列**（见 EIPF `zh-CN/spec/body-xhtml.md`），
 * 每个条目一个 `<div class="scene-entry ..." data-type="...">`，带 `data-index` 线性序号；
 * 未在规范里单列的类型统一把参数放进 `data-params`（JSON）。
 *
 * 本文件把剧本与题目映射过去，供后续导出 `.eipf` 包使用：
 *   - 对话行 → `data-type="dialog"`（`data-speaker` / `data-thought`）
 *   - 单选题 → `data-type="decision"`（选项即 `data-choice-index`；
 *     正确项与解析放进 `data-params`，因为 EIPF 的 decision 只描述分支，不描述对错）
 */
import type { DialogueLine, QuizQuestion } from '@shared/types'

export interface EipfEntry {
  /** 对应 data-index（从 0 递增） */
  index: number
  /** 对应 data-type */
  type: 'dialog' | 'decision'
  /** 对应 data-cmd：保留来源命令名 */
  cmd: string
  speaker?: string
  thought?: boolean
  text?: string
  options?: { index: number; label: string }[]
  /** 对应 data-params（JSON） */
  params: Record<string, unknown>
}

const xmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const attrEscape = (value: string): string => xmlEscape(value).replace(/'/g, '&apos;')

export function dialogueToEntry(line: DialogueLine, index: number): EipfEntry {
  const speaker = line.speaker === 'narration' ? '' : line.speaker === 'user' ? '我' : undefined
  return {
    index,
    type: 'dialog',
    cmd: 'Dialog',
    ...(speaker !== undefined ? { speaker } : {}),
    thought: line.speaker === 'narration',
    text: line.text,
    params: { emotion: line.emotion }
  }
}

export function questionToEntry(question: QuizQuestion, index: number): EipfEntry {
  return {
    index,
    type: 'decision',
    cmd: 'Quiz',
    text: question.question,
    options: question.options.map((label, optionIndex) => ({ index: optionIndex, label })),
    params: {
      answerIndex: question.answerIndex,
      explanation: question.explanation,
      // 与 EIPF 的 params 约定保持一致：把原始结构完整保留
      options: question.options
    }
  }
}

/** 对话在前、题目在后（导出时可自行按幕穿插）。 */
export function scriptToEntries(lines: DialogueLine[], questions: QuizQuestion[]): EipfEntry[] {
  const entries: EipfEntry[] = []
  lines.forEach((line) => entries.push(dialogueToEntry(line, entries.length)))
  questions.forEach((question) => entries.push(questionToEntry(question, entries.length)))
  return entries
}

/** 生成 EIPF 的 body.xhtml（HTML 片段部分），便于打包进 .eipf。 */
export function toBodyXhtml(entries: EipfEntry[], options: { title: string; language?: string } = { title: '' }): string {
  const blocks = entries.map((entry) => {
    if (entry.type === 'dialog') {
      const speakerAttr = entry.speaker !== undefined ? ` data-speaker="${attrEscape(entry.speaker)}"` : ''
      const thoughtAttr = entry.thought ? ' data-thought="true"' : ''
      const speakerSpan = entry.speaker ? `\n  <span class="speaker">${xmlEscape(entry.speaker)}</span>` : ''
      return (
        `<div class="scene-entry scene-dialogue" data-type="dialog" data-index="${entry.index}" data-cmd="${entry.cmd}"` +
        `${speakerAttr}${thoughtAttr} data-params="${attrEscape(JSON.stringify(entry.params))}">` +
        `${speakerSpan}\n  <span class="text">${xmlEscape(entry.text ?? '')}</span>\n</div>`
      )
    }
    const buttons = (entry.options ?? [])
      .map((option) => `\n  <button class="choice-btn" data-choice-index="${option.index}">${xmlEscape(option.label)}</button>`)
      .join('')
    return (
      `<div class="scene-entry scene-decision" data-type="decision" data-index="${entry.index}" data-cmd="${entry.cmd}"` +
      ` data-text="${attrEscape(entry.text ?? '')}" data-params="${attrEscape(JSON.stringify(entry.params))}">${buttons}\n</div>`
    )
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="' + (options.language ?? 'zh-CN') + '">',
    '<head>',
    '  <meta charset="UTF-8"/>',
    `  <title>${xmlEscape(options.title)}</title>`,
    '</head>',
    '<body class="scenario-body">',
    '  <!-- ═══ entries (index order) ═══ -->',
    ...blocks,
    '</body>',
    '</html>',
    ''
  ].join('\n')
}
