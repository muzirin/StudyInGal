import { useState } from 'react'
import { Box, Chip, List, ListItemButton, ListItemIcon, ListItemText, Stack, Typography, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded'
import { SchedulePanel } from './tools/SchedulePanel'
import { PomodoroPanel } from './tools/PomodoroPanel'
import { WhiteNoisePanel } from './tools/WhiteNoisePanel'
import { CalculatorPanel } from './tools/CalculatorPanel'
import { LessonTablePanel } from './tools/LessonTablePanel'

interface ToolDef {
  id: string
  label: string
  hint: string
  icon: React.ReactNode
  render: () => React.ReactNode
}

export function ToolsPage() {
  const theme = useTheme()
  const compact = useMediaQuery('(max-width: 1100px)')
  const [active, setActive] = useState('schedule')

  const tools: ToolDef[] = [
    { id: 'schedule', label: '日程与待办', hint: '任务、考试、提醒、ICS', icon: <ChecklistRoundedIcon fontSize="small" />, render: () => <SchedulePanel /> },
    { id: 'timetable', label: '课表视图', hint: '按周查看课程安排', icon: <TableChartRoundedIcon fontSize="small" />, render: () => <LessonTablePanel /> },
    { id: 'pomodoro', label: '番茄钟', hint: '专注与休息周期', icon: <TimerRoundedIcon fontSize="small" />, render: () => <PomodoroPanel /> },
    { id: 'noise', label: '白噪音', hint: '雨声、海浪、棕噪音', icon: <MusicNoteRoundedIcon fontSize="small" />, render: () => <WhiteNoisePanel /> },
    { id: 'calculator', label: '高数计算器', hint: '求值、求导、化简', icon: <CalculateRoundedIcon fontSize="small" />, render: () => <CalculatorPanel /> }
  ]

  const current = tools.find((tool) => tool.id === active) ?? tools[0]

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '224px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
      {compact ? (
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }} className="sig-scroll-thin">
          {tools.map((tool) => (
            <Chip
              key={tool.id}
              icon={<Box sx={{ display: 'flex', '& svg': { fontSize: 16 } }}>{tool.icon}</Box>}
              label={tool.label}
              clickable
              color={tool.id === current.id ? 'primary' : 'default'}
              variant={tool.id === current.id ? 'filled' : 'outlined'}
              onClick={() => setActive(tool.id)}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            position: 'sticky',
            top: 8,
            p: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7)
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.5, py: 1 }}>
            <EventRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled">
              学习工具
            </Typography>
          </Stack>
          <List dense disablePadding>
            {tools.map((tool) => {
              const isActive = tool.id === current.id
              return (
                <ListItemButton
                  key={tool.id}
                  selected={isActive}
                  onClick={() => setActive(tool.id)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    minHeight: 46,
                    '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.14), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34, color: isActive ? 'primary.main' : 'text.secondary' }}>{tool.icon}</ListItemIcon>
                  <ListItemText
                    primary={tool.label}
                    secondary={tool.hint}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: isActive ? 700 : 500 }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                  />
                </ListItemButton>
              )
            })}
          </List>
        </Box>
      )}

      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        {current.render()}
      </Stack>
    </Box>
  )
}
