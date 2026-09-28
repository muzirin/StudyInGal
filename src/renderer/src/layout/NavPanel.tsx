import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV_GROUPS, MODULES, pathToModuleId, type ModuleDef } from '../modules/registry'
import { useAppStore } from '../state/appStore'

interface Props {
  collapsed: boolean
  onNavigate?: () => void
}

export function NavPanel({ collapsed, onNavigate }: Props) {
  const theme = useTheme()
  const location = useLocation()
  const activeId = pathToModuleId(location.pathname)
  const settings = useAppStore((state) => state.settings)

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ study: true })

  const hidden = settings?.nav.hidden ?? []
  const devEnabled = settings?.developer.enabled ?? false

  const visible = useMemo(
    () =>
      MODULES.filter((module) => {
        if (hidden.includes(module.id)) return false
        if (module.devOnly && !devEnabled) return false
        return true
      }),
    [hidden, devEnabled]
  )

  const matched = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return null
    return visible.filter(
      (module) =>
        module.label.toLowerCase().includes(keyword) ||
        module.description.toLowerCase().includes(keyword) ||
        (module.feature ?? '').toLowerCase().includes(keyword)
    )
  }, [query, visible])

  // 当前模块所在的组自动展开
  useEffect(() => {
    const group = NAV_GROUPS.find((entry) => entry.children.some((child) => child.id === activeId))
    if (group) setExpanded((prev) => (prev[group.id] ? prev : { ...prev, [group.id]: true }))
  }, [activeId])

  const pinned = useMemo(
    () => (settings?.nav.pinned ?? []).map((id) => visible.find((module) => module.id === id)).filter(Boolean) as ModuleDef[],
    [settings?.nav.pinned, visible]
  )

  if (collapsed) {
    return (
      <Stack
        alignItems="center"
        spacing={0.5}
        sx={{ py: 1.5, height: '100%', overflowY: 'auto' }}
        className="sig-scroll-thin"
      >
        {pinned.map((module) => (
          <RailItem key={module.id} module={module} active={activeId === module.id} onNavigate={onNavigate} />
        ))}
        <Divider flexItem sx={{ my: 1, mx: 1.5 }} />
        {visible
          .filter((module) => !pinned.some((item) => item.id === module.id))
          .map((module) => (
            <RailItem key={module.id} module={module} active={activeId === module.id} onNavigate={onNavigate} />
          ))}
      </Stack>
    )
  }

  const renderLeaf = (module: ModuleDef, indent = 2.5) => {
    const Icon = module.icon
    const isActive = activeId === module.id
    return (
      <ListItemButton
        key={module.id}
        component={NavLink}
        to={module.path}
        end={module.path === '/'}
        selected={isActive}
        onClick={onNavigate}
        sx={{
          mb: 0.25,
          pl: indent,
          minHeight: 40,
          borderRadius: 1.5,
          '&.Mui-selected': {
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.14),
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
          }
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Icon sx={{ fontSize: 18 }} />
        </ListItemIcon>
        <ListItemText
          primary={module.label}
          primaryTypographyProps={{ variant: 'body2', fontWeight: isActive ? 700 : 500 }}
        />
      </ListItemButton>
    )
  }

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="搜索功能…"
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

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1, pb: 2 }} className="sig-scroll-thin">
        {matched ? (
          <List dense disablePadding>
            {matched.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 2, display: 'block' }}>
                没有匹配的功能
              </Typography>
            ) : (
              matched.map((module) => renderLeaf(module, 2))
            )}
          </List>
        ) : (
          <>
            {pinned.length > 0 ? (
              <Box sx={{ mb: 1.5, px: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, py: 0.5 }}>
                  <PushPinRoundedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled" fontWeight={700} letterSpacing={0.8}>
                    常用
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {pinned.map((module) => {
                    const Icon = module.icon
                    const isActive = activeId === module.id
                    return (
                      <Chip
                        key={module.id}
                        size="small"
                        icon={<Icon sx={{ fontSize: 15 }} />}
                        label={module.label}
                        component={NavLink}
                        to={module.path}
                        clickable
                        color={isActive ? 'primary' : 'default'}
                        variant={isActive ? 'filled' : 'outlined'}
                        onClick={onNavigate}
                        sx={{ textDecoration: 'none' }}
                      />
                    )
                  })}
                </Stack>
              </Box>
            ) : null}

            {NAV_GROUPS.map((group) => {
              const children = group.children.filter((module) => visible.some((item) => item.id === module.id))
              if (children.length === 0) return null
              const isOpen = expanded[group.id] ?? false
              const GroupIcon = group.icon
              const hasActive = children.some((module) => module.id === activeId)
              return (
                <Box key={group.id} sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !isOpen }))}
                    sx={{
                      borderRadius: 1.5,
                      minHeight: 42,
                      bgcolor: hasActive && !isOpen ? alpha(theme.palette.primary.main, 0.08) : 'transparent'
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <GroupIcon sx={{ fontSize: 19 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={group.label}
                      secondary={group.description}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
                      secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    />
                    <IconButton
                      size="small"
                      component="span"
                      sx={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 180ms ease' }}
                    >
                      <ExpandMoreRoundedIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                  <Collapse in={isOpen} timeout={200} unmountOnExit>
                    <List dense disablePadding sx={{ mt: 0.25, ml: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
                      {children.map((module) => renderLeaf(module, 2))}
                    </List>
                  </Collapse>
                </Box>
              )
            })}
          </>
        )}
      </Box>
    </Stack>
  )
}

function RailItem({ module, active, onNavigate }: { module: ModuleDef; active: boolean; onNavigate?: () => void }) {
  const theme = useTheme()
  const Icon = module.icon
  return (
    <Tooltip title={`${module.label} · ${module.description}`} placement="right">
      <Box
        component={NavLink}
        to={module.path}
        onClick={onNavigate}
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          color: active ? 'primary.contrastText' : 'text.secondary',
          bgcolor: active ? 'primary.main' : 'transparent',
          textDecoration: 'none',
          transition: 'background-color 150ms ease, color 150ms ease',
          '&:hover': { bgcolor: active ? 'primary.main' : alpha(theme.palette.primary.main, 0.12) }
        }}
      >
        <Icon sx={{ fontSize: 21 }} />
      </Box>
    </Tooltip>
  )
}
