import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Chip, MenuItem, Slider, Stack, TextField, Typography } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { Section } from '../../components/Section'
import { formatClock } from '../../lib/format'

export function PomodoroPanel() {
  const [workMinutes, setWorkMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [phase, setPhase] = useState<'work' | 'break'>('work')
  const [remaining, setRemaining] = useState(25 * 60_000)
  const [running, setRunning] = useState(false)
  const [cycles, setCycles] = useState(0)
  const deadlineRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    deadlineRef.current = Date.now() + remaining
    const timer = window.setInterval(() => {
      const left = (deadlineRef.current ?? Date.now()) - Date.now()
      if (left <= 0) {
        setRunning(false)
        if (phase === 'work') {
          setCycles((value) => value + 1)
          setPhase('break')
          setRemaining(breakMinutes * 60_000)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('StudyInGal 番茄钟', { body: '专注结束，休息一下吧～' })
          }
        } else {
          setPhase('work')
          setRemaining(workMinutes * 60_000)
        }
      } else {
        setRemaining(left)
      }
    }, 250)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, workMinutes, breakMinutes])

  const total = useMemo(() => (phase === 'work' ? workMinutes : breakMinutes) * 60_000, [phase, workMinutes, breakMinutes])
  const progress = Math.max(0, Math.min(1, 1 - remaining / total))

  return (
    <Section title="番茄钟" subtitle={`已完成 ${cycles} 个专注周期`}>
      <Stack alignItems="center" spacing={2.5} sx={{ py: 2 }}>
        <Box sx={{ position: 'relative', width: 220, height: 220 }}>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(var(--mui-palette-primary-main) ${progress * 360}deg, var(--sig-surface-variant) 0deg)`
            }}
          />
          <Box sx={{ position: 'absolute', inset: 12, borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center' }}>
            <Stack alignItems="center">
              <Chip size="small" color={phase === 'work' ? 'primary' : 'success'} label={phase === 'work' ? '专注' : '休息'} />
              <Typography variant="h3" fontWeight={700}>
                {formatClock(remaining)}
              </Typography>
            </Stack>
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            startIcon={running ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
            onClick={() => {
              if (!running && 'Notification' in window && Notification.permission === 'default') {
                void Notification.requestPermission()
              }
              setRunning((value) => !value)
            }}
          >
            {running ? '暂停' : '开始'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestartAltRoundedIcon />}
            onClick={() => {
              setRunning(false)
              setPhase('work')
              setRemaining(workMinutes * 60_000)
            }}
          >
            重置
          </Button>
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField
            select
            size="small"
            label="专注"
            value={workMinutes}
            onChange={(event) => {
              const value = Number(event.target.value)
              setWorkMinutes(value)
              if (phase === 'work' && !running) setRemaining(value * 60_000)
            }}
          >
            {[15, 20, 25, 30, 45, 50, 60].map((value) => (
              <MenuItem key={value} value={value}>
                {value} 分钟
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="休息"
            value={breakMinutes}
            onChange={(event) => {
              const value = Number(event.target.value)
              setBreakMinutes(value)
              if (phase === 'break' && !running) setRemaining(value * 60_000)
            }}
          >
            {[3, 5, 10, 15].map((value) => (
              <MenuItem key={value} value={value}>
                {value} 分钟
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Box sx={{ width: 280 }}>
          <Typography variant="caption" color="text.secondary">
            音量提醒（可选）
          </Typography>
          <Slider
            size="small"
            defaultValue={0}
            min={0}
            max={100}
            onChange={(_event, value) => {
              if (value === 0) return
              const audio = new AudioContext()
              const oscillator = audio.createOscillator()
              const gain = audio.createGain()
              gain.gain.value = ((value as number) / 100) * 0.05
              oscillator.connect(gain).connect(audio.destination)
              oscillator.start()
              setTimeout(() => {
                oscillator.stop()
                void audio.close()
              }, 140)
            }}
          />
        </Box>
      </Stack>
    </Section>
  )
}
