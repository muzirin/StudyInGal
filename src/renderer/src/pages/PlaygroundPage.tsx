import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { Section } from '../components/Section'
import type { RunCodeResult, RuntimeInfo } from '@shared/types'

const TEMPLATES: Record<string, string> = {
  c: '#include <stdio.h>\nint main() {\n    printf("Hello, StudyInGal!\\n");\n    return 0;\n}\n',
  cpp: '#include <iostream>\nint main() {\n    std::cout << "Hello, StudyInGal!" << std::endl;\n    return 0;\n}\n',
  python: 'print("Hello, StudyInGal!")\n',
  javascript: 'console.log("Hello, StudyInGal!");\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, StudyInGal!");\n    }\n}\n',
  csharp: 'Console.WriteLine("Hello, StudyInGal!");\n'
}

export function PlaygroundPage() {
  const toast = useAppStore((state) => state.toast)
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)

  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([])
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState(TEMPLATES.python)
  const [stdin, setStdin] = useState('')
  const [result, setResult] = useState<RunCodeResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ installed: boolean; installPath: string } | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [taskId, setTaskId] = useState('')

  const refresh = async (): Promise<void> => {
    setRuntimes(await api.playground.runtimes())
    setStatus(await api.playground.status())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const run = async (): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      setResult(await api.playground.run({ language, code, stdin }))
    } catch (error) {
      toast('error', (error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Section
        title="运行环境检测"
        subtitle="自动检测本机编译器与解释器"
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void refresh()}>
              重新检测
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={async () => {
                const result = await api.playground.install()
                toast(result.ok ? 'success' : 'error', result.message)
                await patchSettings({ playground: { ...(settings?.playground as object), installed: result.ok, installPath: result.path } })
                await refresh()
              }}
            >
              从 GitHub 拉取扩展环境
            </Button>
          </Stack>
        }
      >
        <Box sx={{ p: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>运行时</TableCell>
                <TableCell>命令</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>版本</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runtimes.map((runtime) => (
                <TableRow key={runtime.id} hover>
                  <TableCell>{runtime.name}</TableCell>
                  <TableCell>
                    <code>{runtime.command}</code>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={runtime.available ? 'success' : 'default'} label={runtime.available ? '可用' : '未安装'} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{runtime.version ?? '—'}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {status ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              扩展环境：{status.installed ? `已安装（${status.installPath}）` : '未安装（可选，默认不安装）'}
            </Typography>
          ) : null}
        </Box>
      </Section>

      <Section
        title="代码练习场"
        subtitle="本地执行，超时 20 秒"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value)
                setCode(TEMPLATES[event.target.value] ?? '')
              }}
              sx={{ width: 170 }}
            >
              {runtimes.map((runtime) => (
                <MenuItem key={runtime.id} value={runtime.id} disabled={!runtime.available}>
                  {runtime.name}
                  {runtime.available ? '' : '（未安装）'}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} disabled={busy} onClick={() => void run()}>
              {busy ? '运行中…' : '运行'}
            </Button>
          </Stack>
        }
      >
        <Box sx={{ p: 2 }}>
          <Box
            component="textarea"
            value={code}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setCode(event.target.value)}
            spellCheck={false}
            sx={{
              width: '100%',
              minHeight: 260,
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#14121a',
              color: '#eae6f0',
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              fontSize: 13.5,
              lineHeight: 1.6,
              outline: 'none'
            }}
          />
          <TextField
            label="标准输入（可选）"
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 2 }}
          />
        </Box>
      </Section>

      {result ? (
        <Section
          title="运行结果"
          subtitle={`${result.command} · 退出码 ${result.exitCode ?? '—'} · ${result.durationMs} ms`}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              {result.timedOut ? <Chip size="small" color="warning" label="超时终止" /> : null}
              <Button size="small" variant="outlined" startIcon={<SchoolRoundedIcon />} onClick={() => setSubmitOpen(true)}>
                作为作业提交到学习通
              </Button>
            </Stack>
          }
        >
          <Stack spacing={1.5} sx={{ p: 2 }}>
            {result.stdout ? (
              <Box component="pre" sx={{ m: 0, p: 2, borderRadius: 2, bgcolor: 'var(--sig-surface-variant)', fontSize: 13, overflow: 'auto', maxHeight: 300 }}>
                {result.stdout}
              </Box>
            ) : null}
            {result.stderr ? <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>{result.stderr}</Alert> : null}
            {!result.stdout && !result.stderr ? <Alert severity="info">无输出</Alert> : null}
          </Stack>
        </Section>
      ) : null}

      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>提交到学习通</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" icon={false}>
              将把当前代码与运行输出作为答案提交。需要先在「设置 → 学习通托管」配置 Fanxing 服务地址。
            </Alert>
            <TextField
              autoFocus
              label="任务 ID / 作业标识"
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={!taskId.trim()}
            onClick={async () => {
              const content = [
                `\`\`\`${language}`,
                code,
                '```',
                '',
                `运行输出：`,
                '```',
                (result?.stdout ?? '').slice(0, 4000),
                '```'
              ].join('\n')
              const outcome = await api.xuexitong.submit({ taskId: taskId.trim(), content })
              toast(outcome.ok ? 'success' : 'error', outcome.message)
              if (outcome.ok) setSubmitOpen(false)
            }}
          >
            提交
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
