import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import { defaultProvider } from '@shared/constants'
import type { AICapability, AIProviderConfig } from '@shared/types'

const CAPABILITY_LABEL: Record<AICapability, string> = {
  script: '剧本生产',
  chat: '对话 / 问答',
  tts: '语音合成',
  stt: '语音识别',
  vision: '视觉理解',
  embedding: '向量嵌入'
}

const KINDS: AIProviderConfig['kind'][] = ['openai', 'deepseek', 'gemini', 'anthropic', 'ollama', 'openai-compatible']

export function AiSection() {
  const settings = useAppStore((state) => state.settings)
  const toast = useAppStore((state) => state.toast)
  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [draft, setDraft] = useState<AIProviderConfig | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setProviders(await api.ai.listProviders().catch(() => []))
  }

  useEffect(() => {
    void refresh()
  }, [])

  if (!settings) return null

  return (
    <>
      <Section
        title="API 提供商"
        subtitle="剧本生产 / 对话 / 语音等能力可以分别路由到不同提供商"
        action={
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDraft(defaultProvider('openai'))}>
            添加
          </Button>
        }
      >
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          {providers.length === 0 ? (
            <Alert severity="info">
              还没有配置提供商。填写 Base URL、API Key 与模型名即可；Ollama 等本地服务可留空 API Key。
            </Alert>
          ) : (
            providers.map((provider) => (
              <Card key={provider.id} elevation={0}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700}>
                          {provider.name}
                        </Typography>
                        <Chip size="small" label={provider.kind} />
                        {provider.enabled ? <Chip size="small" color="success" label="已启用" /> : <Chip size="small" variant="outlined" label="未启用" />}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {provider.baseUrl} · {provider.model || '（未填写模型）'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<BoltRoundedIcon />}
                      disabled={testing === provider.id}
                      onClick={async () => {
                        setTesting(provider.id)
                        const result = await api.ai.test(provider.id)
                        setTesting(null)
                        toast(result.ok ? 'success' : 'error', result.ok ? `连接成功：${result.message}` : result.message)
                      }}
                    >
                      {testing === provider.id ? '测试中…' : '测试'}
                    </Button>
                    <IconButton size="small" onClick={() => setDraft(provider)}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={async () => {
                        setProviders(await api.ai.removeProvider(provider.id))
                      }}
                    >
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      </Section>

      <Section title="能力路由" subtitle="为每类任务指定默认使用的提供商；留空则自动选择第一个已启用的提供商">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2, px: 2, pb: 2 }}>
          {(Object.keys(CAPABILITY_LABEL) as AICapability[]).map((capability) => (
            <TextField
              key={capability}
              select
              size="small"
              label={CAPABILITY_LABEL[capability]}
              value={settings.ai.routing[capability] ?? ''}
              onChange={async (event) => {
                await api.ai.setRouting({ ...settings.ai.routing, [capability]: event.target.value || null })
                void useAppStore.getState().patchSettings({
                  ai: { ...settings.ai, routing: { ...settings.ai.routing, [capability]: event.target.value || null } }
                })
              }}
            >
              <MenuItem value="">自动选择</MenuItem>
              {providers.map((provider) => (
                <MenuItem key={provider.id} value={provider.id}>
                  {provider.name}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Box>
      </Section>

      <Section title="语音合成" subtitle="对话与 Galgame 台词的朗读方式">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              select
              size="small"
              label="TTS 引擎"
              value={settings.ai.tts.engine}
              onChange={(event) =>
                void useAppStore.getState().patchSettings({
                  ai: { ...settings.ai, tts: { ...settings.ai.tts, engine: event.target.value as typeof settings.ai.tts.engine } }
                })
              }
              sx={{ width: 210 }}
            >
              <MenuItem value="webspeech">系统语音（Web Speech）</MenuItem>
              <MenuItem value="edge">Edge TTS（预留）</MenuItem>
              <MenuItem value="openai">OpenAI 兼容 TTS（预留）</MenuItem>
              <MenuItem value="custom">自定义（预留）</MenuItem>
            </TextField>
            <TextField
              size="small"
              label="语音名称 / 音色"
              value={settings.ai.tts.voice}
              onChange={(event) =>
                void useAppStore.getState().patchSettings({
                  ai: { ...settings.ai, tts: { ...settings.ai.tts, voice: event.target.value } }
                })
              }
              sx={{ width: 240 }}
            />
          </Stack>
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Box sx={{ width: 220 }}>
              <Typography variant="caption" color="text.secondary">
                语速 {settings.ai.tts.rate}
              </Typography>
              <Slider
                size="small"
                min={0.5}
                max={2}
                step={0.05}
                value={settings.ai.tts.rate}
                onChange={(_event, value) =>
                  void useAppStore.getState().patchSettings({
                    ai: { ...settings.ai, tts: { ...settings.ai.tts, rate: value as number } }
                  })
                }
              />
            </Box>
            <Box sx={{ width: 220 }}>
              <Typography variant="caption" color="text.secondary">
                音调 {settings.ai.tts.pitch}
              </Typography>
              <Slider
                size="small"
                min={0.5}
                max={2}
                step={0.05}
                value={settings.ai.tts.pitch}
                onChange={(_event, value) =>
                  void useAppStore.getState().patchSettings({
                    ai: { ...settings.ai, tts: { ...settings.ai.tts, pitch: value as number } }
                  })
                }
              />
            </Box>
          </Stack>
        </Stack>
      </Section>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>{draft?.name ? `编辑：${draft.name}` : '添加提供商'}</DialogTitle>
        <DialogContent>
          {draft ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  select
                  label="类型"
                  value={draft.kind}
                  onChange={(event) => {
                    const next = defaultProvider(event.target.value as AIProviderConfig['kind'])
                    setDraft({ ...next, id: draft.id, name: draft.name || next.name, apiKey: draft.apiKey })
                  }}
                  sx={{ width: 210 }}
                >
                  {KINDS.map((kind) => (
                    <MenuItem key={kind} value={kind}>
                      {kind}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="显示名称"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  fullWidth
                />
              </Stack>
              <TextField label="Base URL" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} fullWidth />
              <TextField
                label="API Key"
                type="password"
                value={draft.apiKey}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                fullWidth
                helperText="仅保存在本机设置文件中"
              />
              <TextField label="模型名" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Temperature"
                  type="number"
                  inputProps={{ step: 0.1, min: 0, max: 2 }}
                  value={draft.temperature}
                  onChange={(event) => setDraft({ ...draft, temperature: Number(event.target.value) })}
                  fullWidth
                />
                <TextField
                  label="Max tokens"
                  type="number"
                  value={draft.maxTokens}
                  onChange={(event) => {
                    const raw = Number(event.target.value)
                    const safe = Number.isFinite(raw) ? Math.min(Math.max(1, Math.floor(raw)), 131072) : 8192
                    setDraft({ ...draft, maxTokens: safe })
                  }}
                  fullWidth
                  helperText="单次回复上限（1 ~ 131072）。剧本生成会按行数自动申请更大预算，过小会导致剧本被截断。"
                />
              </Stack>
              <FormControlLabel
                control={<Switch checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />}
                label="启用"
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!draft) return
              setProviders(await api.ai.saveProvider(draft))
              setDraft(null)
              toast('success', '已保存提供商')
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
