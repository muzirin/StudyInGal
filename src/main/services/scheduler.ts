import { Notification } from 'electron'
import { getSettings } from './settings'
import { listMounts, syncMount } from './cloud/index'
import { listEvents } from './schedule'
import { emitEvent } from '../lib/events'

const TICK_MS = 60_000

let timer: NodeJS.Timeout | null = null
let lastRunAt = 0
let running = false
const firedReminders = new Set<string>()

/** 日程提醒：到点后弹系统通知 + 应用内提示，同一事件只提醒一次 */
function checkReminders(): void {
  const now = Date.now()
  for (const event of listEvents()) {
    if (event.done || event.reminderMinutes === null || event.reminderMinutes === undefined) continue
    const fireAt = event.start - Math.max(0, event.reminderMinutes) * 60_000
    const key = `${event.id}@${event.start}`
    if (firedReminders.has(key)) continue
    if (now < fireAt) continue
    // 超过 30 分钟仍未提醒的（例如应用当时未运行）直接跳过，避免开机后被旧提醒轰炸
    if (now - event.start > 30 * 60_000) {
      firedReminders.add(key)
      continue
    }
    firedReminders.add(key)

    const minutesLeft = Math.round((event.start - now) / 60_000)
    const body =
      minutesLeft > 0 ? `还有约 ${minutesLeft} 分钟：${event.title}` : `即将开始：${event.title}${event.location ? ` @ ${event.location}` : ''}`
    if (Notification.isSupported()) {
      new Notification({ title: 'StudyInGal 提醒', body }).show()
    }
    emitEvent({ type: 'toast', payload: { severity: 'info', message: `⏰ ${body}` } })
  }
}

async function tick(): Promise<void> {
  checkReminders()

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
  // 启动后先做一次提醒检查，再进入周期
  setTimeout(() => {
    checkReminders()
    void tick()
  }, 5_000)
  timer = setInterval(() => void tick(), TICK_MS)
  timer.unref?.()
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
