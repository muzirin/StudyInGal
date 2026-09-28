import { getSettings, updateSettings } from './settings'
import type { AppSettings } from '@shared/types'

/**
 * 学习通托管桥接。
 *
 * 实际完成作业的能力由独立子系统 Fanxing（https://github.com/muzirin/Fanxing）提供。
 * StudyInGal 通过一个本地 HTTP 服务与其通信，避免把账号密码塞进桌面端。
 * 若未配置 baseUrl，则前端会给出引导而不是伪造成功。
 */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getSettings().xuexitong.baseUrl.replace(/\/+$/, '')
  if (!baseUrl) throw new Error('尚未配置 Fanxing 服务地址（设置 → 学习通托管）')
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error(`Fanxing ${response.status}: ${await response.text().catch(() => '')}`)
  return (await response.json()) as T
}

export async function status(): Promise<{ configured: boolean; baseUrl: string; running: boolean }> {
  const settings = getSettings().xuexitong
  if (!settings.baseUrl) return { configured: false, baseUrl: '', running: false }
  try {
    const result = await call<{ running?: boolean }>('/api/status')
    return { configured: true, baseUrl: settings.baseUrl, running: result.running ?? true }
  } catch {
    return { configured: true, baseUrl: settings.baseUrl, running: false }
  }
}

export async function launch(): Promise<{ ok: boolean; message: string }> {
  const settings = getSettings().xuexitong
  if (!settings.baseUrl) {
    return { ok: false, message: '请先配置 Fanxing 服务地址，然后重新启动。' }
  }
  try {
    await call('/api/session/start', { method: 'POST', body: JSON.stringify({}) })
    return { ok: true, message: '已请求 Fanxing 启动学习通会话' }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

export async function submit(input: { taskId: string; content: string }): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await call<{ ok?: boolean; message?: string }>('/api/tasks/submit', {
      method: 'POST',
      body: JSON.stringify(input)
    })
    return { ok: result.ok ?? true, message: result.message ?? '已提交' }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

export function configure(patch: { enabled?: boolean; baseUrl?: string }): AppSettings {
  return updateSettings({ xuexitong: { ...getSettings().xuexitong, ...patch } })
}
