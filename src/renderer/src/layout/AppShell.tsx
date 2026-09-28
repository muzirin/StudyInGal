import { useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  Chip,
  Divider,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Paper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import ContrastRoundedIcon from '@mui/icons-material/ContrastRounded'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { GROUP_ORDER, MODULES, pathToModuleId, type ModuleDef } from '../modules/registry'
import { useAppStore } from '../state/appStore'

const NAV_WIDTH = 252

export function AppShell() {
  const theme = useTheme()
  const location = useLocation()
  const compactViewport = useMediaQuery('(max-width: 960px)')
  const [mobileOpen, setMobileOpen] = useState(false)

  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const openAsk = useAppStore((state) => state.openAsk)

  const themeSettings = settings?.theme
  const position = themeSettings?.navPosition ?? 'left'
  const developerEnabled = settings?.developer.enabled ?? false

  const visibleModules = useMemo(
    () =>
      MODULES.filter((module) => {
        if ((settings?.nav.hidden ?? []).includes(module.id)) return false
        if (module.devOnly && !developerEnabled) return false
        return true
      }),
    [settings?.nav.hidden, developerEnabled]
  )

  const activeId = pathToModuleId(location.pathname)
  const activeModule = MODULES.find((module) => module.id === activeId)

  const horizontal = position === 'top' || position === 'bottom'

  const renderNavItems = (moduleList: ModuleDef[], onNavigate?: () => void) => {
    const grouped = GROUP_ORDER.map((group) => ({
      group,
      items: moduleList.filter((module) => module.group === group)
    })).filter((entry) => entry.items.length > 0)

    return grouped.map((entry) => (
      <Box key={entry.group}>
        <ListSubheader
          disableSticky
          sx={{ bgcolor: 'transparent', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}
        >
          {entry.group}
        </ListSubheader>
        <List dense disablePadding>
          {entry.items.map((module) => {
            const Icon = module.icon
            return (
              <ListItemButton
                key={module.id}
                component={NavLink}
                to={module.path}
                end={module.path === '/'}
                selected={activeId === module.id}
                onClick={onNavigate}
                sx={{ mb: 0.5, textDecoration: 'none' }}
              >
                <ListItemIcon sx={{ minWidth: 38 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={module.label}
                  secondary={!compactViewport ? module.description : undefined}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    noWrap: true,
                    sx: { display: 'block', maxWidth: 170 }
                  }}
                />
              </ListItemButton>
            )
          })}
        </List>
      </Box>
    ))
  }

  const cycleMode = () => {
    const order = ['system', 'light', 'dark'] as const
    const current = themeSettings?.mode ?? 'system'
    const next = order[(order.indexOf(current) + 1) % order.length]
    void patchSettings({ theme: { ...(themeSettings ?? {}), mode: next } })
  }

  const ModeIcon = themeSettings?.mode === 'dark' ? DarkModeRoundedIcon : themeSettings?.mode === 'light' ? LightModeRoundedIcon : ContrastRoundedIcon

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18
          }}
        >
          🌸
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.1}>
            StudyInGal
          </Typography>
          <Typography variant="caption" color="text.secondary">
            学习 × Galgame
          </Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ mb: 1 }} />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>{renderNavItems(visibleModules, () => setMobileOpen(false))}</Box>
      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          GPL-3.0 · muzirin/StudyInGal
        </Typography>
      </Box>
    </Box>
  )

  const topNav = (
    <Toolbar variant="dense" sx={{ gap: 1, overflowX: 'auto' }}>
      {visibleModules.map((module) => {
        const Icon = module.icon
        return (
          <Chip
            key={module.id}
            icon={<Icon fontSize="small" />}
            label={module.label}
            component={NavLink}
            to={module.path}
            clickable
            color={activeId === module.id ? 'primary' : 'default'}
            variant={activeId === module.id ? 'filled' : 'outlined'}
            sx={{ textDecoration: 'none', flexShrink: 0 }}
          />
        )
      })}
    </Toolbar>
  )

  const bottomNav = (
    <Paper
      square
      elevation={8}
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: theme.zIndex.appBar, pb: 'env(safe-area-inset-bottom)' }}
    >
      <Toolbar variant="dense" sx={{ gap: 1, overflowX: 'auto', justifyContent: 'center' }}>
        {visibleModules.slice(0, 6).map((module) => {
          const Icon = module.icon
          return (
            <Box
              key={module.id}
              component={NavLink}
              to={module.path}
              sx={{
                textDecoration: 'none',
                color: activeId === module.id ? 'primary.main' : 'text.secondary',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                px: 1.5,
                minWidth: 64
              }}
            >
              <Icon fontSize="small" />
              <Typography variant="caption" noWrap>
                {module.label}
              </Typography>
            </Box>
          )
        })}
      </Toolbar>
    </Paper>
  )

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {position === 'left' && !compactViewport ? (
        <Drawer
          variant="permanent"
          anchor="left"
          sx={{
            width: NAV_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' }
          }}
        >
          {drawer}
        </Drawer>
      ) : null}

      {position === 'right' && !compactViewport ? (
        <Drawer
          variant="permanent"
          anchor="right"
          sx={{
            width: NAV_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box', borderLeft: '1px solid', borderColor: 'divider' }
          }}
        >
          {drawer}
        </Drawer>
      ) : null}

      {horizontal || compactViewport ? (
        <Drawer
          variant="temporary"
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' } }}
        >
          {drawer}
        </Drawer>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, height: '100%' }}>
        <AppBar
          position="static"
          color="transparent"
          elevation={0}
          sx={{ backdropFilter: 'blur(12px)', borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {position === 'left' || position === 'right' || compactViewport ? (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="打开导航">
                <MenuRoundedIcon />
              </IconButton>
            ) : null}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {activeModule?.label ?? 'StudyInGal'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {activeModule?.feature ?? '学习 × Galgame 一体化桌面系统'}
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title={`配色模式：${themeSettings?.mode ?? 'system'}（点击切换）`}>
              <IconButton onClick={cycleMode}>
                <ModeIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="一键询问当前内容">
              <IconButton onClick={() => openAsk()}>
                <HelpOutlineRoundedIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
          {position === 'top' ? topNav : null}
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            p: compactViewport ? 1.5 : 3,
            pb: position === 'bottom' ? 10 : compactViewport ? 1.5 : 3
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {position === 'bottom' ? bottomNav : null}

      <Fab
        color="primary"
        aria-label="一键询问"
        onClick={() => openAsk()}
        sx={{ position: 'fixed', right: 24, bottom: position === 'bottom' ? 88 : 24, zIndex: theme.zIndex.speedDial }}
      >
        <HelpOutlineRoundedIcon />
      </Fab>
    </Box>
  )
}
