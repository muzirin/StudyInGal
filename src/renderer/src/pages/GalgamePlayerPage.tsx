import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
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
  const { scriptId = '' } = useParams<{ scriptId: string }>()
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)

  const [script, setScript] = useState<GalScript | null>(null)
  const [character, setCharacter] = useState<Character | null>(null)
  const [save, setSave] = useState<ArchiveSave | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [auto, setAuto] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
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

  useEffect(() => {
    setRevealed(0)
    if (!line) return
    let cursor = 0
    const step = () => {
      cursor += 1
      setRevealed(cursor)
      if (cursor < line.text.length) {
        timerRef.current = window.setTimeout(step, Math.max(12, 26 - line.text.length / 20))
      }
    }
    timerRef.current = window.setTimeout(step, 120)
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
    const timer = window.setTimeout(() => advance(), 1600)
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
    return (
      character.sprites.find((item) => item.emotion === line.emotion)?.path ??
      character.sprites[0]?.path ??
      null
    )
  }, [character, line])

  if (!script) {
    return (
      <Section title="剧本不存在">
        <EmptyState title="找不到这个剧本" action={<Button variant="contained" onClick={() => navigate('/galgame')}>返回 Gal 工坊</Button>} />
      </Section>
    )
  }

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }} noWrap>
          {script.title}
        </Typography>
        <Chip size="small" label={`${index + 1} / ${script.lines.length}`} />
        <Tooltip title="导出存档（可上传到已挂载的云盘）">
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
        <IconButton size="small" onClick={() => setLogOpen(true)}>
          <HistoryRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>

      <LinearProgress variant="determinate" value={((index + 1) / script.lines.length) * 100} sx={{ borderRadius: 999 }} />

      <Paper
        elevation={0}
        onClick={advance}
        sx={{
          position: 'relative',
          flexGrow: 1,
          minHeight: 420,
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          background:
            'linear-gradient(160deg, var(--sig-surface-variant) 0%, transparent 45%), linear-gradient(20deg, rgba(0,0,0,0.06) 0%, transparent 60%)',
          cursor: 'pointer'
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          {sprite ? (
            <Box component="img" src={sprite} alt={character?.name ?? ''} sx={{ maxHeight: '78%', maxWidth: '70%' }} />
          ) : (
            <Stack alignItems="center">
              <Typography sx={{ fontSize: 120, lineHeight: 1 }}>{character?.avatar ?? '🌸'}</Typography>
              <Typography variant="h6">{character?.name}</Typography>
            </Stack>
          )}
        </Box>

        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 3, background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip
              size="small"
              label={`${EMOTION_EMOJI[line?.emotion ?? 'neutral'] ?? ''} ${
                line?.speaker === 'character' ? character?.name ?? '角色' : line?.speaker === 'user' ? '我' : '旁白'
              }`}
              color={line?.speaker === 'user' ? 'secondary' : 'primary'}
            />
          </Stack>
          <Typography variant="body1" sx={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)', minHeight: 72, fontSize: 17, lineHeight: 1.8 }}>
            {line?.text.slice(0, revealed) ?? ''}
          </Typography>
        </Box>
      </Paper>

      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
        <IconButton disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))}>
          <SkipPreviousRoundedIcon />
        </IconButton>
        <Button variant={auto ? 'contained' : 'outlined'} startIcon={auto ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />} onClick={() => setAuto((value) => !value)}>
          {auto ? '自动播放中' : '自动播放'}
        </Button>
        <Button variant="contained" endIcon={<SkipNextRoundedIcon />} onClick={advance}>
          下一句
        </Button>
        <IconButton
          onClick={() => {
            if (!line) return
            if (!('speechSynthesis' in window)) return
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(line.text)
            utterance.lang = 'zh-CN'
            window.speechSynthesis.speak(utterance)
          }}
        >
          <VolumeUpRoundedIcon />
        </IconButton>
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
    </Stack>
  )
}
