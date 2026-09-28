import { useState } from 'react'
import { Box, Tab, Tabs } from '@mui/material'
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import TimerRoundedIcon from '@mui/icons-material/TimerRounded'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded'
import { SchedulePanel } from './tools/SchedulePanel'
import { PomodoroPanel } from './tools/PomodoroPanel'
import { WhiteNoisePanel } from './tools/WhiteNoisePanel'
import { CalculatorPanel } from './tools/CalculatorPanel'

export function ToolsPage() {
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2.5 }}>
        <Tab icon={<EventRoundedIcon fontSize="small" />} iconPosition="start" label="日程课表" />
        <Tab icon={<TimerRoundedIcon fontSize="small" />} iconPosition="start" label="番茄钟" />
        <Tab icon={<MusicNoteRoundedIcon fontSize="small" />} iconPosition="start" label="白噪音" />
        <Tab icon={<CalculateRoundedIcon fontSize="small" />} iconPosition="start" label="高数计算器" />
      </Tabs>

      {tab === 0 ? <SchedulePanel /> : null}
      {tab === 1 ? <PomodoroPanel /> : null}
      {tab === 2 ? <WhiteNoisePanel /> : null}
      {tab === 3 ? <CalculatorPanel /> : null}
    </Box>
  )
}
