export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function toLocalInput(timestamp: number): string {
  const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60000)
  return date.toISOString().slice(0, 16)
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const days = Math.floor(diff / 86_400_000)
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return formatDate(timestamp)
}

export function dayBucket(timestamp: number): '今天' | '昨天' | '本周' | '更早' {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const today = start.getTime()
  if (timestamp >= today) return '今天'
  if (timestamp >= today - 86_400_000) return '昨天'
  if (timestamp >= today - 86_400_000 * 7) return '本周'
  return '更早'
}
