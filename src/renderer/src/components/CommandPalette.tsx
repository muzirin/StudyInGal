import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Chip,
  Dialog,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import KeyboardReturnRoundedIcon from '@mui/icons-material/KeyboardReturnRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import HistoryToggleOffRoundedIcon from '@mui/icons-material/HistoryToggleOffRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MODULES, pathToModuleId } from '../modules/registry'

interface Command {
  id: string
  label: string
  hint: string
  group: string
  icon: React.ReactNode
  run: () => void | Promise<void>
}

export function CommandPalette() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLUListElement | null>(null)

  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const openAsk = useAppStore((state) => state.openAsk)
  const toast = useAppStore((state) => state.toast)

  const commands = useMemo<Command[]>(() => {
    const modules: Command[] = MODULES.filter((module) => {
      if (module.devOnly && !(settings?.developer.enabled ?? false)) return false
      return !(settings?.nav.hidden ?? []).includes(module.id)
    }).map((module) => {
      const Icon = module.icon
      return {
        id: `nav:${module.id}`,
        label: module.label,
        hint: module.description,
        group: '前往',
        icon: <Icon sx={{ fontSize: 18 }} />,
        run: () => navigate(module.path)
      }
    })

    const mode = settings?.theme.mode ?? 'system'
    const nextMode = mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'

    const actions: Command[] = [
      {
        id: 'action:ask',
        label: '一键询问伴学娘',
        hint: '把当前内容或问题发给伴学娘',
        group: '操作',
        icon: <HelpOutlineRoundedIcon sx={{ fontSize: 18 }} />,
        run: () => openAsk()
      },
      {
        id: 'action:theme',
        label: `切换配色模式（当前：${mode}）`,
        hint: `切换到 ${nextMode}`,
        group: '操作',
        icon:
          mode === 'dark' ? <LightModeRoundedIcon sx={{ fontSize: 18 }} /> : <DarkModeRoundedIcon sx={{ fontSize: 18 }} />,
        run: () => void patchSettings({ theme: { ...(settings?.theme as object), mode: nextMode } })
      },
      {
        id: 'action:galgame',
        label: '生成新的 Galgame 剧本',
        hint: '论文 / 教材 → 剧本',
        group: '操作',
        icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />,
        run: () => navigate('/galgame')
      },
      {
        id: 'action:sync',
        label: '立即同步所有云盘',
        hint: '运行 WebDAV / SMB 增量同步',
        group: '操作',
        icon: <SyncRoundedIcon sx={{ fontSize: 18 }} />,
        run: async () => {
          try {
            const results = await api.sync.run()
            toast('success', `已同步 ${results.length} 个挂载`)
          } catch (error) {
            toast('error', `同步失败：${(error as Error).message}`)
          }
        }
      },
      {
        id: 'action:clear-history',
        label: '清空历史记录',
        hint: '只清理首页的最近记录，不影响文件与存档',
        group: '操作',
        icon: <HistoryToggleOffRoundedIcon sx={{ fontSize: 18 }} />,
        run: async () => {
          await api.history.clear()
          toast('info', '历史记录已清空')
        }
      },
      {
        id: 'action:settings',
        label: '打开设置',
        hint: '主题、API 提供商、开发者选项',
        group: '操作',
        icon: <SettingsRoundedIcon sx={{ fontSize: 18 }} />,
        run: () => navigate('/settings')
      }
    ]

    return [...actions, ...modules]
  }, [navigate, openAsk, patchSettings, settings, toast])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return commands
    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.group}`.toLowerCase().includes(keyword)
    )
  }, [commands, query])

  useEffect(() => {
    setCursor(0)
  }, [query, open])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'k' && !event.shiftKey) {
        event.preventDefault()
        setOpen((value) => !value)
        return
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openAsk()
        return
      }
      if (mod && event.key === ',') {
        event.preventDefault()
        setOpen(false)
        navigate('/settings')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openAsk, navigate])

  useEffect(() => {
    const node = listRef.current?.querySelector('[data-active="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const execute = (command: Command | undefined): void => {
    if (!command) return
    close()
    void command.run()
  }

  const activeModuleId = pathToModuleId(window.location.hash.replace(/^#/, '') || '/')

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      TransitionProps={{ timeout: 160 }}
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      <Box
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setCursor((value) => Math.min(value + 1, filtered.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setCursor((value) => Math.max(value - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            execute(filtered[cursor])
          } else if (event.key === 'Escape') {
            close()
          }
        }}
      >
        <TextField
          autoFocus
          fullWidth
          variant="standard"
          placeholder="搜索功能、跳转或执行操作…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          InputProps={{
            disableUnderline: true,
            sx: { px: 2.5, py: 1.25, fontSize: 16 },
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon />
              </InputAdornment>
            )
          }}
        />
        <Divider />
        <List ref={listRef} sx={{ maxHeight: 420, overflowY: 'auto', py: 1 }} className="sig-scroll-thin">
          {filtered.length === 0 ? (
            <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                没有匹配项
              </Typography>
            </Box>
          ) : (
            filtered.map((command, index) => {
              const active = index === cursor
              const isCurrent = command.id === `nav:${activeModuleId}`
              return (
                <ListItemButton
                  key={command.id}
                  data-active={active}
                  selected={active}
                  onClick={() => execute(command)}
                  onMouseEnter={() => setCursor(index)}
                  sx={{
                    mx: 1,
                    borderRadius: 2,
                    '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.14) }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34, color: active ? 'primary.main' : 'text.secondary' }}>
                    {command.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{command.label}</span>
                        {isCurrent ? <Chip size="small" label="当前" /> : null}
                      </Stack>
                    }
                    secondary={command.hint}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                  />
                  <Chip size="small" variant="outlined" label={command.group} sx={{ ml: 1 }} />
                </ListItemButton>
              )
            })
          )}
        </List>
        <Divider />
        <Stack direction="row" spacing={2} sx={{ px: 2.5, py: 1 }} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            ↑↓ 选择
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <KeyboardReturnRoundedIcon sx={{ fontSize: 14 }} /> 执行
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Esc 关闭
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Chip size="small" label="Ctrl+K" variant="outlined" />
        </Stack>
      </Box>
    </Dialog>
  )
}
