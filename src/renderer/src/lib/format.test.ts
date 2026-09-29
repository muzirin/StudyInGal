import { describe, expect, it } from 'vitest'
import { dayBucket, formatBytes, formatClock, formatRelative, toLocalInput } from './format'

describe('formatBytes', () => {
  it('以 1024 进制换算并保留合适精度', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
  })

  it('对非法输入回退为 0 B', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

describe('formatClock', () => {
  it('输出 mm:ss 并向下保护负数', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65_000)).toBe('01:05')
    expect(formatClock(-500)).toBe('00:00')
  })
})

describe('formatRelative', () => {
  it('按时间跨度返回中文相对时间', () => {
    const now = Date.now()
    expect(formatRelative(now)).toBe('刚刚')
    expect(formatRelative(now - 5 * 60_000)).toBe('5 分钟前')
    expect(formatRelative(now - 3 * 3_600_000)).toBe('3 小时前')
    expect(formatRelative(now - 26 * 3_600_000)).toBe('昨天')
    expect(formatRelative(now - 3 * 86_400_000)).toBe('3 天前')
  })
})

describe('dayBucket', () => {
  it('按自然日划分桶', () => {
    // 用「今天正午」而不是相对小时数，避免测试依赖运行时刻（UTC 下会跨日）
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const noon = today.getTime()
    expect(dayBucket(noon)).toBe('今天')
    expect(dayBucket(noon - 86_400_000)).toBe('昨天')
    expect(dayBucket(noon - 4 * 86_400_000)).toBe('本周')
    expect(dayBucket(noon - 30 * 86_400_000)).toBe('更早')
  })
})

describe('toLocalInput', () => {
  it('输出 datetime-local 需要的格式', () => {
    expect(toLocalInput(Date.now())).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})
