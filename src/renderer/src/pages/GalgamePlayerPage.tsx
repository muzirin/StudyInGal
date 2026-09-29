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
import QuizRoundedIcon from '@mui/icons-material/QuizRounded'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { Live2DStage } from '../components/Live2DStage'
import { QuizDialog } from '../components/QuizDialog'
import { buildScenes } from '../lib/scenes'
import { resolveBackground, useBackgrounds } from '../lib/backgrounds'
import { toAssetUrl } from '../lib/assets'
import { useCharacterSprite } from '../lib/bundledAssets'
import type { ArchiveSave, Character, GalScript, QuizQuestion } from '@shared/types'

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

/** 悬浮操作簇的玻璃样式 */
const GLASS_CONTROL = {
  p: 0.5,
  borderRadius: 999,
  bgcolor: 'rgba(16,10,22,0.55)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.16)',
  color: '#fff'
} as const

export function GalgamePlayerPage() {
  const theme = useTheme()
  const { scriptId = '' } = useParams<{ scriptId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const setCrumb = useAppStore((state) => state.setCrumb)
  const immersive = useAppStore((state) => state.immersive)
  const setImmersive = useAppStore((state) => state.setImmersive)
  const live2dEnabled = useAppStore((state) => state.settings?.live2d.enabled ?? false)
  const quizAuto = useAppStore((state) => state.settings?.quiz?.autoAtSceneEnd ?? true)
  const quizCount = useAppStore((state) => state.settings?.quiz?.count ?? 3)
  const generateAtCheckpoint = useAppStore((state) => state.settings?.quiz?.generateAtCheckpoint ?? false)
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
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [stageHeight, setStageHeight] = useState(420)
  const [quiz, setQuiz] = useState<{ open: boolean; questions: QuizQuestion[]; title: string }>({
    open: false,
    questions: [],
    title: ''
  })
  const [regenerating, setRegenerating] = useState(false)
  const [finished, setFinished] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const askedQuestions = useRef<Set<string>>(new Set())
  const timerRef = useRef<number | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const fullscreenRef = useRef(false)
  const lastSceneRef = useRef(-1)

  const backgrounds = useBackgrounds()
  const settingsHomeSceneId = useAppStore((state) => state.settings?.home?.sceneId ?? null)
  const background = useMemo(
    () => resolveBackground(backgrounds, script?.sceneId ?? settingsHomeSceneId),
    [backgrounds, script?.sceneId, settingsHomeSceneId]
  )

  useEffect(() => {
    let cancelled = false
    // 换剧本时清掉上一部剧本的答题状态，否则阶段性检测会把旧进度算进来
    askedQuestions.current.clear()
    lastSceneRef.current = -1
    setFinished(false)
    setAnsweredCount(0)
    setQuiz({ open: false, questions: [], title: '' })
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

  // #/galgame/<id>?immersive=1 直接全屏游玩；?quiz=1 直接开始问答
  useEffect(() => {
    if (searchParams.get('immersive') === '1') setImmersive(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const line = script?.lines[index] ?? null
  const scenes = useMemo(() => buildScenes(script?.lines ?? []), [script?.lines])
  const currentScene = useMemo(() => scenes.find((scene) => index >= scene.start && index <= scene.end) ?? null, [scenes, index])
  const sprite = useCharacterSprite(character, line?.emotion ?? 'neutral')

  // 场景区高度自适应：窗口/沉浸模式变化时重新测量，立绘始终完整可见
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
    else {
      setAuto(false)
      // 读到结尾：收尾时把最后一段的检测放出来
      setFinished(true)
    }
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

  /* --------------------------------- 答题 --------------------------------- */

  const quizQuestions = script?.questions ?? []
  /** 题目带 checkpoint 时按进度穿插检测；旧剧本没有锚点，退化为「每幕一批」 */
  const stagedQuiz = quizQuestions.some((item) => typeof item.checkpoint === 'number')

  /** 每幕分配到的题量：题目总量 / 幕数，且不超过设置里的「每组题目数量」。 */
  const perScene = Math.max(
    1,
    Math.min(quizCount, Math.ceil(quizQuestions.length / Math.max(1, scenes.length)))
  )

  const openQuizWith = (items: QuizQuestion[], title: string): void => {
    if (items.length === 0) {
      setQuiz({ open: true, questions: [], title: `${script?.title ?? ''} · 暂无题目` })
      return
    }
    for (const item of items) askedQuestions.current.add(item.id)
    setAnsweredCount(askedQuestions.current.size)
    setQuiz({ open: true, questions: items, title })
  }

  /** 给旧剧本（没有题目）补题，成功后写回剧本。 */
  const regenerateQuestions = async (): Promise<{ questions: QuizQuestion[]; truncated: boolean }> => {
    if (!script) return { questions: [], truncated: false }
    setRegenerating(true)
    try {
      const result = await api.quiz.generateForScript(script.id, 6)
      const fresh = await api.gal.getScript(script.id)
      if (fresh) setScript(fresh)
      toast('success', `已生成 ${result.questions.length} 道题并保存到剧本`)
      return result
    } finally {
      setRegenerating(false)
    }
  }

  // 阶段性检测（新）：题目锚在剧本进度上，读到该段落后插入一次检测
  useEffect(() => {
    if (!script || !quizAuto || !stagedQuiz) return
    const due = quizQuestions.filter((item) => {
      if (askedQuestions.current.has(item.id)) return false
      if (typeof item.checkpoint !== 'number') return false
      // 已经读过了该题对应的段落（走完整段，或读到最后一句准备收尾）
      return item.checkpoint < index || (finished && item.checkpoint <= index)
    })
    if (due.length === 0) return
    const batch = due.slice(0, quizCount)
    // 标题按「刚读完的那一句」标注，而不是当前句，避免看起来比实际进度超前一句
    const lastCheckpoint = Math.max(...batch.map((item) => (typeof item.checkpoint === 'number' ? item.checkpoint : index))) + 1
    const title = `${script.title} · 读到第 ${lastCheckpoint} 句的检测`

    if (!generateAtCheckpoint) {
      openQuizWith(batch, title)
      return
    }

    // 「学到哪里问到哪里」：只把已读到的台词交给模型当场出题，保证不超纲。
    // 预生成的同段题目直接标记为已用，避免和现场出的题重复。
    void (async () => {
      for (const item of batch) askedQuestions.current.add(item.id)
      setAnsweredCount(askedQuestions.current.size)
      try {
        const readSoFar = script.lines
          .slice(0, index + (finished ? 1 : 0))
          .map((line) => `${line.speaker === 'character' ? character?.name ?? '角色' : line.speaker === 'user' ? '我' : '旁白'}：${line.text}`)
          .join('\n')
        const generated = await api.quiz.generate({
          sourceId: script.sourceId,
          scriptId: script.id,
          contextText: readSoFar,
          title,
          count: Math.max(1, Math.min(quizCount, 3))
        })
        setQuiz({ open: true, questions: generated.questions, title })
      } catch (error) {
        toast('warning', `现场出题失败（${(error as Error).message}），改用随剧本预生成的题目`)
        setQuiz({ open: true, questions: batch, title })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, quizAuto, stagedQuiz, generateAtCheckpoint, script?.id, quizQuestions.length])

  // 兼容旧剧本：每读完一幕，弹出这一幕对应的题目
  useEffect(() => {
    if (!currentScene || !script) return
    if (stagedQuiz) return
    if (lastSceneRef.current === currentScene.index) return
    const previous = lastSceneRef.current
    lastSceneRef.current = currentScene.index
    if (previous < 0) return
    if (!quizAuto) return
    const pending = quizQuestions.filter((item) => !askedQuestions.current.has(item.id))
    if (pending.length === 0) return
    openQuizWith(pending.slice(0, perScene), `${script.title} · 第 ${currentScene.index + 1} 幕`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene?.index, quizAuto, quizQuestions.length, script?.id, stagedQuiz])

  // ?quiz=1 直接开始问答
  useEffect(() => {
    if (searchParams.get('quiz') !== '1' || !script) return
    openQuizWith(quizQuestions.slice(0, Math.max(perScene, 3)), `${script.title} · 随堂问答`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, script?.id, quizQuestions.length])

  /* ------------------------------ 全屏与快捷键 ------------------------------ */

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
      /* ignore */
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

  // 离开页面时只恢复窗口状态；沉浸标志由 AppShell 在路由变化时清理，
  // 这里**不能**重置 immersive——否则切换沉浸导致的重挂载会把 UI 又拉回来。
  useEffect(
    () => () => {
      if (fullscreenRef.current) void api.app.window('toggle-fullscreen')
      fullscreenRef.current = false
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

  const iconSx = { color: '#fff' } as const

  return (
    <Stack spacing={0} sx={{ height: '100%', minHeight: 0 }}>
      {/* 非沉浸模式：顶部信息条 */}
      {!immersive ? (
        <Paper elevation={0} sx={{ p: 1, mb: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1, minWidth: 140 }} noWrap>
              {script.title}
            </Typography>
            <Chip size="small" label={`第 ${(currentScene?.index ?? 0) + 1} 幕 / 共 ${scenes.length} 幕`} />
            <Chip size="small" variant="outlined" label={`${index + 1} / ${script.lines.length}`} />
            {quizQuestions.length > 0 ? (
              <Chip
                size="small"
                color={stagedQuiz ? 'primary' : 'default'}
                variant={stagedQuiz ? 'filled' : 'outlined'}
                label={`检测 ${answeredCount}/${quizQuestions.length}`}
              />
            ) : null}
          </Stack>
          <LinearProgress variant="determinate" value={((index + 1) / script.lines.length) * 100} sx={{ mt: 1, borderRadius: 999 }} />
        </Paper>
      ) : null}

      {/* 场景 */}
      <Paper
        elevation={0}
        sx={{
          flexGrow: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: immersive ? 0 : 2,
          border: immersive ? 'none' : '1px solid',
          borderColor: 'divider',
          backgroundColor: 'var(--sig-surface-variant)'
        }}
      >
        <Box ref={stageRef} onClick={advance} sx={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
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
                background: `radial-gradient(120% 90% at 78% 6%, ${alpha(theme.palette.primary.main, 0.26)} 0%, transparent 58%), linear-gradient(170deg, var(--sig-surface-variant) 0%, transparent 70%)`
              }}
            />
          )}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(10,6,16,0.3) 0%, rgba(10,6,16,0) 24%, rgba(10,6,16,0) 58%, rgba(10,6,16,0.36) 100%)',
              pointerEvents: 'none'
            }}
          />

          {/* 立绘：完整可见、随窗口自适应（无浮动动画） */}
          {live2dEnabled && character?.live2d?.modelPath ? (
            <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <Live2DStage character={character} height={stageHeight} bare />
            </Box>
          ) : sprite ? (
            <Box
              component="img"
              src={toAssetUrl(sprite)}
              alt={character?.name ?? ''}
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: 96,
                transform: 'translateX(-50%)',
                height: `calc(100% - 96px)`,
                maxWidth: '86%',
                objectFit: 'contain',
                objectPosition: 'bottom center',
                filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.32))',
                pointerEvents: 'none'
              }}
            />
          ) : (
            <Stack alignItems="center" justifyContent="flex-end" sx={{ position: 'absolute', inset: 0, pb: 12, pointerEvents: 'none' }}>
              <Typography sx={{ fontSize: Math.min(150, stageHeight * 0.4), lineHeight: 1 }}>{character?.avatar ?? '🌸'}</Typography>
              <Typography variant="subtitle1" sx={{ color: '#fff' }}>
                {character?.name}
              </Typography>
            </Stack>
          )}

          {/* 左上：当前幕 */}
          {currentScene ? (
            <Chip size="small" label={currentScene.title} sx={{ position: 'absolute', top: 12, left: 12, zIndex: 3, ...GLASS_CONTROL, borderRadius: 1.5, px: 0.5 }} />
          ) : null}

          {/* 右上：悬浮操作簇 */}
          <Stack
            direction="row"
            spacing={0.25}
            alignItems="center"
            onClick={(event) => event.stopPropagation()}
            sx={{ position: 'absolute', top: 12, right: 12, zIndex: 4, ...GLASS_CONTROL }}
          >
            <Tooltip title={stagedQuiz ? '检测已读到的内容' : '随堂问答'}>
              <IconButton aria-label="随堂问答"
                size="small"
                sx={iconSx}
                onClick={() => {
                  // 阶段性检测：只问「已经读到」的题目，绝不提前剧透后面的内容
                  const pool = stagedQuiz
                    ? quizQuestions.filter((item) => typeof item.checkpoint === 'number' && (item.checkpoint < index || (finished && item.checkpoint <= index)))
                    : quizQuestions
                  const pending = pool.filter((item) => !askedQuestions.current.has(item.id))
                  if (pending.length === 0) {
                    if (stagedQuiz) {
                      const next = quizQuestions.find((item) => !askedQuestions.current.has(item.id) && typeof item.checkpoint === 'number')
                      toast('info', next ? `还没有读到下一处检测点（第 ${(next.checkpoint ?? 0) + 1} 句之后才会出题）` : '这本书的检测题已经做完了')
                    } else {
                      toast('info', '暂时没有可用的题目')
                    }
                    return
                  }
                  openQuizWith(
                    pending.slice(0, stagedQuiz ? Math.max(1, Math.min(quizCount, 2)) : Math.max(perScene, 3)),
                    stagedQuiz ? `${script.title} · 检测已读内容` : `${script.title} · 随堂问答`
                  )
                }}
              >
                <QuizRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="更换场景背景">
              <IconButton aria-label="更换场景背景" size="small" sx={iconSx} onClick={() => setBackgroundOpen(true)}>
                <WallpaperRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="场景列表">
              <IconButton aria-label="场景列表" size="small" sx={iconSx} onClick={() => setSceneOpen(true)}>
                <MovieFilterRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="对话记录">
              <IconButton aria-label="对话记录" size="small" sx={iconSx} onClick={() => setLogOpen(true)}>
                <HistoryRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="把这句加入黑板笔记">
              <IconButton aria-label="加入黑板笔记" size="small" sx={iconSx} onClick={() => void quoteToNotes()}>
                <StickyNote2RoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="导出存档">
              <IconButton aria-label="导出存档"
                size="small"
                sx={iconSx}
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
            <Tooltip title={autoSpeak ? '关闭自动朗读' : '开启自动朗读'}>
              <IconButton aria-label="自动朗读" size="small" sx={iconSx} onClick={() => setAutoSpeak((value) => !value)}>
                {autoSpeak ? <VolumeUpRoundedIcon fontSize="small" /> : <VolumeOffRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.25)', mx: 0.25 }} />
            <Tooltip title={immersive ? '退出全屏（Esc）' : '全屏游玩（F）'}>
              <IconButton aria-label="全屏" size="small" sx={iconSx} onClick={() => void toggleFullscreen()}>
                {immersive ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>

          {/* 对话岛：悬浮、居中、点击推进 */}
          <Box
            onClick={(event) => {
              event.stopPropagation()
              if (!editing) advance()
            }}
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 18,
              transform: 'translateX(-50%)',
              width: 'min(94%, 940px)',
              zIndex: 3
            }}
          >
            <Paper
              elevation={12}
              sx={{
                p: { xs: 1.75, md: 2.25 },
                borderRadius: 4,
                bgcolor: 'rgba(16,10,22,0.8)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                cursor: editing ? 'default' : 'pointer'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                <Chip
                  size="small"
                  color={line?.speaker === 'user' ? 'secondary' : 'primary'}
                  label={`${EMOTION_EMOJI[line?.emotion ?? 'neutral'] ?? ''} ${
                    line?.speaker === 'character' ? character?.name ?? '角色' : line?.speaker === 'user' ? '我' : '旁白'
                  }`}
                />
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                  {compact ? '' : '点击此处或场景推进 · 空格'}
                </Typography>
                <Tooltip title="朗读这句">
                  <IconButton
                    size="small"
                    sx={iconSx}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (line) speakLine(line.text)
                    }}
                  >
                    <VolumeUpRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="编辑这句台词">
                  <IconButton
                    size="small"
                    sx={iconSx}
                    onClick={(event) => {
                      event.stopPropagation()
                      setDraft(line?.text ?? '')
                      setEditing(true)
                    }}
                  >
                    <EditRoundedIcon sx={{ fontSize: 18 }} />
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
                    maxRows={6}
                    fullWidth
                    autoFocus
                    InputProps={{ sx: { color: '#1c1220', bgcolor: 'rgba(255,255,255,0.94)', borderRadius: 2 } }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" startIcon={<CheckRoundedIcon />} onClick={() => void saveLineEdit()}>
                      保存
                    </Button>
                    <Button size="small" color="inherit" startIcon={<CloseRoundedIcon />} sx={iconSx} onClick={() => setEditing(false)}>
                      取消
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography
                  variant="body1"
                  className={revealed < (line?.text.length ?? 0) ? 'sig-caret' : undefined}
                  sx={{ minHeight: 56, maxHeight: immersive ? '24vh' : '20vh', overflowY: 'auto', fontSize: { xs: 16, md: 17.5 }, lineHeight: 1.85 }}
                >
                  {line?.text.slice(0, revealed) ?? ''}
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>
      </Paper>

      {/* 非沉浸模式：底部控制条 */}
      {!immersive ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
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
          {save && save.progress > 0 ? (
            <Typography variant="caption" color="text.disabled">
              进度 {Math.round(save.progress * 100)}%
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      <QuizDialog
        open={quiz.open}
        onClose={() => setQuiz((current) => ({ ...current, open: false }))}
        sourceId={script.sourceId}
        scriptId={script.id}
        title={quiz.title}
        questions={quiz.questions.length > 0 ? quiz.questions : undefined}
        speakerName={character?.name}
        regenerate={regenerateQuestions}
      />

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
                  <Box component="img" src={scene.url} alt={scene.name} sx={{ width: '100%', height: 84, objectFit: 'cover', display: 'block' }} />
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
              void exitImmersive()
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
