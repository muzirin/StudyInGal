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
 *   - 答题分支 → 每个选项一个 `predicate`（`data-references` 指向选项下标）
 *     + 该分支的角色台词（`dialog`）+ 回到主线的 `navigate`，
 *     对应「选对了强化 / 选错了由角色解释」
 */
import type { DialogueLine, QuizQuestion } from '@shared/types'

export interface EipfEntry {
  /** 对应 data-index（从 0 递增） */
  index: number
  /** 对应 data-type */
  type: 'dialog' | 'decision' | 'predicate' | 'navigate'
  /** 对应 data-cmd：保留来源命令名 */
  cmd: string
  speaker?: string
  thought?: boolean
  text?: string
  options?: { index: number; label: string }[]
  /** predicate：分支引用（对应选项下标） */
  references?: number
  /** navigate：跳转目标 data-index */
  target?: number
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

/**
 * 一道题对应的整组条目：decision + 每个选项的分支（predicate → 角色台词 → navigate）。
 *
 * EIPF 规范里 `decision` 的按钮**不写** `data-target`，分支跳转由渲染器配合
 * `predicate`（`data-references`）实现；所以这里给每个选项输出一个 predicate 条目、
 * 紧跟该分支的角色台词，最后用 `navigate` 回到主线（`data-params.to` 指向主线 entry 下标）。
 */
export function questionToEntries(
  question: QuizQuestion,
  startIndex: number,
  resumeIndex: number,
  speakerName = '角色'
): EipfEntry[] {
  const entries: EipfEntry[] = [questionToEntry(question, startIndex)]
  const branches = [...(question.branches ?? [])].sort((left, right) => left.choiceIndex - right.choiceIndex)
  for (const branch of branches) {
    const correct = branch.choiceIndex === question.answerIndex
    entries.push({
      index: entries.length + startIndex,
      type: 'predicate',
      cmd: 'Predicate',
      references: branch.choiceIndex,
      params: { references: branch.choiceIndex, correct }
    })
    entries.push({
      ...dialogueToEntry(
        {
          id: `${question.id}:branch:${branch.choiceIndex}`,
          speaker: 'character',
          text: branch.text,
          emotion: branch.emotion ?? 'neutral'
        },
        entries.length + startIndex
      ),
      speaker: speakerName,
      params: { emotion: branch.emotion ?? 'neutral', choiceIndex: branch.choiceIndex, correct, branch: true }
    })
    entries.push({
      index: entries.length + startIndex,
      type: 'navigate',
      cmd: 'GotoPage',
      target: resumeIndex,
      params: { to: resumeIndex }
    })
  }
  return entries
}

/**
 * 对话与题目按 `checkpoint` 穿插成线性条目序列：
 * 题目插在它锚定的那一行台词之后（与播放器的阶段性检测位置一致）。
 */
export function scriptToEntries(lines: DialogueLine[], questions: QuizQuestion[]): EipfEntry[] {
  const ordered = [...questions].sort(
    (left, right) => (left.checkpoint ?? Number.MAX_SAFE_INTEGER) - (right.checkpoint ?? Number.MAX_SAFE_INTEGER)
  )
  const entries: EipfEntry[] = []
  lines.forEach((line, lineIndex) => {
    entries.push(dialogueToEntry(line, entries.length))
    for (const question of ordered.filter((item) => item.checkpoint === lineIndex)) {
      // 主线回到「这一行之后」，即当前 entries 长度
      const group = questionToEntries(question, entries.length, entries.length + questionBranchesLength(question) + 1)
      entries.push(...group)
    }
  })
  // 没有锚点的老题目：接在末尾
  for (const question of ordered.filter((item) => typeof item.checkpoint !== 'number')) {
    entries.push(...questionToEntries(question, entries.length, entries.length + questionBranchesLength(question) + 1))
  }
  return entries
}

/** 分支组里除 decision 之外的条目数（用于算出主线恢复点） */
function questionBranchesLength(question: QuizQuestion): number {
  return (question.branches ?? []).length * 3
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
    if (entry.type === 'predicate') {
      return (
        `<div class="scene-entry scene-predicate" data-type="predicate" data-index="${entry.index}" data-cmd="${entry.cmd}"` +
        ` data-references="${entry.references ?? 0}" data-params="${attrEscape(JSON.stringify(entry.params))}"></div>`
      )
    }
    if (entry.type === 'navigate') {
      return (
        `<div class="scene-entry scene-navigate" data-type="navigate" data-index="${entry.index}" data-cmd="${entry.cmd}"` +
        ` data-target="${entry.target ?? 0}" data-params="${attrEscape(JSON.stringify(entry.params))}"></div>`
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
