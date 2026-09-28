import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded'
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded'
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { Live2DStage } from '../components/Live2DStage'
import { buildScenes } from '../lib/scenes'
import { resolveBackground, useBackgrounds } from '../lib/backgrounds'
import { toAssetUrl } from '../lib/assets'
import { useCharacterSprite } from '../lib/bundledAssets'
import type { ArchiveSave, Character, GalScript } from '@shared/types'

const EMOTION_EMOJI: Record<string, string> = {
  neutral: '🙂',
  happy: '😊',
  thinking: '🤔',
  surprised: '😮',
  serious: '🧐',
  shy: '😳',
  excited: '🤩',
  sad: '😢',
  angry: '😠'
}

export function GalgamePlayerPage() {
  const theme = useTheme()
  const { scriptId = '' } = useParams<{ scriptId: string }>()
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const setCrumb = useAppStore((state) => state.setCrumb)
  const [searchParams] = useSearchParams()
  const immersive = useAppStore((state) => state.immersive)
  const setImmersive = useAppStore((state) => state.setImmersive)
  const live2dEnabled = useAppStore((state) => state.settings?.live2d.enabled ?? false)
  const compact = useMediaQuery('(max-width: 1100px)')

  const [script, setScript] = useState<GalScript | null>(null)
  const [character, setCharacter] = useState<Character | null>(null)
  const [save, setSave] = useState<ArchiveSave | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [auto, setAuto] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [sceneOpen, setSceneOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [stageHeight, setStageHeight] = useState(420)
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const timerRef = useRef<number | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const fullscreenRef = useRef(false)
  const backgrounds = useBackgrounds()
  const settingsHomeSceneId = useAppStore((state) => state.settings?.home?.sceneId ?? null)
  const background = useMemo(
    () => resolveBackground(backgrounds, script?.sceneId ?? settingsHomeSceneId),
    [backgrounds, script?.sceneId, settingsHomeSceneId]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [loadedScript, characters, saves] = await Promise.all([
        api.gal.getScript(scriptId),
        api.characters.list().catch(() => []),
        api.archive.list().catch(() => [])
      ])
      if (cancelled) return
      setScript(loadedScript)
      if (loadedScript) setCrumb({ label: loadedScript.title, hint: 'Galgame 剧本' })
      const found = characters.find((item) => item.id === loadedScript?.characterId) ?? characters[0] ?? null
      setCharacter(found)
      const existing = saves.find((item) => item.scriptId === scriptId) ?? null
      setSave(existing)
      setIndex(existing ? Math.min(existing.linesRead, (loadedScript?.lines.length ?? 1) - 1) : 0)
    })()
    return () => {
      cancelled = true
    }
  }, [scriptId, setCrumb])

  // 支持 #/galgame/<id>?immersive=1 直接进入全屏游玩
  useEffect(() => {
    if (searchParams.get('immersive') === '1') setImmersive(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const line = script?.lines[index] ?? null
  const scenes = useMemo(() => buildScenes(script?.lines ?? []), [script?.lines])
  const currentScene = useMemo(() => scenes.find((scene) => index >= scene.start && index <= scene.end) ?? null, [scenes, index])
  const sprite = useCharacterSprite(character, line?.emotion ?? 'neutral')

  // 立绘区域高度自适应：窗口/沉浸模式变化时重新测量，立绘始终完整可见
  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const measure = (): void => setStageHeight(Math.max(160, element.clientHeight))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [script, immersive])

  useEffect(() => {
    setRevealed(0)
    setEditing(false)
    if (!line) return
    let cursor = 0
    const step = (): void => {
      cursor += 1
      setRevealed(cursor)
      if (cursor < line.text.length) {
        timerRef.current = window.setTimeout(step, Math.max(12, 26 - line.text.length / 20))
      }
    }
    timerRef.current = window.setTimeout(step, 110)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [line])

  const advance = (): void => {
    if (!script) return
    if (line && revealed < line.text.length) {
      setRevealed(line.text.length)
      return
    }
    if (index < script.lines.length - 1) setIndex(index + 1)
    else setAuto(false)
  }

  useEffect(() => {
    if (!auto || !script || !line) return
    if (revealed < line.text.length) return
    const timer = window.setTimeout(() => advance(), 1500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, revealed, index, script])

  useEffect(() => {
    if (!script) return
    const progress = script.lines.length > 1 ? index / (script.lines.length - 1) : 0
    void api.archive
      .upsert({
        id: save?.id,
        title: script.title,
        kind: script.sourceKind,
        sourceId: script.sourceId,
        scriptId: script.id,
        characterId: script.characterId,
        totalLines: script.lines.length,
        linesRead: index,
        progress,
        storage: save?.storage ?? 'local',
        mountId: save?.mountId ?? null,
        dataPath: save?.dataPath ?? '',
        lastPlayedAt: Date.now()
      })
      .then(setSave)
      .catch(() => undefined)
  }, [index, script, save?.id])

  const speakLine = (text: string): void => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = character?.voice.rate ?? 1
    utterance.pitch = character?.voice.pitch ?? 1
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    if (!autoSpeak || !line) return
    if (line.speaker === 'narration') return
    speakLine(line.text)
    return () => {
      window.speechSynthesis.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeak, line?.id])

  const toggleFullscreen = async (): Promise<void> => {
    const next = !immersive
    setImmersive(next)
    try {
      const state = await api.app.windowState()
      if (next && !state.fullscreen) {
        await api.app.window('toggle-fullscreen')
        fullscreenRef.current = true
      } else if (!next && state.fullscreen) {
        await api.app.window('toggle-fullscreen')
        fullscreenRef.current = false
      }
    } catch {
      /* 忽略窗口状态读取失败 */
    }
  }

  const exitImmersive = async (): Promise<void> => {
    try {
      const state = await api.app.windowState()
      if (state.fullscreen) await api.app.window('toggle-fullscreen')
    } catch {
      /* ignore */
    }
    fullscreenRef.current = false
    setImmersive(false)
  }

  // 快捷键：F / F11 切换全屏，Esc 退出沉浸，空格推进
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA'].includes(target.tagName)
      if (event.key === 'Escape' && immersive) {
        void exitImmersive()
        return
      }
      if (typing) return
      if (event.key === 'f' || event.key === 'F' || event.key === 'F11') {
        event.preventDefault()
        void toggleFullscreen()
        return
      }
      if (event.key === ' ' && !editing) {
        event.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive, editing, revealed, index, script])

  // 离开页面时恢复窗口状态
  useEffect(
    () => () => {
      if (fullscreenRef.current) void api.app.window('toggle-fullscreen')
      useAppStore.getState().setImmersive(false)
    },
    []
  )

  const saveLineEdit = async (): Promise<void> => {
    if (!script || !line) return
    const lines = script.lines.map((item) => (item.id === line.id ? { ...item, text: draft.trim() } : item))
    const next = await api.gal.saveScript({ id: script.id, lines })
    setScript(next)
    setEditing(false)
    setRevealed(draft.trim().length)
    toast('success', '已保存这句台词')
  }

  const quoteToNotes = async (): Promise<void> => {
    if (!script || !line) return
    await api.notes.upsert({
      nodeId: script.sourceId,
      chapterPath: `script:${script.id}`,
      chapterTitle: script.title,
      kind: 'quote',
      title: `剧本引用：${script.title}`,
      content: `> ${line.text}`
    })
    toast('success', '已加入黑板笔记')
  }

  if (!script) {
    return (
      <Section title="剧本不存在">
        <EmptyState title="找不到这个剧本" action={<Button variant="contained" onClick={() => navigate('/galgame')}>返回 Gal 工坊</Button>} />
      </Section>
    )
  }

  return (
    <Stack spacing={1.25} sx={{ height: '100%', minHeight: 0 }}>
      {/* 顶部信息条 */}
      <Paper
        elevation={0}
        sx={{
          p: 1,
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: immersive ? alpha(theme.palette.background.paper, 0.65) : 'background.paper'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1, minWidth: 140 }} noWrap>
            {script.title}
          </Typography>
          <Chip size="small" label={`第 ${(currentScene?.index ?? 0) + 1} 幕 / 共 ${scenes.length} 幕`} />
          <Chip size="small" variant="outlined" label={`${index + 1} / ${script.lines.length}`} />
          <Tooltip title={autoSpeak ? '关闭自动朗读' : '开启自动朗读'}>
            <Chip
              size="small"
              icon={autoSpeak ? <VolumeUpRoundedIcon sx={{ fontSize: 15 }} /> : <VolumeOffRoundedIcon sx={{ fontSize: 15 }} />}
              label="自动朗读"
              color={autoSpeak ? 'primary' : 'default'}
              variant={autoSpeak ? 'filled' : 'outlined'}
              clickable
              onClick={() => setAutoSpeak((value) => !value)}
            />
          </Tooltip>
          <Tooltip title="场景列表">
            <IconButton size="small" onClick={() => setSceneOpen(true)}>
              <MovieFilterRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="对话记录">
            <IconButton size="small" onClick={() => setLogOpen(true)}>
              <HistoryRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="把当前台词加入黑板笔记">
            <IconButton size="small" onClick={() => void quoteToNotes()}>
              <StickyNote2RoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="导出存档">
            <IconButton
              size="small"
              onClick={async () => {
                try {
                  await api.gal.exportSave(script.id, useAppStore.getState().settings?.sync.mountId ?? null)
                  toast('success', '存档已导出')
                } catch (error) {
                  toast('error', `导出失败：${(error as Error).message}`)
                }
              }}
            >
              <SaveRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="更换场景背景">
            <IconButton size="small" onClick={() => setBackgroundOpen(true)}>
              <WallpaperRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={immersive ? '退出全屏（Esc）' : '全屏游玩（F）'}>
            <IconButton size="small" color={immersive ? 'primary' : 'default'} onClick={() => void toggleFullscreen()}>
              {immersive ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
        <LinearProgress variant="determinate" value={((index + 1) / script.lines.length) * 100} sx={{ mt: 1, borderRadius: 999 }} />
      </Paper>

      {/* 场景 + 对话框：弹性布局，立绘永不被对话框遮挡 */}
      <Paper
        elevation={0}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box
          ref={stageRef}
          sx={{
            flexGrow: 1,
            minHeight: 0,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--sig-surface-variant)'
          }}
        >
          {/* 场景背景：内置开源背景或用户导入的背景 */}
          {background ? (
            <Box
              component="img"
              src={background.url}
              alt={background.name}
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(120% 90% at 78% 6%, ${alpha(theme.palette.primary.main, 0.26)} 0%, transparent 58%),
                  linear-gradient(170deg, var(--sig-surface-variant) 0%, transparent 70%)`
              }}
            />
          )}
          {/* 顶部与底部压暗，保证台词可读 */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(10,6,16,0.28) 0%, rgba(10,6,16,0) 26%, rgba(10,6,16,0) 62%, rgba(10,6,16,0.32) 100%)',
              pointerEvents: 'none'
            }}
          />
          {/* 立绘：高度 100% + contain，随窗口自适应且完整可见 */}
          {live2dEnabled && character?.live2d?.modelPath ? (
            <Box sx={{ position: 'absolute', inset: 0 }}>
              <Live2DStage character={character} height={stageHeight} bare />
            </Box>
          ) : sprite ? (
            <Box
              component="img"
              className="sig-breathe"
              src={toAssetUrl(sprite)}
              alt={character?.name ?? ''}
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: 0,
                transform: 'translateX(-50%)',
                height: '100%',
                maxWidth: '88%',
                objectFit: 'contain',
                objectPosition: 'bottom center',
                filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.18))'
              }}
            />
          ) : (
            <Stack alignItems="center" justifyContent="flex-end" sx={{ position: 'absolute', inset: 0, pb: 2 }}>
              <Typography className="sig-breathe" sx={{ fontSize: Math.min(150, stageHeight * 0.42), lineHeight: 1 }}>
                {character?.avatar ?? '🌸'}
              </Typography>
              <Typography variant="subtitle1">{character?.name}</Typography>
            </Stack>
          )}

          {currentScene ? (
            <Chip
              size="small"
              label={currentScene.title}
              sx={{ position: 'absolute', top: 12, left: 12, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)' }}
            />
          ) : null}
        </Box>

        {/* 对话框 */}
        <Box
          sx={{
            flexShrink: 0,
            p: { xs: 1.5, md: 2 },
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            backdropFilter: 'blur(6px)'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
            <Chip
              size="small"
              label={`${EMOTION_EMOJI[line?.emotion ?? 'neutral'] ?? ''} ${
                line?.speaker === 'character' ? character?.name ?? '角色' : line?.speaker === 'user' ? '我' : '旁白'
              }`}
              color={line?.speaker === 'user' ? 'secondary' : 'primary'}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="朗读这句">
              <IconButton
                size="small"
                onClick={() => {
                  if (line) speakLine(line.text)
                }}
              >
                <VolumeUpRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="编辑这句台词">
              <IconButton
                size="small"
                onClick={() => {
                  setDraft(line?.text ?? '')
                  setEditing(true)
                }}
              >
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {editing ? (
            <Stack spacing={1}>
              <TextField
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                multiline
                minRows={2}
                maxRows={6}
                fullWidth
                autoFocus
              />
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" startIcon={<CheckRoundedIcon />} onClick={() => void saveLineEdit()}>
                  保存
                </Button>
                <Button size="small" color="inherit" startIcon={<CloseRoundedIcon />} onClick={() => setEditing(false)}>
                  取消
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Typography
              variant="body1"
              onClick={advance}
              className={revealed < (line?.text.length ?? 0) ? 'sig-caret' : undefined}
              sx={{
                minHeight: 62,
                maxHeight: immersive ? '26vh' : '22vh',
                overflowY: 'auto',
                fontSize: { xs: 16, md: 17 },
                lineHeight: 1.85,
                cursor: 'pointer'
              }}
            >
              {line?.text.slice(0, revealed) ?? ''}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* 控制条 */}
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap>
        <IconButton disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))}>
          <SkipPreviousRoundedIcon />
        </IconButton>
        <Button
          variant={auto ? 'contained' : 'outlined'}
          startIcon={auto ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
          onClick={() => setAuto((value) => !value)}
        >
          {auto ? '自动播放中' : '自动播放'}
        </Button>
        <Button variant="contained" endIcon={<SkipNextRoundedIcon />} onClick={advance}>
          下一句
        </Button>
        {currentScene && currentScene.index < scenes.length - 1 ? (
          <Button variant="text" onClick={() => setIndex(currentScene.end + 1)}>
            跳到下一幕
          </Button>
        ) : null}
        {!compact ? (
          <Typography variant="caption" color="text.disabled">
            空格 / 点击正文推进 · F 全屏 · Esc 退出
          </Typography>
        ) : null}
      </Stack>

      {save && save.progress > 0 && !immersive ? (
        <Alert severity="info" icon={false}>
          已自动保存进度：第 {save.linesRead + 1} 行 / 共 {save.totalLines} 行（{Math.round(save.progress * 100)}%）
        </Alert>
      ) : null}

      <Dialog open={logOpen} onClose={() => setLogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>对话记录</DialogTitle>
        <DialogContent dividers>
          <List dense>
            {script.lines.slice(0, index + 1).map((item, itemIndex) => (
              <ListItem key={item.id} disableGutters onClick={() => setIndex(itemIndex)} sx={{ cursor: 'pointer' }}>
                <ListItemText
                  primary={item.speaker === 'character' ? character?.name ?? '角色' : item.speaker === 'user' ? '我' : '旁白'}
                  secondary={item.text}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      <Drawer anchor="right" open={sceneOpen} onClose={() => setSceneOpen(false)}>        <Box sx={{ width: 320, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            场景列表
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          <List dense disablePadding>
            {scenes.map((scene) => (
              <ListItemButton
                key={scene.index}
                selected={scene.index === currentScene?.index}
                onClick={() => {
                  setIndex(scene.start)
                  setSceneOpen(false)
                }}
                sx={{ borderRadius: 1.25, mb: 0.25 }}
              >
                <ListItemText
                  primary={`第 ${scene.index + 1} 幕 · ${scene.title}`}
                  secondary={`第 ${scene.start + 1} - ${scene.end + 1} 行`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* 背景选择 */}
      <Drawer anchor="right" open={backgroundOpen} onClose={() => setBackgroundOpen(false)}>
        <Box sx={{ width: 360, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            场景背景
          </Typography>
          <Typography variant="caption" color="text.secondary">
            内置开源背景 + 你在主页导入的背景；选择后会保存在这个剧本里。
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          {backgrounds.length === 0 ? (
            <Alert severity="info" icon={false}>
              还没有可用背景。可在主页左上角「导入场景」添加本地图片。
            </Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {backgrounds.map((scene) => (
                <Box
                  key={scene.id}
                  onClick={async () => {
                    const next = await api.gal.saveScript({ id: script.id, sceneId: scene.id })
                    setScript(next)
                    setBackgroundOpen(false)
                    toast('success', `已切换背景：${scene.name}`)
                  }}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1.25,
                    overflow: 'hidden',
                    border: '2px solid',
                    borderColor: scene.id === background?.id ? 'primary.main' : 'divider'
                  }}
                >
                  <Box
                    component="img"
                    src={scene.url}
                    alt={scene.name}
                    sx={{ width: '100%', height: 84, objectFit: 'cover', display: 'block' }}
                  />
                  <Typography variant="caption" sx={{ display: 'block', px: 0.75, py: 0.5 }} noWrap>
                    {scene.custom ? '📁 ' : ''}
                    {scene.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <Button
            size="small"
            variant="outlined"
            sx={{ mt: 2 }}
            onClick={() => {
              setBackgroundOpen(false)
              setImmersive(false)
              navigate('/')
            }}
          >
            去主页导入更多背景
          </Button>
        </Box>
      </Drawer>
    </Stack>
  )
}
