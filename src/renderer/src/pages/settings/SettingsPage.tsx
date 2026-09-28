import { useMemo, useState } from 'react'
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded'
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import AccessibilityNewRoundedIcon from '@mui/icons-material/AccessibilityNewRounded'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded'
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import DesktopWindowsRoundedIcon from '@mui/icons-material/DesktopWindowsRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { useAppStore } from '../../state/appStore'
import { EmptyState } from '../../components/Section'
import { AppearanceSection } from './AppearanceSection'
import { NavigationSection } from './NavigationSection'
import { AiSection } from './AiSection'
import { CompanionSection } from './CompanionSection'
import { Live2dSection } from './Live2dSection'
import { EditorSection } from './EditorSection'
import { SyncSection } from './SyncSection'
import { DeveloperSection } from './DeveloperSection'
import { AboutSection } from './AboutSection'
import { PrivacySection } from './PrivacySection'
import { DesktopSection } from './DesktopSection'

interface SettingSectionDef {
  id: string
  label: string
  hint: string
  icon: React.ReactNode
  render: () => React.ReactNode
}

export function SettingsPage() {
  const theme = useTheme()
  const settings = useAppStore((state) => state.settings)
  const resetSettings = useAppStore((state) => state.resetSettings)
  const compact = useMediaQuery('(max-width: 1100px)')
  const [active, setActive] = useState('appearance')
  const [query, setQuery] = useState('')

  const sections = useMemo<SettingSectionDef[]>(
    () => [
      {
        id: 'appearance',
        label: '外观与主题',
        hint: '配色、明暗、圆角、触屏',
        icon: <PaletteRoundedIcon fontSize="small" />,
        render: () => <AppearanceSection />
      },
      {
        id: 'navigation',
        label: '导航与模块',
        hint: '导航位置、常用、隐藏模块',
        icon: <ExploreRoundedIcon fontSize="small" />,
        render: () => <NavigationSection />
      },
      {
        id: 'ai',
        label: 'API 与语音',
        hint: '提供商、能力路由、TTS',
        icon: <BoltRoundedIcon fontSize="small" />,
        render: () => <AiSection />
      },
      {
        id: 'companion',
        label: '伴学娘',
        hint: '默认角色、主动搭话',
        icon: <SmartToyRoundedIcon fontSize="small" />,
        render: () => <CompanionSection />
      },
      {
        id: 'live2d',
        label: 'Live2D',
        hint: '模型运行时与舞台参数',
        icon: <AccessibilityNewRoundedIcon fontSize="small" />,
        render: () => <Live2dSection />
      },
      {
        id: 'editor',
        label: '编辑器与文档',
        hint: '字体、自动保存、OCR、库目录',
        icon: <EditNoteRoundedIcon fontSize="small" />,
        render: () => <EditorSection />
      },
      {
        id: 'sync',
        label: '同步',
        hint: '自动同步与默认挂载',
        icon: <CloudSyncRoundedIcon fontSize="small" />,
        render: () => <SyncSection />
      },
      {
        id: 'desktop',
        label: '桌面集成',
        hint: '托盘、全局快捷键、窗口',
        icon: <DesktopWindowsRoundedIcon fontSize="small" />,
        render: () => <DesktopSection />
      },
      {
        id: 'developer',
        label: '开发者与反馈',
        hint: '终端、错误采集、截图',
        icon: <TerminalRoundedIcon fontSize="small" />,
        render: () => <DeveloperSection />
      },
      {
        id: 'privacy',
        label: '隐私与数据',
        hint: '数据位置、导出、清理',
        icon: <ShieldRoundedIcon fontSize="small" />,
        render: () => <PrivacySection />
      },
      {
        id: 'about',
        label: '关于',
        hint: '版本、许可、更新检查',
        icon: <InfoRoundedIcon fontSize="small" />,
        render: () => <AboutSection />
      }
    ],
    []
  )

  const filteredSections = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return sections
    return sections.filter((section) => `${section.label} ${section.hint}`.toLowerCase().includes(keyword))
  }, [sections, query])

  if (!settings) {
    return <EmptyState title="设置尚未加载" description="正在读取本地设置，请稍候。" />
  }

  const current = filteredSections.find((section) => section.id === active) ?? filteredSections[0] ?? sections[0]

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '244px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
      {compact ? (
        <Stack spacing={1}>
          <TextField
            size="small"
            placeholder="搜索设置项…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
              sx: { borderRadius: 999 }
            }}
          />
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }} className="sig-scroll-thin">
            {filteredSections.map((section) => (
              <Chip
                key={section.id}
                icon={<Box sx={{ display: 'flex', '& svg': { fontSize: 16 } }}>{section.icon}</Box>}
                label={section.label}
                clickable
                color={section.id === current.id ? 'primary' : 'default'}
                variant={section.id === current.id ? 'filled' : 'outlined'}
                onClick={() => setActive(section.id)}
                sx={{ flexShrink: 0 }}
              />
            ))}
          </Stack>
        </Stack>
      ) : (
        <Box
          sx={{
            position: 'sticky',
            top: 8,
            p: 1,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7)
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.5, pt: 1, pb: 0.75 }}>
            <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ flexGrow: 1 }}>
              设置分类
            </Typography>
            <Tooltip title="恢复默认设置">
              <IconButton size="small" onClick={() => void resetSettings()}>
                <RestartAltRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ px: 1, pb: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="搜索设置项…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 999, bgcolor: 'var(--sig-surface-variant)' }
              }}
            />
          </Box>
          {filteredSections.length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1.5, display: 'block' }}>
              没有匹配的设置分类
            </Typography>
          ) : (
            <List dense disablePadding>
              {filteredSections.map((section) => {
                const isActive = section.id === current.id
                return (
                  <ListItemButton
                    key={section.id}
                    selected={isActive}
                    onClick={() => setActive(section.id)}
                    sx={{
                      borderRadius: 3,
                      mb: 0.5,
                      minHeight: 46,
                      '&.Mui-selected': {
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: isActive ? 'primary.main' : 'text.secondary' }}>
                      {section.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={section.label}
                      secondary={section.hint}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: isActive ? 700 : 500 }}
                      secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    />
                  </ListItemButton>
                )
              })}
            </List>
          )}
        </Box>
      )}

      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        {current.render()}
      </Stack>
    </Box>
  )
}
