import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatDateTime } from '../lib/format'
import type { CapturedError } from '@shared/types'
import type { StudyEvent } from '@shared/channels'

function TerminalPanel() {
  const toast = useAppStore((state) => state.toast)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let disposed = false
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      cursorBlink: true,
      theme: { background: '#14121a', foreground: '#eae6f0' }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    if (containerRef.current) term.open(containerRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const unsubscribe = api.events.subscribe((event) => {
      const typed = event as StudyEvent
      if (typed.type === 'terminal-data') {
        const payload = typed.payload as { sessionId: string; type: string; data: string; code?: number }
        if (sessionRef.current && payload.sessionId !== sessionRef.current) return
        term.write(payload.data)
        if (payload.type === 'exit') term.write(`\r\n\x1b[33m[进程退出，代码 ${payload.code ?? 0}]\x1b[0m\r\n`)
      }
    })

    void api.terminal
      .create({})
      .then(({ sessionId }) => {
        if (disposed) {
          void api.terminal.kill(sessionId)
          return
        }
        sessionRef.current = sessionId
        setReady(true)
        term.writeln('\x1b[36mStudyInGal 内嵌终端\x1b[0m（非 PTY 模式：适合构建/测试/脚本命令）')
        term.writeln('输入命令后回车执行；需要完整交互式 TUI 时请在系统终端运行。\r\n')
        term.focus()
      })
      .catch((error) => {
        term.writeln(`\x1b[31m终端启动失败：${(error as Error).message}\x1b[0m`)
      })

    const dataListener = term.onData((data) => {
      if (sessionRef.current) void api.terminal.write(sessionRef.current, data)
    })

    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
        if (sessionRef.current) void api.terminal.resize(sessionRef.current, term.cols, term.rows)
      } catch {
        /* ignore */
      }
    })
    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      disposed = true
      observer.disconnect()
      dataListener.dispose()
      unsubscribe()
      if (sessionRef.current) void api.terminal.kill(sessionRef.current)
      term.dispose()
    }
  }, [])

  const restart = async (): Promise<void> => {
    if (sessionRef.current) await api.terminal.kill(sessionRef.current)
    termRef.current?.reset()
    const { sessionId } = await api.terminal.create({})
    sessionRef.current = sessionId
    toast('success', '终端已重启')
  }

  const send = (command: string): void => {
    if (!sessionRef.current) return
    void api.terminal.write(sessionRef.current, `${command}\r`)
    termRef.current?.focus()
  }

  const presets = [
    'npm run typecheck',
    'npm test',
    'npm run build',
    'npm run typecheck; npm test; npm run build',
    'git status',
    'git log --oneline -5',
    'npm outdated'
  ]

  return (
    <Section
      title="内嵌 CLI 终端"
      subtitle={ready ? '已连接本地 Shell' : '正在启动…'}
      action={
        <Stack direction="row" spacing={1}>
          <Tooltip title="清屏">
            <IconButton size="small" onClick={() => termRef.current?.clear()}>
              <DeleteSweepRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="重启终端">
            <IconButton size="small" onClick={() => void restart()}>
              <RestartAltRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      <Alert severity="info" icon={false} sx={{ mb: 2 }}>
        出于跨平台稳定性考虑，这里使用管道式 Shell（非伪终端）。适合运行 <code>npm</code>、<code>git</code>、<code>python</code> 等命令。
      </Alert>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        {presets.map((preset) => (
          <Chip
            key={preset}
            size="small"
            variant={preset.includes(';') ? 'filled' : 'outlined'}
            color={preset.includes(';') ? 'primary' : 'default'}
            label={preset.includes(';') ? '运行自检（typecheck + test + build）' : preset}
            clickable
            onClick={() => send(preset)}
          />
        ))}
      </Stack>
      <Box ref={containerRef} sx={{ height: 460, borderRadius: 1.5, overflow: 'hidden', bgcolor: '#14121a', p: 1 }} />
    </Section>
  )
}

function ErrorsPanel() {
  const toast = useAppStore((state) => state.toast)
  const [errors, setErrors] = useState<CapturedError[]>([])
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null)

  const refresh = async (): Promise<void> => setErrors(await api.errors.list())

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <Section
      title="错误采集与一键汇报"
      subtitle={`已记录 ${errors.length} 条（最多保留 200 条）`}
      action={
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void refresh()}>
            刷新
          </Button>
          <Button
            size="small"
            color="inherit"
            startIcon={<DeleteSweepRoundedIcon />}
            onClick={async () => {
              await api.errors.clear()
              await refresh()
            }}
          >
            清空
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<BugReportRoundedIcon />}
            onClick={async () => {
              const issue = await api.errors.draftIssue(errors[0]?.id)
              setDraft({ title: issue.title, body: issue.body })
            }}
          >
            生成 Issue 草稿
          </Button>
          <Button size="small" variant="outlined" onClick={() => void api.errors.openIssue(errors[0]?.id)}>
            直接打开 GitHub
          </Button>
        </Stack>
      }
    >
      {errors.length === 0 ? (
        <EmptyState title="暂无错误记录" description="运行期异常会自动采集环境信息与堆栈，方便一键提 issue。" />
      ) : (
        <Stack spacing={1.5} sx={{ p: 1 }}>
          {errors.slice(0, 20).map((error) => (
            <Box key={error.id} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'var(--sig-surface-variant)' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" color="error" label={error.context || 'unknown'} />
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(error.timestamp)}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                {error.message}
              </Typography>
              <Typography
                component="pre"
                variant="caption"
                sx={{ m: 0, mt: 0.5, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', color: 'text.secondary' }}
              >
                {error.stack.split('\n').slice(0, 4).join('\n')}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {draft ? (
        <Box sx={{ mt: 2 }}>
          <Alert severity="success" action={<Button size="small" onClick={() => setDraft(null)}>关闭</Button>}>
            已生成草稿：{draft.title}
          </Alert>
          <Box
            component="pre"
            sx={{ mt: 1, p: 2, borderRadius: 1.5, bgcolor: 'var(--sig-surface-variant)', fontSize: 12, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap' }}
          >
            {draft.body}
          </Box>
        </Box>
      ) : null}
    </Section>
  )
}

export function DevToolsPage() {
  const [tab, setTab] = useState(0)
  const settings = useAppStore((state) => state.settings)
  const developerEnabled = settings?.developer.enabled ?? false

  if (!developerEnabled) {
    return (
      <Section title="开发者模式未开启">
        <EmptyState
          title="需要在设置中开启"
          description="开启后可使用内嵌终端、错误采集面板与更详细的日志。"
        />
      </Section>
    )
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2.5 }}>
        <Tab label="终端" />
        <Tab label="错误与反馈" />
      </Tabs>
      {tab === 0 ? <TerminalPanel /> : <ErrorsPanel />}
    </Box>
  )
}
