import { useEffect, useMemo, useState } from 'react'
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
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import type { Character, CharacterSprite } from '@shared/types'

const DEFAULT_VOICE: Character['voice'] = { providerId: null, voiceId: '', rate: 1, pitch: 1 }

const EMPTY: Partial<Character> = {
  name: '',
  avatar: '🌸',
  personality: '',
  speakingStyle: '',
  greeting: '',
  systemPrompt: '',
  tags: [],
  isCompanion: false,
  sprites: [],
  voice: DEFAULT_VOICE,
  live2d: null
}

const EMOTIONS = ['neutral', 'happy', 'thinking', 'surprised', 'serious', 'shy', 'excited', 'sad', 'angry']

const TAB_LABELS = ['基础设定', '标签与问候', '立绘', 'Live2D', '语音']

export function CharactersPage() {
  const toast = useAppStore((state) => state.toast)
  const [characters, setCharacters] = useState<Character[]>([])
  const [draft, setDraft] = useState<Partial<Character> | null>(null)
  const [tab, setTab] = useState(0)
  const [tagInput, setTagInput] = useState('')
  const [query, setQuery] = useState('')

  const refresh = async (): Promise<void> => setCharacters(await api.characters.list())

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return characters
    return characters.filter((character) =>
      `${character.name} ${character.personality} ${character.tags.join(' ')}`.toLowerCase().includes(keyword)
    )
  }, [characters, query])

  const openEditor = (character?: Character): void => {
    setDraft(character ? { ...character } : { ...EMPTY })
    setTab(0)
    setTagInput('')
  }

  const save = async (): Promise<void> => {
    if (!draft?.name?.trim()) {
      toast('warning', '请填写角色名')
      setTab(0)
      return
    }
    await api.characters.upsert(draft)
    setDraft(null)
    await refresh()
    toast('success', '角色已保存')
  }

  const addSprite = async (): Promise<void> => {
    const paths = await api.dialogs.pickFiles({
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      multi: true
    })
    if (paths.length === 0) return
    const sprites: CharacterSprite[] = [...(draft?.sprites ?? []), ...paths.map((path) => ({ emotion: 'neutral', path }))]
    setDraft({ ...draft, sprites })
  }

  const previewVoice = (): void => {
    if (!('speechSynthesis' in window)) {
      toast('warning', '当前环境不支持 Web Speech')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(draft?.greeting || `你好，我是${draft?.name ?? '角色'}。`)
    utterance.lang = 'zh-CN'
    utterance.rate = draft?.voice?.rate ?? 1
    utterance.pitch = draft?.voice?.pitch ?? 1
    if (draft?.voice?.voiceId) {
      const voice = window.speechSynthesis.getVoices().find((item) => item.name === draft.voice?.voiceId)
      if (voice) utterance.voice = voice
    }
    window.speechSynthesis.speak(utterance)
  }

  return (
    <Stack spacing={2.5}>
      <Section
        title={`多角色管理 · ${characters.length}`}
        subtitle="角色设定、立绘、Live2D 与语音；角色卡可导入导出"
        action={
          <Stack direction="row" spacing={1}>
            <TextField size="small" placeholder="搜索角色" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ width: 160 }} />
            <Button size="small" startIcon={<FileUploadRoundedIcon />} onClick={async () => setCharacters(await api.characters.import())}>
              导入
            </Button>
            <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openEditor()}>
              新建角色
            </Button>
          </Stack>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            title={characters.length === 0 ? '还没有角色' : '没有匹配的角色'}
            description="创建一位伴学娘，或从创意工坊安装角色包。"
            action={
              characters.length === 0 ? (
                <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openEditor()}>
                  新建角色
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2, p: 2 }}>
            {filtered.map((character) => (
              <Card key={character.id} elevation={0}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Typography sx={{ fontSize: 40, lineHeight: 1 }}>{character.avatar || '🌸'}</Typography>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700} noWrap>
                          {character.name}
                        </Typography>
                        {character.isCompanion ? <StarRoundedIcon fontSize="inherit" color="warning" /> : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                        {character.personality || '未填写性格'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ my: 1.5 }}>
                    {character.tags.slice(0, 4).map((tag) => (
                      <Chip key={tag} size="small" label={tag} variant="outlined" />
                    ))}
                    {character.live2d?.modelPath ? <Chip size="small" color="primary" label="Live2D" /> : null}
                    <Chip size="small" label={`${character.sprites.length} 立绘`} />
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => openEditor(character)}>
                      编辑
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<FileDownloadRoundedIcon />}
                      onClick={async () => {
                        const path = await api.characters.export(character.id)
                        if (path) toast('success', `已导出到 ${path}`)
                      }}
                    >
                      导出
                    </Button>
                    <IconButton
                      size="small"
                      onClick={async () => {
                        await api.characters.remove(character.id)
                        await refresh()
                      }}
                    >
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Section>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} fullWidth maxWidth="md">
        <DialogTitle>
          {draft?.id ? `编辑角色：${draft.name}` : '新建角色'}
          <Typography variant="caption" color="text.secondary" display="block">
            建议先完成「基础设定」，其余项可稍后补充
          </Typography>
        </DialogTitle>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          {TAB_LABELS.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>
        <DialogContent dividers>
          {tab === 0 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={2}>
                <TextField label="头像 Emoji" value={draft?.avatar ?? ''} onChange={(event) => setDraft({ ...draft, avatar: event.target.value })} sx={{ width: 140 }} />
                <TextField label="角色名" value={draft?.name ?? ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} fullWidth />
                <FormControlLabel
                  control={<Switch checked={draft?.isCompanion ?? false} onChange={(event) => setDraft({ ...draft, isCompanion: event.target.checked })} />}
                  label="默认伴学娘"
                />
              </Stack>
              <TextField
                label="性格设定"
                multiline
                minRows={2}
                value={draft?.personality ?? ''}
                onChange={(event) => setDraft({ ...draft, personality: event.target.value })}
                fullWidth
                helperText="会同时影响对话、剧本生成与一键询问"
              />
              <TextField
                label="说话风格"
                multiline
                minRows={2}
                value={draft?.speakingStyle ?? ''}
                onChange={(event) => setDraft({ ...draft, speakingStyle: event.target.value })}
                fullWidth
              />
              <TextField
                label="系统提示词（System Prompt）"
                multiline
                minRows={5}
                value={draft?.systemPrompt ?? ''}
                onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
                fullWidth
              />
            </Stack>
          ) : null}

          {tab === 1 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="问候语"
                value={draft?.greeting ?? ''}
                onChange={(event) => setDraft({ ...draft, greeting: event.target.value })}
                fullWidth
                helperText="首页气泡与对话页的默认开场白"
              />
              <Divider textAlign="left">标签</Divider>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {(draft?.tags ?? []).map((tag) => (
                  <Chip key={tag} size="small" label={tag} onDelete={() => setDraft({ ...draft, tags: (draft?.tags ?? []).filter((item) => item !== tag) })} />
                ))}
                <TextField
                  size="small"
                  placeholder="回车添加标签"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && tagInput.trim()) {
                      setDraft({ ...draft, tags: [...(draft?.tags ?? []), tagInput.trim()] })
                      setTagInput('')
                    }
                  }}
                  sx={{ width: 200 }}
                />
              </Stack>
            </Stack>
          ) : null}

          {tab === 2 ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Alert severity="info" icon={false}>
                按情绪配置立绘：对话与 Galgame 会根据模型返回的情绪自动切换对应图片。
              </Alert>
              {(draft?.sprites ?? []).map((sprite, index) => (
                <Stack key={`${sprite.path}-${index}`} direction="row" spacing={1} alignItems="center">
                  <TextField
                    select
                    size="small"
                    value={sprite.emotion}
                    onChange={(event) => {
                      const sprites = [...(draft?.sprites ?? [])]
                      sprites[index] = { ...sprite, emotion: event.target.value }
                      setDraft({ ...draft, sprites })
                    }}
                    sx={{ width: 150 }}
                  >
                    {EMOTIONS.map((emotion) => (
                      <MenuItem key={emotion} value={emotion}>
                        {emotion}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Typography variant="caption" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                    {sprite.path}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setDraft({ ...draft, sprites: (draft?.sprites ?? []).filter((_item, itemIndex) => itemIndex !== index) })}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button startIcon={<AddRoundedIcon />} onClick={() => void addSprite()}>
                添加立绘
              </Button>
            </Stack>
          ) : null}

          {tab === 3 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info" icon={false}>
                Live2D 运行库需自行安装（pixi.js + pixi-live2d-display + Cubism Core），详见「设置 → Live2D」。
              </Alert>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="模型路径（.model3.json）"
                  value={draft?.live2d?.modelPath ?? ''}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      live2d: {
                        modelPath: event.target.value,
                        scale: draft?.live2d?.scale ?? 1,
                        x: draft?.live2d?.x ?? 0,
                        y: draft?.live2d?.y ?? 0,
                        idleMotion: draft?.live2d?.idleMotion ?? ''
                      }
                    })
                  }
                  fullWidth
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    const paths = await api.dialogs.pickFiles({ filters: [{ name: 'Live2D', extensions: ['json'] }], multi: false })
                    if (paths[0]) {
                      setDraft({
                        ...draft,
                        live2d: {
                          modelPath: paths[0],
                          scale: draft?.live2d?.scale ?? 1,
                          x: draft?.live2d?.x ?? 0,
                          y: draft?.live2d?.y ?? 0,
                          idleMotion: draft?.live2d?.idleMotion ?? ''
                        }
                      })
                    }
                  }}
                >
                  选择
                </Button>
              </Stack>
              <TextField
                label="待机动作名（可选）"
                value={draft?.live2d?.idleMotion ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    live2d: {
                      modelPath: draft?.live2d?.modelPath ?? '',
                      scale: draft?.live2d?.scale ?? 1,
                      x: draft?.live2d?.x ?? 0,
                      y: draft?.live2d?.y ?? 0,
                      idleMotion: event.target.value
                    }
                  })
                }
                fullWidth
              />
              {draft?.live2d?.modelPath ? (
                <Button size="small" color="inherit" onClick={() => setDraft({ ...draft, live2d: null })}>
                  清除 Live2D 配置
                </Button>
              ) : null}
            </Stack>
          ) : null}

          {tab === 4 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="语音名称（留空使用系统默认）"
                value={draft?.voice?.voiceId ?? ''}
                onChange={(event) => setDraft({ ...draft, voice: { ...(draft?.voice ?? DEFAULT_VOICE), voiceId: event.target.value } })}
                fullWidth
              />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  语速 {draft?.voice?.rate ?? 1}
                </Typography>
                <Slider
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={draft?.voice?.rate ?? 1}
                  onChange={(_event, value) => setDraft({ ...draft, voice: { ...(draft?.voice ?? DEFAULT_VOICE), rate: value as number } })}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  音调 {draft?.voice?.pitch ?? 1}
                </Typography>
                <Slider
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={draft?.voice?.pitch ?? 1}
                  onChange={(_event, value) => setDraft({ ...draft, voice: { ...(draft?.voice ?? DEFAULT_VOICE), pitch: value as number } })}
                />
              </Box>
              <Box>
                <Button size="small" variant="outlined" startIcon={<RecordVoiceOverRoundedIcon />} onClick={previewVoice}>
                  试听
                </Button>
              </Box>
              <Alert severity="info" icon={false}>
                当前使用系统语音（Web Speech）。多提供商 TTS 会在「设置 → API 与语音」中配置后生效。
              </Alert>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Stack direction="row" spacing={1} sx={{ flexGrow: 1, pl: 1 }}>
            <Tooltip title="快速跳到基础设定">
              <Button size="small" color="inherit" onClick={() => setTab(0)}>
                基础
              </Button>
            </Tooltip>
          </Stack>
          <Button onClick={() => setDraft(null)}>取消</Button>
          <Button variant="contained" onClick={() => void save()}>
            保存角色
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
