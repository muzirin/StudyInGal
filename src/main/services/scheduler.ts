import { getSettings } from './settings'
import { listMounts, syncMount } from './cloud/index'
import { emitEvent } from '../lib/events'

const TICK_MS = 60_000

let timer: NodeJS.Timeout | null = null
let lastRunAt = 0
let running = false

async function tick(): Promise<void> {
  if (running) return
  const settings = getSettings()
  if (!settings.sync.autoSync) return
  const intervalMs = Math.max(5, settings.sync.intervalMinutes) * 60_000
  if (Date.now() - lastRunAt < intervalMs) return

  const mounts = listMounts().filter((mount) => mount.enabled)
  if (mounts.length === 0) return

  running = true
  lastRunAt = Date.now()
  try {
    const preferred = settings.sync.mountId ? mounts.filter((mount) => mount.id === settings.sync.mountId) : mounts
    const targets = preferred.length > 0 ? preferred : mounts
    let uploaded = 0
    let downloaded = 0
    const conflicts: string[] = []
    for (const mount of targets) {
      try {
        const result = await syncMount(mount.id)
        uploaded += result.uploaded
        downloaded += result.downloaded
        conflicts.push(...result.conflicts.map((item) => `${mount.name}/${item}`))
      } catch (error) {
        emitEvent({
          type: 'toast',
          payload: { severity: 'warning', message: `自动同步失败（${mount.name}）：${(error as Error).message}` }
        })
      }
    }
    emitEvent({
      type: 'toast',
      payload: {
        severity: conflicts.length > 0 ? 'warning' : 'success',
        message:
          `自动同步完成：上传 ${uploaded}，下载 ${downloaded}` +
          (conflicts.length > 0 ? `，${conflicts.length} 个文件存在冲突已跳过` : '')
      }
    })
  } finally {
    running = false
  }
}

export function startScheduler(): void {
  if (timer) return
  // 启动后延迟一分钟再进入周期，避免拖慢冷启动
  setTimeout(() => void tick(), 60_000)
  timer = setInterval(() => void tick(), TICK_MS)
  timer.unref?.()
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
