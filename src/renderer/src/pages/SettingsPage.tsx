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
  Divider,
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
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { Section } from '../components/Section'
import { PALETTES } from '../theme/palettes'
import { MODULES } from '../modules/registry'
import { defaultProvider, GITHUB_URL } from '@shared/constants'
import type { AICapability, AIProviderConfig, Character, CloudMount, NavPosition } from '@shared/types'

const CAPABILITY_LABEL: Record<AICapability, string> = {
  script: '剧本生产',
  chat: '对话 / 问答',
  tts: '语音合成',
  stt: '语音识别',
  vision: '视觉理解',
  embedding: '向量嵌入'
}

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const resetSettings = useAppStore((state) => state.resetSettings)
  const toast = useAppStore((state) => state.toast)

  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [mounts, setMounts] = useState<CloudMount[]>([])
  const [draftProvider, setDraftProvider] = useState<AIProviderConfig | null>(null)

  const refresh = async (): Promise<void> => {
    const [providerList, characterList, mountList] = await Promise.all([
      api.ai.listProviders().catch(() => []),
      api.characters.list().catch(() => []),
      api.cloud.list().catch(() => [])
    ])
    setProviders(providerList)
    setCharacters(characterList)
    setMounts(mountList)
  }

  useEffect(() => {
    void refresh()
  }, [])

  if (!settings) return null

  const theme = settings.theme

  return (
    <Stack spacing={2.5}>
      <Section title="外观与主题" subtitle="Material Design 3 配色与自适应导航">
        <Stack spacing={2.5} sx={{ p: 2 }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              配色
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {PALETTES.map((palette) => (
                <Button
                  key={palette.id}
                  size="small"
                  variant={theme.palette === palette.id ? 'contained' : 'outlined'}
                  onClick={() => void patchSettings({ theme: { ...theme, palette: palette.id } })}
                  sx={{
                    borderColor: palette.seed,
                    '& .dot': { width: 14, height: 14, borderRadius: '50%', bgcolor: palette.seed, mr: 1 }
                  }}
                  startIcon={<Box className="dot" />}
                >
                  {palette.name}
                </Button>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="明暗模式"
              value={theme.mode}
              onChange={(event) => void patchSettings({ theme: { ...theme, mode: event.target.value as typeof theme.mode } })}
              sx={{ width: 160 }}
            >
              <MenuItem value="system">跟随系统</MenuItem>
              <MenuItem value="light">浅色</MenuItem>
              <MenuItem value="dark">深色</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="导航栏位置"
              value={theme.navPosition}
              onChange={(event) => void patchSettings({ theme: { ...theme, navPosition: event.target.value as NavPosition } })}
              sx={{ width: 160 }}
            >
              <MenuItem value="left">居左（默认）</MenuItem>
              <MenuItem value="right">居右</MenuItem>
              <MenuItem value="top">顶部</MenuItem>
              <MenuItem value="bottom">底部</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="信息密度"
              value={theme.density}
              onChange={(event) => void patchSettings({ theme: { ...theme, density: event.target.value as typeof theme.density } })}
              sx={{ width: 160 }}
            >
              <MenuItem value="comfortable">舒适</MenuItem>
              <MenuItem value="compact">紧凑</MenuItem>
            </TextField>
            <Box sx={{ width: 200 }}>
              <Typography variant="caption">圆角 {theme.radius}px</Typography>
              <Slider
                size="small"
                min={0}
                max={28}
                value={theme.radius}
                onChange={(_event, value) => void patchSettings({ theme: { ...theme, radius: value as number } })}
              />
            </Box>
            <FormControlLabel
              control={<Switch checked={theme.touchOptimized} onChange={(event) => void patchSettings({ theme: { ...theme, touchOptimized: event.target.checked } })} />}
              label="触屏大按钮模式"
            />
          </Stack>
        </Stack>
      </Section>

      <Section title="导航栏模块" subtitle="勾选要在导航中显示的模块">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ p: 2 }}>
          {MODULES.map((module) => {
            const hidden = settings.nav.hidden.includes(module.id)
            return (
              <Chip
                key={module.id}
                label={module.label}
                color={hidden ? 'default' : 'primary'}
                variant={hidden ? 'outlined' : 'filled'}
                onClick={() =>
                  void patchSettings({
                    nav: {
                      ...settings.nav,
                      hidden: hidden ? settings.nav.hidden.filter((id) => id !== module.id) : [...settings.nav.hidden, module.id]
                    }
                  })
                }
              />
            )
          })}
        </Stack>
      </Section>

      <Section
        title="API 提供商"
        subtitle="剧本生产 / 对话 / 语音可分别路由到不同提供商"
        action={
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDraftProvider(defaultProvider('openai'))}>
            添加提供商
          </Button>
        }
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          {providers.length === 0 ? (
            <Alert severity="info">还没有配置提供商。点击「添加提供商」，填写 Base URL、API Key 与模型名即可。</Alert>
          ) : (
            providers.map((provider) => (
              <Card key={provider.id} elevation={0}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700}>
                          {provider.name}
                        </Typography>
                        <Chip size="small" label={provider.kind} />
                        {provider.enabled ? <Chip size="small" color="success" label="已启用" /> : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {provider.baseUrl} · {provider.model}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<BoltRoundedIcon />}
                      onClick={async () => {
                        const result = await api.ai.test(provider.id)
                        toast(result.ok ? 'success' : 'error', result.ok ? `连接成功：${result.message}` : result.message)
                      }}
                    >
                      测试
                    </Button>
                    <IconButton size="small" onClick={() => setDraftProvider(provider)}>
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

          <Divider textAlign="left">能力路由</Divider>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {(Object.keys(CAPABILITY_LABEL) as AICapability[]).map((capability) => (
              <TextField
                key={capability}
                select
                size="small"
                label={CAPABILITY_LABEL[capability]}
                value={settings.ai.routing[capability] ?? ''}
                onChange={async (event) => {
                  const list = await api.ai.setRouting({ ...settings.ai.routing, [capability]: event.target.value || null })
                  void list
                  await useAppStore.getState().patchSettings({
                    ai: { ...settings.ai, routing: { ...settings.ai.routing, [capability]: event.target.value || null } }
                  })
                }}
                sx={{ width: 190 }}
              >
                <MenuItem value="">自动选择</MenuItem>
                {providers.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>

          <Divider textAlign="left">语音合成</Divider>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              select
              size="small"
              label="TTS 引擎"
              value={settings.ai.tts.engine}
              onChange={(event) => void patchSettings({ ai: { ...settings.ai, tts: { ...settings.ai.tts, engine: event.target.value as typeof settings.ai.tts.engine } } })}
              sx={{ width: 190 }}
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
              onChange={(event) => void patchSettings({ ai: { ...settings.ai, tts: { ...settings.ai.tts, voice: event.target.value } } })}
              sx={{ width: 220 }}
            />
            <Box sx={{ width: 180 }}>
              <Typography variant="caption">语速 {settings.ai.tts.rate}</Typography>
              <Slider
                size="small"
                min={0.5}
                max={2}
                step={0.05}
                value={settings.ai.tts.rate}
                onChange={(_event, value) => void patchSettings({ ai: { ...settings.ai, tts: { ...settings.ai.tts, rate: value as number } } })}
              />
            </Box>
          </Stack>
        </Stack>
      </Section>

      <Section title="伴学娘与主动搭话">
        <Stack spacing={2} sx={{ p: 2 }}>
          <TextField
            select
            size="small"
            label="默认伴学娘"
            value={settings.companion.activeCharacterId ?? ''}
            onChange={(event) => void patchSettings({ companion: { ...settings.companion, activeCharacterId: event.target.value || null } })}
            sx={{ maxWidth: 320 }}
          >
            <MenuItem value="">自动（第一个角色）</MenuItem>
            {characters.map((character) => (
              <MenuItem key={character.id} value={character.id}>
                {character.avatar} {character.name}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={<Switch checked={settings.companion.proactive} onChange={(event) => void patchSettings({ companion: { ...settings.companion, proactive: event.target.checked } })} />}
            label="启用主动搭话"
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              type="number"
              label="间隔（分钟）"
              value={settings.companion.proactiveIntervalMinutes}
              onChange={(event) => void patchSettings({ companion: { ...settings.companion, proactiveIntervalMinutes: Math.max(5, Number(event.target.value) || 45) } })}
              sx={{ width: 160 }}
            />
            <FormControlLabel
              control={<Switch checked={settings.companion.showBubbles} onChange={(event) => void patchSettings({ companion: { ...settings.companion, showBubbles: event.target.checked } })} />}
              label="语音朗读回复"
            />
          </Stack>
          <TextField
            label="主动搭话提示词"
            multiline
            minRows={2}
            value={settings.companion.proactivePrompt}
            onChange={(event) => void patchSettings({ companion: { ...settings.companion, proactivePrompt: event.target.value } })}
          />
        </Stack>
      </Section>

      <Section title="Live2D">
        <Stack spacing={2} sx={{ p: 2 }}>
          <FormControlLabel
            control={<Switch checked={settings.live2d.enabled} onChange={(event) => void patchSettings({ live2d: { ...settings.live2d, enabled: event.target.checked } })} />}
            label="启用 Live2D（需要自行安装 pixi.js 与 pixi-live2d-display 运行时）"
          />
          <Typography variant="caption" color="text.secondary">
            模型路径在「角色管理 → Live2D」中按角色配置。
          </Typography>
          <Box sx={{ width: 260 }}>
            <Typography variant="caption">缩放 {settings.live2d.scale}</Typography>
            <Slider
              size="small"
              min={0.4}
              max={2.5}
              step={0.05}
              value={settings.live2d.scale}
              onChange={(_event, value) => void patchSettings({ live2d: { ...settings.live2d, scale: value as number } })}
            />
          </Box>
        </Stack>
      </Section>

      <Section title="编辑器与文档">
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              size="small"
              label="等宽字体"
              value={settings.editor.fontFamily}
              onChange={(event) => void patchSettings({ editor: { ...settings.editor, fontFamily: event.target.value } })}
              sx={{ width: 280 }}
            />
            <TextField
              size="small"
              type="number"
              label="字号"
              value={settings.editor.fontSize}
              onChange={(event) => void patchSettings({ editor: { ...settings.editor, fontSize: Number(event.target.value) || 15 } })}
              sx={{ width: 110 }}
            />
            <FormControlLabel
              control={<Switch checked={settings.editor.autosave} onChange={(event) => void patchSettings({ editor: { ...settings.editor, autosave: event.target.checked } })} />}
              label="自动保存"
            />
            <TextField
              size="small"
              type="number"
              label="自动保存延迟(ms)"
              value={settings.editor.autosaveMs}
              onChange={(event) => void patchSettings({ editor: { ...settings.editor, autosaveMs: Number(event.target.value) || 1500 } })}
              sx={{ width: 190 }}
            />
          </Stack>
          <Divider textAlign="left">OCR</Divider>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              label="OCR 语言包"
              value={settings.library.ocrLanguage}
              onChange={(event) => void patchSettings({ library: { ...settings.library, ocrLanguage: event.target.value } })}
              sx={{ width: 220 }}
            />
            <FormControlLabel
              control={<Switch checked={settings.library.autoOcr} onChange={(event) => void patchSettings({ library: { ...settings.library, autoOcr: event.target.checked } })} />}
              label="导入扫描件后自动 OCR（本地 Tesseract）"
            />
          </Stack>
          <Divider textAlign="left">库目录</Divider>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<FolderRoundedIcon />}
              onClick={async () => {
                const dir = await api.dialogs.pickDirectory()
                if (dir) void patchSettings({ library: { ...settings.library, roots: { ...settings.library.roots, paper: dir } } })
              }}
            >
              论文库根目录：{settings.library.roots.paper || '未设置'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<FolderRoundedIcon />}
              onClick={async () => {
                const dir = await api.dialogs.pickDirectory()
                if (dir) void patchSettings({ library: { ...settings.library, roots: { ...settings.library.roots, textbook: dir } } })
              }}
            >
              教材库根目录：{settings.library.roots.textbook || '未设置'}
            </Button>
          </Stack>
        </Stack>
      </Section>

      <Section title="同步">
        <Stack spacing={2} sx={{ p: 2 }}>
          <FormControlLabel
            control={<Switch checked={settings.sync.autoSync} onChange={(event) => void patchSettings({ sync: { ...settings.sync, autoSync: event.target.checked } })} />}
            label="启用自动同步"
          />
          <TextField
            select
            size="small"
            label="默认同步挂载"
            value={settings.sync.mountId ?? ''}
            onChange={(event) => void patchSettings({ sync: { ...settings.sync, mountId: event.target.value || null } })}
            sx={{ maxWidth: 320 }}
          >
            <MenuItem value="">未指定</MenuItem>
            {mounts.map((mount) => (
              <MenuItem key={mount.id} value={mount.id}>
                {mount.name}（{mount.kind}）
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Section>

      <Section title="开发者与反馈">
        <Stack spacing={2} sx={{ p: 2 }}>
          <FormControlLabel
            control={<Switch checked={settings.developer.enabled} onChange={(event) => void patchSettings({ developer: { ...settings.developer, enabled: event.target.checked } })} />}
            label="开启开发者模式（显示内嵌终端入口）"
          />
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              size="small"
              label="终端 Shell（留空自动检测）"
              value={settings.developer.terminalShell}
              onChange={(event) => void patchSettings({ developer: { ...settings.developer, terminalShell: event.target.value } })}
              sx={{ width: 300 }}
            />
            <FormControlLabel
              control={<Switch checked={settings.developer.openDevToolsOnStart} onChange={(event) => void patchSettings({ developer: { ...settings.developer, openDevToolsOnStart: event.target.checked } })} />}
              label="启动时打开 DevTools"
            />
          </Stack>
          <Divider textAlign="left">错误采集</Divider>
          <FormControlLabel
            control={<Switch checked={settings.telemetry.crashReporting} onChange={(event) => void patchSettings({ telemetry: { ...settings.telemetry, crashReporting: event.target.checked } })} />}
            label="本地记录运行错误（仅保存在本机，不上传）"
          />
          <FormControlLabel
            control={<Switch checked={settings.telemetry.autoIssueDraft} onChange={(event) => void patchSettings({ telemetry: { ...settings.telemetry, autoIssueDraft: event.target.checked } })} />}
            label="生成 Issue 草稿时附带错误日志"
          />
        </Stack>
      </Section>

      <Section
        title="关于"
        subtitle="StudyInGal · GPL-3.0-or-later"
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<ScienceRoundedIcon />} onClick={() => void api.app.openExternal(GITHUB_URL)}>
              仓库
            </Button>
            <Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={() => void resetSettings()}>
              恢复默认设置
            </Button>
          </Stack>
        }
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            本软件以 GPL-3.0 许可发布；基于 Nova42x/paper2galgame 的「论文转 Galgame」思路扩展为完整学习系统。
          </Typography>
        </Box>
      </Section>

      <Dialog open={draftProvider !== null} onClose={() => setDraftProvider(null)} fullWidth maxWidth="sm">
        <DialogTitle>{draftProvider?.name ? `编辑：${draftProvider.name}` : '添加提供商'}</DialogTitle>
        <DialogContent>
          {draftProvider ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={2}>
                <TextField
                  select
                  label="类型"
                  value={draftProvider.kind}
                  onChange={(event) => setDraftProvider({ ...defaultProvider(event.target.value as AIProviderConfig['kind']), id: draftProvider.id, name: draftProvider.name || defaultProvider(event.target.value as AIProviderConfig['kind']).name })}
                  sx={{ width: 200 }}
                >
                  {['openai', 'deepseek', 'gemini', 'anthropic', 'ollama', 'openai-compatible'].map((kind) => (
                    <MenuItem key={kind} value={kind}>
                      {kind}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="显示名称" value={draftProvider.name} onChange={(event) => setDraftProvider({ ...draftProvider, name: event.target.value })} fullWidth />
              </Stack>
              <TextField label="Base URL" value={draftProvider.baseUrl} onChange={(event) => setDraftProvider({ ...draftProvider, baseUrl: event.target.value })} fullWidth />
              <TextField label="API Key" type="password" value={draftProvider.apiKey} onChange={(event) => setDraftProvider({ ...draftProvider, apiKey: event.target.value })} fullWidth />
              <TextField label="模型名" value={draftProvider.model} onChange={(event) => setDraftProvider({ ...draftProvider, model: event.target.value })} fullWidth />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Temperature"
                  type="number"
                  inputProps={{ step: 0.1, min: 0, max: 2 }}
                  value={draftProvider.temperature}
                  onChange={(event) => setDraftProvider({ ...draftProvider, temperature: Number(event.target.value) })}
                  fullWidth
                />
                <TextField
                  label="Max tokens"
                  type="number"
                  value={draftProvider.maxTokens}
                  onChange={(event) => setDraftProvider({ ...draftProvider, maxTokens: Number(event.target.value) })}
                  fullWidth
                />
              </Stack>
              <FormControlLabel
                control={<Switch checked={draftProvider.enabled} onChange={(event) => setDraftProvider({ ...draftProvider, enabled: event.target.checked })} />}
                label="启用"
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraftProvider(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!draftProvider) return
              setProviders(await api.ai.saveProvider(draftProvider))
              setDraftProvider(null)
              toast('success', '已保存提供商')
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
