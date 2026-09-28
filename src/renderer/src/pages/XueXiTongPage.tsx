import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { Section } from '../components/Section'

export function XueXiTongPage() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const toast = useAppStore((state) => state.toast)

  const [status, setStatus] = useState<{ configured: boolean; baseUrl: string; running: boolean } | null>(null)
  const [baseUrl, setBaseUrl] = useState(settings?.xuexitong.baseUrl ?? '')
  const [taskId, setTaskId] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [sources, setSources] = useState<{ id: string; label: string }[]>([])
  const [activeStep, setActiveStep] = useState(0)

  const refresh = async (): Promise<void> => {
    const next = await api.xuexitong.status()
    setStatus(next)
    if (next.running) setActiveStep(1)
    return
  }

  useEffect(() => {
    void refresh()
    void (async () => {
      const [papers, textbooks] = await Promise.all([
        api.library.snapshot('paper').catch(() => null),
        api.library.snapshot('textbook').catch(() => null)
      ])
      setSources([
        ...(papers?.nodes ?? []).map((node) => ({ id: node.id, label: `[论文] ${node.title}` })),
        ...(textbooks?.nodes ?? []).map((node) => ({ id: node.id, label: `[教材] ${node.title}` }))
      ])
    })()
  }, [])

  useEffect(() => {
    setBaseUrl(settings?.xuexitong.baseUrl ?? '')
  }, [settings?.xuexitong.baseUrl])

  const enabled = settings?.xuexitong.enabled ?? false
  const configured = Boolean(settings?.xuexitong.baseUrl)

  return (
    <Stack spacing={2.5}>
      <Alert severity="info" icon={<SchoolRoundedIcon />}>
        学习通托管由独立子系统 <strong>Fanxing</strong> 提供（
        <Button
          size="small"
          endIcon={<OpenInNewRoundedIcon fontSize="inherit" />}
          onClick={() => void api.app.openExternal('https://github.com/muzirin/Fanxing')}
        >
          muzirin/Fanxing
        </Button>
        ）。StudyInGal 只作为 UI 客户端，通过本地 HTTP 服务调用，不在桌面端保存你的学习通账号密码。
      </Alert>

      <Section
        title="接入流程"
        subtitle={status ? (status.running ? 'Fanxing 服务运行中' : 'Fanxing 服务未运行') : '检测中…'}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" color={status?.running ? 'success' : 'default'} label={status?.running ? '在线' : '离线'} />
            <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void refresh()}>
              刷新状态
            </Button>
          </Stack>
        }
      >
        <Box sx={{ p: 2 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step completed={enabled && configured}>
              <StepLabel>启用模块并配置服务地址</StepLabel>
              <StepContent>
                <Stack spacing={2} sx={{ pb: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={enabled}
                        onChange={(event) =>
                          void patchSettings({ xuexitong: { ...(settings?.xuexitong as object), enabled: event.target.checked } })
                        }
                      />
                    }
                    label="启用学习通托管模块"
                  />
                  <Stack direction="row" spacing={1.5}>
                    <TextField
                      label="Fanxing 服务地址"
                      placeholder="http://127.0.0.1:8787"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      onClick={async () => {
                        await api.xuexitong.config({ baseUrl })
                        await refresh()
                        toast('success', '已保存服务地址')
                        setActiveStep(1)
                      }}
                    >
                      保存
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    请先在 Fanxing 侧启动本地服务；这里只填写地址，不保存账号密码。
                  </Typography>
                </Stack>
              </StepContent>
            </Step>

            <Step completed={Boolean(status?.running)}>
              <StepLabel>启动会话 / 扫码登录</StepLabel>
              <StepContent>
                <Stack spacing={2} sx={{ pb: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<LoginRoundedIcon />}
                    disabled={busy || !configured}
                    onClick={async () => {
                      setBusy(true)
                      const result = await api.xuexitong.launch()
                      setBusy(false)
                      toast(result.ok ? 'success' : 'error', result.message)
                      await refresh()
                    }}
                  >
                    启动会话 / 扫码登录
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    登录流程在 Fanxing 中完成；StudyInGal 只负责发起与展示状态。
                  </Typography>
                </Stack>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>提交作业</StepLabel>
              <StepContent>
                <Stack spacing={2} sx={{ pb: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <TextField
                      label="任务 ID / 作业标识"
                      value={taskId}
                      onChange={(event) => setTaskId(event.target.value)}
                      sx={{ maxWidth: 260 }}
                    />
                    <TextField
                      select
                      size="small"
                      label="从文献库填充"
                      value={sourceId}
                      onChange={async (event) => {
                        const id = event.target.value
                        setSourceId(id)
                        if (!id) return
                        try {
                          const document = await api.library.read(id)
                          setContent(document.text.slice(0, 6000))
                          toast('success', '已填入文献正文，可继续编辑后提交')
                        } catch (error) {
                          toast('error', (error as Error).message)
                        }
                      }}
                      sx={{ minWidth: 260 }}
                    >
                      <MenuItem value="">不填充</MenuItem>
                      {sources.map((source) => (
                        <MenuItem key={source.id} value={source.id}>
                          {source.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <TextField
                    label="提交内容（纯文本 / Markdown）"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    multiline
                    minRows={6}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    startIcon={<SendRoundedIcon />}
                    disabled={!taskId.trim() || !content.trim()}
                    onClick={async () => {
                      const result = await api.xuexitong.submit({ taskId: taskId.trim(), content })
                      toast(result.ok ? 'success' : 'error', result.message)
                    }}
                  >
                    提交
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    代码类作业可以直接在「代码练习场」运行后点击「作为作业提交到学习通」。
                  </Typography>
                </Stack>
              </StepContent>
            </Step>
          </Stepper>
        </Box>
      </Section>
    </Stack>
  )
}
