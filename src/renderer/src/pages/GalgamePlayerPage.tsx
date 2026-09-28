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
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded'
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { buildScenes } from '../lib/scenes'
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

interface Scene {
  index: number
  title: string
  start: number
  end: number
}

export function GalgamePlayerPage() {
  const theme = useTheme()
  const { scriptId = '' } = useParams<{ scriptId: string }>()
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const compact = useMediaQuery('(max-width: 1100px)')

  const [script, setScript] = useState<GalScript | null>(null)
  const [character, setCharacter] = useState<Character | null>(null)
  const [save, setSave] = useState<ArchiveSave | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [auto, setAuto] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [sceneOpen, setSceneOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const timerRef = useRef<number | null>(null)

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
      const found = characters.find((item) => item.id === loadedScript?.characterId) ?? characters[0] ?? null
      setCharacter(found)
      const existing = saves.find((item) => item.scriptId === scriptId) ?? null
      setSave(existing)
      setIndex(existing ? Math.min(existing.linesRead, (loadedScript?.lines.length ?? 1) - 1) : 0)
    })()
    return () => {
      cancelled = true
    }
  }, [scriptId])

  const line = script?.lines[index] ?? null
  const scenes = useMemo(() => buildScenes(script?.lines ?? []), [script?.lines])
  const currentScene = useMemo(() => scenes.find((scene) => index >= scene.start && index <= scene.end) ?? null, [scenes, index])

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

  const sprite = useMemo(() => {
    if (!character || !line) return null
    return character.sprites.find((item) => item.emotion === line.emotion)?.path ?? character.sprites[0]?.path ?? null
  }, [character, line])

  const speakLine = (text: string): void => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = character?.voice.rate ?? 1
    utterance.pitch = character?.voice.pitch ?? 1
    window.speechSynthesis.speak(utterance)
  }

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
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1, minWidth: 160 }} noWrap>
            {script.title}
          </Typography>
          <Chip size="small" label={`第 ${(currentScene?.index ?? 0) + 1} 幕 / 共 ${scenes.length} 幕`} />
          <Chip size="small" variant="outlined" label={`${index + 1} / ${script.lines.length}`} />
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
          <Tooltip title="导出存档（可上传到已挂载云盘）">
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
        </Stack>
        <LinearProgress variant="determinate" value={((index + 1) / script.lines.length) * 100} sx={{ mt: 1.25, borderRadius: 999 }} />
      </Paper>

      <Paper
        elevation={0}
        onClick={() => !editing && advance()}
        sx={{
          position: 'relative',
          flexGrow: 1,
          minHeight: compact ? 420 : 480,
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          background: `radial-gradient(120% 90% at 78% 6%, ${alpha(theme.palette.primary.main, 0.26)} 0%, transparent 58%),
            radial-gradient(90% 80% at 10% 92%, ${alpha(theme.palette.secondary.main, 0.22)} 0%, transparent 62%),
            linear-gradient(170deg, var(--sig-surface-variant) 0%, transparent 70%)`,
          cursor: editing ? 'default' : 'pointer'
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          {sprite ? (
            <Box
              component="img"
              className="sig-breathe"
              src={sprite}
              alt={character?.name ?? ''}
              sx={{ maxHeight: '76%', maxWidth: '62%', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.2))' }}
            />
          ) : (
            <Stack alignItems="center">
              <Typography className="sig-breathe" sx={{ fontSize: 130, lineHeight: 1 }}>
                {character?.avatar ?? '🌸'}
              </Typography>
              <Typography variant="h6">{character?.name}</Typography>
            </Stack>
          )}
        </Box>

        {currentScene ? (
          <Chip
            size="small"
            label={currentScene.title}
            sx={{ position: 'absolute', top: 14, left: 14, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)' }}
          />
        ) : null}

        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            p: { xs: 2, md: 3 },
            background: 'linear-gradient(transparent, rgba(20,16,24,0.62))'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
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
                sx={{ color: '#fff' }}
                onClick={(event) => {
                  event.stopPropagation()
                  if (line) speakLine(line.text)
                }}
              >
                <VolumeUpRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="编辑这句台词">
              <IconButton
                size="small"
                sx={{ color: '#fff' }}
                onClick={(event) => {
                  event.stopPropagation()
                  setDraft(line?.text ?? '')
                  setEditing(true)
                }}
              >
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {editing ? (
            <Stack spacing={1} onClick={(event) => event.stopPropagation()}>
              <TextField
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                multiline
                minRows={2}
                fullWidth
                InputProps={{ sx: { bgcolor: 'rgba(255,255,255,0.94)', borderRadius: 2 } }}
              />
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" startIcon={<CheckRoundedIcon />} onClick={() => void saveLineEdit()}>
                  保存
                </Button>
                <Button size="small" color="inherit" startIcon={<CloseRoundedIcon />} onClick={() => setEditing(false)} sx={{ color: '#fff' }}>
                  取消
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Typography
              variant="body1"
              className={revealed < (line?.text.length ?? 0) ? 'sig-caret' : undefined}
              sx={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.55)', minHeight: 76, fontSize: 17, lineHeight: 1.85 }}
            >
              {line?.text.slice(0, revealed) ?? ''}
            </Typography>
          )}
        </Box>
      </Paper>

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
      </Stack>

      {save && save.progress > 0 ? (
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

      <Drawer anchor="right" open={sceneOpen} onClose={() => setSceneOpen(false)}>
        <Box sx={{ width: 320, p: 2 }}>
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
                sx={{ borderRadius: 2.5, mb: 0.25 }}
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
    </Stack>
  )
}
