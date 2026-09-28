import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Chip,
  Divider,
  Drawer,
  Fab,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded'
import CloseFullscreenRoundedIcon from '@mui/icons-material/CloseFullscreenRounded'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { TitleBar } from './TitleBar'
import { NavPanel } from './NavPanel'
import { RouteTransition } from '../components/RouteTransition'
import { CommandPalette } from '../components/CommandPalette'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { GROUP_ORDER, MODULES, pathToModuleId, type ModuleDef } from '../modules/registry'
import { useAppStore } from '../state/appStore'

const NAV_WIDTH = 264
const RAIL_WIDTH = 76

export function AppShell() {
  const theme = useTheme()
  const location = useLocation()
  const compactViewport = useMediaQuery('(max-width: 980px)')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [rail, setRail] = useState(false)

  const settings = useAppStore((state) => state.settings)
  const openAsk = useAppStore((state) => state.openAsk)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const crumb = useAppStore((state) => state.crumb)
  const setCrumb = useAppStore((state) => state.setCrumb)
  const immersive = useAppStore((state) => state.immersive)
  const setImmersive = useAppStore((state) => state.setImmersive)

  const position = settings?.theme.navPosition ?? 'left'
  const devEnabled = settings?.developer.enabled ?? false
  const hidden = settings?.nav.hidden ?? []

  const visibleModules = useMemo(
    () =>
      MODULES.filter((module) => {
        if (hidden.includes(module.id)) return false
        if (module.devOnly && !devEnabled) return false
        return true
      }),
    [hidden, devEnabled]
  )

  const activeId = pathToModuleId(location.pathname)
  const activeModule = MODULES.find((module) => module.id === activeId)
  const isHome = location.pathname === '/'

  const firstRouteEffect = useRef(true)
  useEffect(() => {
    setMobileOpen(false)
    setCrumb(null)
    // 首次挂载不要重置沉浸模式，否则会覆盖页面自己设置的初始状态（如 ?immersive=1）
    if (firstRouteEffect.current) {
      firstRouteEffect.current = false
      return
    }
    setImmersive(false)
  }, [location.pathname, setCrumb, setImmersive])

  const navWidth = rail ? RAIL_WIDTH : NAV_WIDTH
  const horizontal = position === 'top' || position === 'bottom'

  const navPane = (
    <Stack
      sx={{
        width: horizontal || compactViewport ? NAV_WIDTH : navWidth,
        flexShrink: 0,
        height: '100%',
        borderRight: position === 'left' ? '1px solid' : 'none',
        borderLeft: position === 'right' ? '1px solid' : 'none',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.55),
        backdropFilter: 'blur(10px)',
        transition: 'width 200ms cubic-bezier(0.22, 1, 0.36, 1)'
      }}
    >
      {!rail || compactViewport ? (
        <Stack direction="row" alignItems="center" sx={{ px: 1.5, pt: 1.25, pb: 0.25 }}>
          <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ flexGrow: 1, pl: 0.5 }}>
            导航
          </Typography>
          {!compactViewport ? (
            <Tooltip title="收起为图标栏">
              <IconButton size="small" onClick={() => setRail(true)}>
                <ChevronLeftRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      ) : (
        <Stack alignItems="center" sx={{ pt: 1.25 }}>
          <Tooltip title="展开导航" placement="right">
            <IconButton size="small" onClick={() => setRail(false)}>
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
      <NavPanel collapsed={rail && !compactViewport} onNavigate={() => setMobileOpen(false)} />
    </Stack>
  )

  const horizontalNav = (
    <Paper
      square
      elevation={0}
      sx={{
        flexShrink: 0,
        borderBottom: position === 'top' ? '1px solid' : 'none',
        borderTop: position === 'bottom' ? '1px solid' : 'none',
        borderColor: 'divider',
        order: position === 'bottom' ? 3 : 0
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ px: 2, py: 0.75, overflowX: 'auto' }}
        className="sig-scroll-thin"
      >
        {GROUP_ORDER.map((group) => {
          const children = visibleModules.filter((module) => module.group === group)
          if (children.length === 0) return null
          return (
            <Stack key={group} direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
              <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ mr: 0.25 }}>
                {group}
              </Typography>
              {children.map((module) => (
                <NavChip key={module.id} module={module} active={activeId === module.id} />
              ))}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            </Stack>
          )
        })}
      </Stack>
    </Paper>
  )

  if (immersive) {
    return (
      <Box sx={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <Box sx={{ flexGrow: 1, minHeight: 0, position: 'relative', p: 2 }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Box>
        <Tooltip title="退出沉浸模式（Esc）">
          <Fab size="small" color="default" onClick={() => setImmersive(false)} sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1400 }}>
            <CloseFullscreenRoundedIcon fontSize="small" />
          </Fab>
        </Tooltip>
        <CommandPalette />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TitleBar
        title={crumb?.label ?? activeModule?.label ?? '总览'}
        subtitle={crumb?.hint ?? activeModule?.feature}
        leading={
          compactViewport ? (
            <IconButton className="no-drag" size="small" onClick={() => setMobileOpen(true)} aria-label="打开导航">
              <MenuRoundedIcon fontSize="small" />
            </IconButton>
          ) : null
        }
      />

      <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
        {!horizontal && !compactViewport && position === 'left' ? navPane : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, minHeight: 0 }}>
          {horizontal ? horizontalNav : null}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: isHome ? 'hidden' : 'auto',
              px: isHome ? 0 : compactViewport ? 1.5 : 3,
              py: isHome ? 0 : compactViewport ? 1.5 : 2.5,
              pb: isHome ? 0 : compactViewport ? 10 : 5
            }}
            className="sig-scroll-thin"
          >
            <RouteTransition>
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </RouteTransition>
          </Box>
        </Box>

        {!horizontal && !compactViewport && position === 'right' ? navPane : null}
      </Box>

      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen && compactViewport}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box' } }}
      >
        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
            StudyInGal
          </Typography>
          <IconButton size="small" onClick={() => setMobileOpen(false)}>
            <MenuOpenRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Divider />
        <NavPanel collapsed={false} onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <CommandPalette />

      <Stack
        direction="row"
        spacing={1}
        sx={{ position: 'fixed', right: 24, bottom: position === 'bottom' ? 76 : 24, zIndex: theme.zIndex.speedDial }}
      >
        <Tooltip title="切换导航位置（设置）">
          <Fab
            size="small"
            color="default"
            onClick={() => void patchSettings({ theme: { ...(settings?.theme as object), navPosition: 'left' } })}
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            <ViewSidebarRoundedIcon fontSize="small" />
          </Fab>
        </Tooltip>
        <Tooltip title="一键询问（Ctrl+Shift+K）">
          <Fab color="primary" aria-label="一键询问" onClick={() => openAsk()}>
            <HelpOutlineRoundedIcon />
          </Fab>
        </Tooltip>
      </Stack>
    </Box>
  )
}

function NavChip({ module, active }: { module: ModuleDef; active: boolean }) {
  const Icon = module.icon
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 16 }} />}
      label={module.label}
      component={NavLink}
      to={module.path}
      clickable
      size="small"
      color={active ? 'primary' : 'default'}
      variant={active ? 'filled' : 'outlined'}
      sx={{ textDecoration: 'none', flexShrink: 0, fontWeight: active ? 700 : 500 }}
    />
  )
}
