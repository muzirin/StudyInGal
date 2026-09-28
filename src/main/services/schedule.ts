import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { SCHEDULE_FILE } from '@shared/constants'
import type { ScheduleEvent, ScheduleKind } from '@shared/types'

const store = new JsonStore<ScheduleEvent[]>(join(dataDir(), SCHEDULE_FILE), [])

export function listEvents(): ScheduleEvent[] {
  return store.read().sort((a, b) => a.start - b.start)
}

export function upsertEvent(input: Partial<ScheduleEvent>): ScheduleEvent {
  const list = store.read()
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged: ScheduleEvent = { ...list[index], ...input, id: list[index].id }
      list[index] = merged
      store.write(list)
      return merged
    }
  }
  const created: ScheduleEvent = {
    id: input.id ?? newId('evt'),
    kind: (input.kind ?? 'task') as ScheduleKind,
    title: input.title ?? '新事件',
    description: input.description ?? '',
    start: input.start ?? Date.now(),
    end: input.end ?? null,
    allDay: input.allDay ?? false,
    location: input.location ?? '',
    repeat: input.repeat ?? 'none',
    weekdays: input.weekdays ?? [],
    color: input.color ?? '',
    done: input.done ?? false,
    tags: input.tags ?? [],
    reminderMinutes: input.reminderMinutes ?? null
  }
  store.write([...list, created])
  return created
}

export function removeEvent(id: string): void {
  store.write(store.read().filter((item) => item.id !== id))
}

const unfold = (line: string): string =>
  line
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .trim()

function parseIcsDate(value: string): number {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!match) return Date.now()
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = match
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

export function importIcsFile(path: string): ScheduleEvent[] {
  const raw = readFileSync(path, 'utf8').split(/\r?\n/)
  const unfolded: string[] = []
  for (const line of raw) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) unfolded[unfolded.length - 1] += line.slice(1)
    else unfolded.push(line)
  }
  const imported: ScheduleEvent[] = []
  let current: Partial<ScheduleEvent> | null = null
  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') current = {}
    else if (line === 'END:VEVENT' && current) {
      if (current.title && current.start) {
        imported.push(upsertEvent({ ...current, tags: ['ics'] }))
      }
      current = null
    } else if (current) {
      const sep = line.indexOf(':')
      if (sep < 0) continue
      const key = line.slice(0, sep).split(';')[0].toUpperCase()
      const value = unfold(line.slice(sep + 1))
      if (key === 'SUMMARY') current.title = value
      else if (key === 'DTSTART') current.start = parseIcsDate(value)
      else if (key === 'DTEND') current.end = parseIcsDate(value)
      else if (key === 'LOCATION') current.location = value
      else if (key === 'DESCRIPTION') current.description = value
      else if (key === 'RRULE' && /FREQ=WEEKLY/i.test(value)) current.repeat = 'weekly'
    }
  }
  return imported
}

function formatIcsDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

export function exportIcs(target: string): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyInGal//CN', 'CALSCALE:GREGORIAN']
  for (const event of listEvents()) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}@study-in-gal`)
    lines.push(`DTSTAMP:${formatIcsDate(Date.now())}`)
    lines.push(`DTSTART:${formatIcsDate(event.start)}`)
    if (event.end) lines.push(`DTEND:${formatIcsDate(event.end)}`)
    lines.push(`SUMMARY:${event.title.replace(/[,;]/g, (m) => `\\${m}`)}`)
    if (event.location) lines.push(`LOCATION:${event.location}`)
    if (event.description) lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  writeFileSync(target, lines.join('\r\n'), 'utf8')
  return target
}
