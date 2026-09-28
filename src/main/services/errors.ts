import { app } from 'electron'
import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { GITHUB_ISSUES_URL, GITHUB_REPO, GITHUB_URL } from '@shared/constants'
import { getSettings } from './settings'
import type { CapturedError, IssueDraft } from '@shared/types'

const store = new JsonStore<CapturedError[]>(join(dataDir(), 'errors.json'), [])
const MAX_ERRORS = 200

export function captureError(input: {
  message: string
  stack?: string
  context?: string
  extra?: Record<string, unknown>
}): CapturedError {
  const captured: CapturedError = {
    id: newId('err'),
    message: input.message || '未知错误',
    stack: input.stack ?? '',
    context: input.context ?? '',
    appVersion: app.getVersion(),
    platform: `${process.platform}-${process.arch}`,
    timestamp: Date.now(),
    extra: input.extra ?? {}
  }
  if (!getSettings().telemetry.crashReporting) return captured
  store.update((list) => [captured, ...list].slice(0, MAX_ERRORS))
  return captured
}

export function listErrors(): CapturedError[] {
  return store.read()
}

export function clearErrors(): void {
  store.write([])
}

function buildBody(error: CapturedError | null, errors: CapturedError[]): string {
  const relevant = error ? [error, ...errors.filter((item) => item.id !== error.id)] : errors
  const latest = relevant.slice(0, 3)
  const environment = [
    `- StudyInGal: ${app.getVersion()}`,
    `- Electron: ${process.versions.electron}`,
    `- Chrome: ${process.versions.chrome}`,
    `- Node: ${process.versions.node}`,
    `- OS: ${process.platform} ${process.arch}`
  ].join('\n')

  const details = latest
    .map(
      (item, index) =>
        `### 错误 ${index + 1}：${item.message}\n\n` +
        `- 时间：${new Date(item.timestamp).toISOString()}\n` +
        `- 场景：${item.context || '未标注'}\n\n` +
        '```\n' +
        (item.stack || '(无堆栈)') +
        '\n```'
    )
    .join('\n\n')

  return [
    '## 问题描述',
    '<!-- 请补充你期望发生什么、实际发生了什么 -->',
    '',
    '## 复现步骤',
    '1. ',
    '2. ',
    '',
    '## 运行环境',
    environment,
    '',
    '## 自动采集的错误日志',
    details || '(暂无)',
    '',
    `> 由 StudyInGal 自动生成 · ${GITHUB_URL}`
  ].join('\n')
}

export function draftIssue(id?: string): IssueDraft {
  const errors = listErrors()
  const error = id ? errors.find((item) => item.id === id) ?? null : errors[0] ?? null
  const title = error ? `[Bug] ${error.message.slice(0, 80)}` : `[Bug] ${GITHUB_REPO} 问题反馈`
  const body = buildBody(error, errors)
  const url = `${GITHUB_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug`
  return { title, body, url }
}
