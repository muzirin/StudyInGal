import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import type { FocusSession, FocusSummary } from '@shared/types'

const store = new JsonStore<FocusSession[]>(join(dataDir(), 'focus.json'), [])
const MAX_SESSIONS = 5000

const dayKey = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addFocus(input: { minutes: number; kind?: 'work' | 'break'; at?: number }): FocusSummary {
  const sessions = store.read()
  const entry: FocusSession = {
    id: newId('focus'),
    at: input.at ?? Date.now(),
    minutes: Math.max(0, Math.round(input.minutes)),
    kind: input.kind ?? 'work'
  }
  store.write([entry, ...sessions].slice(0, MAX_SESSIONS))
  return summary()
}

export function summary(): FocusSummary {
  const sessions = store.read().filter((session) => session.kind === 'work')
  const today = dayKey(Date.now())

  const byDay = new Map<string, number>()
  for (const session of sessions) {
    const key = dayKey(session.at)
    byDay.set(key, (byDay.get(key) ?? 0) + session.minutes)
  }

  const last7Days: { date: string; minutes: number }[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    const key = dayKey(date.getTime())
    last7Days.push({ date: key, minutes: byDay.get(key) ?? 0 })
  }

  let streakDays = 0
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    const minutes = byDay.get(dayKey(date.getTime())) ?? 0
    if (minutes > 0) streakDays += 1
    else if (offset > 0) break
  }

  return {
    todayMinutes: byDay.get(today) ?? 0,
    todaySessions: sessions.filter((session) => dayKey(session.at) === today).length,
    totalMinutes: sessions.reduce((acc, session) => acc + session.minutes, 0),
    totalSessions: sessions.length,
    streakDays,
    last7Days
  }
}
