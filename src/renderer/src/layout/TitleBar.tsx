import { useEffect, useState } from 'react'
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import MinimizeRoundedIcon from '@mui/icons-material/MinimizeRounded'
import CropSquareRoundedIcon from '@mui/icons-material/CropSquareRounded'
import FilterNoneRoundedIcon from '@mui/icons-material/FilterNoneRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { ShortcutHelpButton } from '../components/ShortcutHelp'
import type { WindowState } from '@shared/types'

const isMac = window.study?.platform === 'darwin'

function ControlButton({
  title,
  onClick,
  danger,
  children
}: {
  title: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  const theme = useTheme()
  return (
    <Tooltip title={title}>
      <IconButton
        className="no-drag"
        onClick={onClick}
        size="small"
        sx={{
          borderRadius: 1.5,
          width: 42,
          height: 30,
          color: 'text.secondary',
          transition: 'background-color 120ms ease, color 120ms ease',
          '&:hover': {
            bgcolor: danger ? theme.palette.error.main : alpha(theme.palette.primary.main, 0.14),
            color: danger ? theme.palette.error.contrastText : 'text.primary'
          }
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  )
}

export function TitleBar({
  title,
  subtitle,
  leading
}: {
  title: string
  subtitle?: string
  leading?: React.ReactNode
}) {
  const theme = useTheme()
  const openAsk = useAppStore((state) => state.openAsk)
  const developerEnabled = useAppStore((state) => state.settings?.developer.enabled ?? false)
  const [state, setState] = useState<WindowState>({ maximized: false, fullscreen: false, focused: true })

  useEffect(() => {
    let alive = true
    void api.app.windowState().then((next) => {
      if (alive) setState(next)
    })
    const unsubscribe = api.events.subscribe((event) => {
      const typed = event as { type: string; payload: WindowState }
      if (typed.type === 'window-state') setState(typed.payload)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  return (
    <Box
      className="drag-region"
      sx={{
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: isMac ? 10 : 1.5,
        pr: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, state.focused ? 0.72 : 0.92),
        backdropFilter: 'blur(14px)',
        transition: 'background-color 160ms ease',
        userSelect: 'none'
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flexGrow: 1 }}>
        {leading}
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            flexShrink: 0
          }}
        >
          🌸
        </Box>
        <Typography variant="subtitle2" fontWeight={700} noWrap>
          StudyInGal
        </Typography>
        {title ? (
          <>
            <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
              /
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {title}
              {subtitle ? ` · ${subtitle}` : ''}
            </Typography>
          </>
        ) : null}
        {developerEnabled ? (
          <Box
            sx={{
              px: 0.75,
              py: 0.1,
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              bgcolor: alpha(theme.palette.warning.main, 0.18),
              color: theme.palette.warning.dark,
              flexShrink: 0
            }}
          >
            DEV
          </Box>
        ) : null}
      </Stack>

      <ShortcutHelpButton />

      <Tooltip title="一键询问（Ctrl+Shift+K）">
        <IconButton className="no-drag" size="small" onClick={() => openAsk()} sx={{ mr: 0.5 }}>
          <HelpOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {!isMac ? (
        <Stack direction="row" spacing={0.25} className="no-drag">
          <ControlButton title="最小化" onClick={() => void api.app.window('minimize')}>
            <MinimizeRoundedIcon sx={{ fontSize: 16 }} />
          </ControlButton>
          <ControlButton
            title={state.maximized ? '向下还原' : '最大化'}
            onClick={() => void api.app.window('toggle-maximize')}
          >
            {state.maximized ? <FilterNoneRoundedIcon sx={{ fontSize: 14 }} /> : <CropSquareRoundedIcon sx={{ fontSize: 14 }} />}
          </ControlButton>
          <ControlButton title="关闭" danger onClick={() => void api.app.window('close')}>
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </ControlButton>
        </Stack>
      ) : null}
    </Box>
  )
}
