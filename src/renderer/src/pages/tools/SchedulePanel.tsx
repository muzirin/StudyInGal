import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import UploadRoundedIcon from '@mui/icons-material/UploadRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { EmptyState, Section } from '../../components/Section'
import { formatDateTime, toLocalInput } from '../../lib/format'
import type { RepeatRule, ScheduleEvent, ScheduleKind } from '@shared/types'

const KIND_LABEL: Record<ScheduleKind, string> = {
  class: '课程',
  exam: '考试',
  task: '任务',
  plan: '计划',
  reminder: '提醒'
}

export function SchedulePanel() {
  const toast = useAppStore((state) => state.toast)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    kind: 'class' as ScheduleKind,
    start: toLocalInput(Date.now()),
    end: '',
    location: '',
    repeat: 'none' as RepeatRule,
    description: ''
  })

  const refresh = async (): Promise<void> => setEvents(await api.schedule.list())

  useEffect(() => {
    void refresh()
  }, [])

  const grouped = useMemo(() => {
    const upcoming = events.filter((event) => (event.end ?? event.start) >= Date.now() - 86_400_000)
    const past = events.filter((event) => (event.end ?? event.start) < Date.now() - 86_400_000).reverse()
    return { upcoming, past }
  }, [events])

  const submit = async (): Promise<void> => {
    if (!form.title.trim()) return
    await api.schedule.upsert({
      title: form.title.trim(),
      kind: form.kind,
      start: new Date(form.start).getTime(),
      end: form.end ? new Date(form.end).getTime() : null,
      location: form.location,
      repeat: form.repeat,
      description: form.description
    })
    setOpen(false)
    setForm({ ...form, title: '', description: '', location: '' })
    await refresh()
  }

  return (
    <Section
      title="日程 / 课表 / 待办"
      subtitle="支持 iCalendar(.ics) 导入导出"
      action={
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<UploadRoundedIcon />} onClick={async () => setEvents(await api.schedule.importIcs())}>
            导入 ICS
          </Button>
          <Button
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={async () => {
              const target = await api.dialogs.saveFile({ defaultPath: 'study-in-gal.ics' })
              if (!target) return
              await api.schedule.exportIcs(target)
              toast('success', '已导出 ICS')
            }}
          >
            导出 ICS
          </Button>
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>
            新建
          </Button>
        </Stack>
      }
    >
      {events.length === 0 ? (
        <EmptyState title="暂无日程" description="添加课程、考试、任务或学习计划，支持每周重复。" />
      ) : (
        <Stack spacing={2} sx={{ p: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            即将到来
          </Typography>
          <List dense>
            {grouped.upcoming.map((event) => (
              <ListItem
                key={event.id}
                disableGutters
                secondaryAction={
                  <IconButton
                    size="small"
                    onClick={async () => {
                      await api.schedule.remove(event.id)
                      await refresh()
                    }}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                }
              >
                <IconButton
                  size="small"
                  sx={{ mr: 1 }}
                  onClick={async () => {
                    await api.schedule.upsert({ id: event.id, done: !event.done })
                    await refresh()
                  }}
                >
                  {event.done ? <CheckCircleRoundedIcon fontSize="small" color="success" /> : <RadioButtonUncheckedRoundedIcon fontSize="small" />}
                </IconButton>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span style={{ textDecoration: event.done ? 'line-through' : 'none' }}>{event.title}</span>
                      <Chip size="small" label={KIND_LABEL[event.kind]} />
                    </Stack>
                  }
                  secondary={`${formatDateTime(event.start)}${event.location ? ` · ${event.location}` : ''}${
                    event.repeat !== 'none' ? ` · 重复：${event.repeat}` : ''
                  }`}
                />
              </ListItem>
            ))}
          </List>
          {grouped.past.length > 0 ? (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                已结束
              </Typography>
              <List dense>
                {grouped.past.slice(0, 8).map((event) => (
                  <ListItem key={event.id} disableGutters>
                    <ListItemText primary={event.title} secondary={formatDateTime(event.start)} />
                  </ListItem>
                ))}
              </List>
            </>
          ) : null}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>新建日程</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="标题" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} fullWidth />
            <TextField select label="类型" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as ScheduleKind })}>
              {Object.entries(KIND_LABEL).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="开始时间" type="datetime-local" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="结束时间（可选）" type="datetime-local" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="地点" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            <TextField select label="重复" value={form.repeat} onChange={(event) => setForm({ ...form, repeat: event.target.value as RepeatRule })}>
              <MenuItem value="none">不重复</MenuItem>
              <MenuItem value="daily">每天</MenuItem>
              <MenuItem value="weekly">每周</MenuItem>
              <MenuItem value="monthly">每月</MenuItem>
              <MenuItem value="yearly">每年</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => void submit()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Section>
  )
}
