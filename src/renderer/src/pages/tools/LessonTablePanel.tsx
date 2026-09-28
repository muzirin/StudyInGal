import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import TodayRoundedIcon from '@mui/icons-material/TodayRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import { toLocalInput } from '../../lib/format'
import type { ScheduleEvent, ScheduleKind } from '@shared/types'

const START_HOUR = 7
const END_HOUR = 23
const ROWS = END_HOUR - START_HOUR
const ROW_HEIGHT = 46

const KIND_LABEL: Record<ScheduleKind, string> = {
  class: '课程',
  exam: '考试',
  task: '任务',
  plan: '计划',
  reminder: '提醒'
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function startOfWeek(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  return result
}

interface Occurrence {
  event: ScheduleEvent
  start: number
  end: number
}

function expandWeek(events: ScheduleEvent[], weekStart: Date): Occurrence[] {
  const weekEnd = weekStart.getTime() + 7 * 86_400_000
  const occurrences: Occurrence[] = []
  for (const event of events) {
    const duration = (event.end ?? event.start + 3_600_000) - event.start
    if (event.repeat === 'none') {
      if (event.start >= weekStart.getTime() && event.start < weekEnd) {
        occurrences.push({ event, start: event.start, end: event.end ?? event.start + duration })
      }
      continue
    }
    if (event.repeat === 'daily') {
      for (let day = 0; day < 7; day += 1) {
        const base = new Date(event.start)
        const time = base.getHours() * 3_600_000 + base.getMinutes() * 60_000
        const start = weekStart.getTime() + day * 86_400_000 + time
        occurrences.push({ event, start, end: start + duration })
      }
      continue
    }
    if (event.repeat === 'weekly') {
      const base = new Date(event.start)
      const target = (base.getDay() + 6) % 7
      const time = base.getHours() * 3_600_000 + base.getMinutes() * 60_000
      const start = weekStart.getTime() + target * 86_400_000 + time
      occurrences.push({ event, start, end: start + duration })
    }
  }
  return occurrences
}

export function LessonTablePanel() {
  const theme = useTheme()
  const toast = useAppStore((state) => state.toast)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [draft, setDraft] = useState<{ title: string; kind: ScheduleKind; start: string; end: string } | null>(null)

  const refresh = async (): Promise<void> => setEvents(await api.schedule.list())

  useEffect(() => {
    void refresh()
  }, [])

  const occurrences = useMemo(() => expandWeek(events, weekStart), [events, weekStart])

  const paletteFor = (kind: ScheduleKind): string => {
    switch (kind) {
      case 'exam':
        return theme.palette.error.main
      case 'task':
        return theme.palette.info.main
      case 'plan':
        return theme.palette.secondary.main
      case 'reminder':
        return theme.palette.warning.main
      default:
        return theme.palette.primary.main
    }
  }

  const todayIndex = useMemo(() => {
    const now = new Date()
    const diff = Math.floor((startOfWeek(now).getTime() - weekStart.getTime()) / 86_400_000)
    if (diff !== 0) return -1
    return (now.getDay() + 6) % 7
  }, [weekStart])

  const nowOffset = useMemo(() => {
    if (todayIndex < 0) return null
    const now = new Date()
    const hours = now.getHours() + now.getMinutes() / 60
    if (hours < START_HOUR || hours > END_HOUR) return null
    return (hours - START_HOUR) * ROW_HEIGHT
  }, [todayIndex])

  const openCreate = (dayIndex: number, hour: number): void => {
    const start = new Date(weekStart)
    start.setDate(start.getDate() + dayIndex)
    start.setHours(hour, 0, 0, 0)
    const end = new Date(start)
    end.setHours(hour + 1)
    setDraft({ title: '', kind: 'class', start: toLocalInput(start.getTime()), end: toLocalInput(end.getTime()) })
  }

  return (
    <Section
      title="课表视图"
      subtitle={`${weekStart.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} 起的一周`}
      action={
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="上一周">
            <IconButton
              size="small"
              onClick={() => {
                const next = new Date(weekStart)
                next.setDate(next.getDate() - 7)
                setWeekStart(next)
              }}
            >
              <ChevronLeftRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button size="small" startIcon={<TodayRoundedIcon />} onClick={() => setWeekStart(startOfWeek(new Date()))}>
            本周
          </Button>
          <Tooltip title="下一周">
            <IconButton
              size="small"
              onClick={() => {
                const next = new Date(weekStart)
                next.setDate(next.getDate() + 7)
                setWeekStart(next)
              }}
            >
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              const now = new Date()
              openCreate((now.getDay() + 6) % 7, Math.min(END_HOUR - 1, Math.max(START_HOUR, now.getHours() + 1)))
            }}
          >
            添加
          </Button>
        </Stack>
      }
    >
      <Box sx={{ p: 2, overflowX: 'auto' }} className="sig-scroll-thin">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '58px repeat(7, minmax(96px, 1fr))',
            gridTemplateRows: `38px repeat(${ROWS}, ${ROW_HEIGHT}px)`,
            minWidth: 760,
            position: 'relative'
          }}
        >
          <Box sx={{ gridColumn: 1, gridRow: 1 }} />
          {WEEKDAYS.map((label, index) => {
            const date = new Date(weekStart)
            date.setDate(date.getDate() + index)
            const isToday = index === todayIndex
            return (
              <Box
                key={label}
                sx={{
                  gridColumn: index + 2,
                  gridRow: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: isToday ? alpha(theme.palette.primary.main, 0.12) : 'transparent'
                }}
              >
                <Typography variant="caption" fontWeight={isToday ? 700 : 500} color={isToday ? 'primary.main' : 'text.secondary'}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {date.getMonth() + 1}/{date.getDate()}
                </Typography>
              </Box>
            )
          })}

          {Array.from({ length: ROWS }, (_value, rowIndex) => {
            const hour = START_HOUR + rowIndex
            return (
              <Box key={`hour-${hour}`} sx={{ display: 'contents' }}>
                <Box
                  sx={{
                    gridColumn: 1,
                    gridRow: rowIndex + 2,
                    pr: 1,
                    textAlign: 'right',
                    borderTop: '1px dashed',
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="caption" color="text.disabled">
                    {String(hour).padStart(2, '0')}:00
                  </Typography>
                </Box>
                {WEEKDAYS.map((_day, dayIndex) => (
                  <Box
                    key={`cell-${hour}-${dayIndex}`}
                    onClick={() => openCreate(dayIndex, hour)}
                    sx={{
                      gridColumn: dayIndex + 2,
                      gridRow: rowIndex + 2,
                      borderTop: '1px dashed',
                      borderLeft: dayIndex === 0 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      bgcolor: dayIndex === todayIndex ? alpha(theme.palette.primary.main, 0.035) : 'transparent',
                      transition: 'background-color 120ms ease',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                    }}
                  />
                ))}
              </Box>
            )
          })}

          {nowOffset !== null ? (
            <Box
              sx={{
                position: 'absolute',
                left: 58,
                right: 0,
                top: 38 + nowOffset,
                borderTop: `2px solid ${theme.palette.error.main}`,
                pointerEvents: 'none',
                zIndex: 3
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: -4,
                  top: -5,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'error.main'
                }}
              />
            </Box>
          ) : null}

          {occurrences.map(({ event, start, end }, index) => {
            const startDate = new Date(start)
            const dayIndex = Math.floor((new Date(start).setHours(0, 0, 0, 0) - weekStart.getTime()) / 86_400_000)
            if (dayIndex < 0 || dayIndex > 6) return null
            const startHours = startDate.getHours() + startDate.getMinutes() / 60
            const endDate = new Date(end)
            const endHours = endDate.getHours() + endDate.getMinutes() / 60 + (endDate.getDate() !== startDate.getDate() ? 24 : 0)
            const rowStart = Math.max(0, Math.floor(startHours - START_HOUR))
            const rowSpan = Math.max(1, Math.ceil(endHours - startHours))
            const color = paletteFor(event.kind)
            return (
              <Box
                key={`${event.id}-${index}`}
                sx={{
                  gridColumn: dayIndex + 2,
                  gridRow: `${rowStart + 2} / span ${rowSpan}`,
                  m: '2px',
                  p: 0.75,
                  borderRadius: 2,
                  bgcolor: alpha(color, 0.18),
                  borderLeft: `3px solid ${color}`,
                  overflow: 'hidden',
                  zIndex: 2,
                  cursor: 'pointer',
                  opacity: event.done ? 0.55 : 1
                }}
                title={`${event.title}${event.location ? ` · ${event.location}` : ''}`}
                onClick={() => {
                  setDraft({
                    title: event.title,
                    kind: event.kind,
                    start: toLocalInput(event.start),
                    end: event.end ? toLocalInput(event.end) : ''
                  })
                }}
              >
                <Typography variant="caption" fontWeight={700} display="block" noWrap sx={{ color }}>
                  {event.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" noWrap>
                  {startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  {event.location ? ` · ${event.location}` : ''}
                </Typography>
                {rowSpan > 1 ? (
                  <Chip size="small" label={KIND_LABEL[event.kind]} sx={{ mt: 0.5, height: 17, fontSize: 10 }} />
                ) : null}
              </Box>
            )
          })}
        </Box>
      </Box>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} fullWidth maxWidth="xs">
        <DialogTitle>添加课程 / 安排</DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField autoFocus label="标题" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} fullWidth />
              <TextField select label="类型" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as ScheduleKind })}>
                {(Object.keys(KIND_LABEL) as ScheduleKind[]).map((kind) => (
                  <MenuItem key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="开始"
                type="datetime-local"
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="结束"
                type="datetime-local"
                value={draft.end}
                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>取消</Button>
          <Button
            variant="contained"
            disabled={!draft?.title.trim()}
            onClick={async () => {
              if (!draft) return
              await api.schedule.upsert({
                title: draft.title.trim(),
                kind: draft.kind,
                start: new Date(draft.start).getTime(),
                end: draft.end ? new Date(draft.end).getTime() : null
              })
              setDraft(null)
              toast('success', '已添加到日程')
              await refresh()
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
  )
}
