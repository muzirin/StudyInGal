import { useEffect, useMemo } from 'react'
import { Box, Button, CssBaseline, ThemeProvider, Typography, useMediaQuery } from '@mui/material'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { buildTheme } from './theme/palettes'
import { useAppStore } from './state/appStore'
import { api } from './api'
import { AppShell } from './layout/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from './components/Toaster'
import { GlobalAsk } from './components/GlobalAsk'
import { DashboardPage } from './pages/DashboardPage'
import { LibraryPage } from './pages/LibraryPage'
import { ReaderPage } from './pages/ReaderPage'
import { EditorPage } from './pages/EditorPage'
import { CompanionPage } from './pages/CompanionPage'
import { GalgamePage } from './pages/GalgamePage'
import { GalgamePlayerPage } from './pages/GalgamePlayerPage'
import { ArchivePage } from './pages/ArchivePage'
import { ToolsPage } from './pages/ToolsPage'
import { XueXiTongPage } from './pages/XueXiTongPage'
import { PlaygroundPage } from './pages/PlaygroundPage'
import { CharactersPage } from './pages/CharactersPage'
import { WorkshopPage } from './pages/WorkshopPage'
import { CloudPage } from './pages/CloudPage'
import { SettingsPage } from './pages/SettingsPage'
import { DevToolsPage } from './pages/DevToolsPage'
import { ProactiveCompanion } from './components/ProactiveCompanion'

export function App() {
  const bootstrap = useAppStore((state) => state.bootstrap)
  const ready = useAppStore((state) => state.ready)
  const error = useAppStore((state) => state.error)
  const settings = useAppStore((state) => state.settings)
  const toast = useAppStore((state) => state.toast)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const unsubscribe = api.events.subscribe((event) => {
      const typed = event as { type: string; payload: Record<string, unknown> }
      if (typed.type === 'error-captured') {
        toast('error', `发生错误：${String(typed.payload.message ?? '未知')}（可在开发者模式查看）`)
      } else if (typed.type === 'toast') {
        toast(typed.payload.severity as never, String(typed.payload.message ?? ''))
      } else if (typed.type === 'companion-bubble' || typed.type === 'proactive') {
        toast('info', String(typed.payload.text ?? ''))
      }
    })
    return unsubscribe
  }, [toast])

  const mode = settings?.theme.mode === 'system' || !settings?.theme.mode ? (prefersDark ? 'dark' : 'light') : settings.theme.mode

  const theme = useMemo(
    () =>
      buildTheme({
        paletteId: settings?.theme.palette ?? 'sakura',
        mode,
        radius: settings?.theme.radius ?? 16,
        touchOptimized: settings?.theme.touchOptimized ?? false,
        compact: settings?.theme.density === 'compact'
      }),
    [settings?.theme.palette, settings?.theme.radius, settings?.theme.touchOptimized, settings?.theme.density, mode]
  )

  if (!ready) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <Typography color="text.secondary">正在初始化 StudyInGal…</Typography>
        </Box>
      </ThemeProvider>
    )
  }

  if (error) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', p: 4, textAlign: 'center' }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              初始化失败
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {error}
            </Typography>
            <Button variant="contained" onClick={() => void api.app.relaunch()}>
              重启应用
            </Button>
          </Box>
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/library/:kind" element={<LibraryPage />} />
              <Route path="/reader/:nodeId" element={<ReaderPage />} />
              <Route path="/editor/:nodeId" element={<EditorPage />} />
              <Route path="/companion" element={<CompanionPage />} />
              <Route path="/galgame" element={<GalgamePage />} />
              <Route path="/galgame/:scriptId" element={<GalgamePlayerPage />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/xuexitong" element={<XueXiTongPage />} />
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/characters" element={<CharactersPage />} />
              <Route path="/workshop" element={<WorkshopPage />} />
              <Route path="/cloud" element={<CloudPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/devtools" element={<DevToolsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
        <GlobalAsk />
        <ProactiveCompanion />
      </ErrorBoundary>
      <Toaster />
    </ThemeProvider>
  )
}
