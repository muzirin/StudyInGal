import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import TheaterComedyRoundedIcon from '@mui/icons-material/TheaterComedyRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { Live2DStage } from '../components/Live2DStage'
import { MarkdownView } from '../components/MarkdownView'
import { EmptyState } from '../components/Section'
import { dayBucket, formatRelative } from '../lib/format'
import { NAV_GROUPS, MODULES } from '../modules/registry'
import type { Character, HistoryEntry, HistoryKind } from '@shared/types'

import sakuraPath from '../assets/scenes/sakura-path.svg'
import labScene from '../assets/scenes/lab.svg'
import classroomDusk from '../assets/scenes/classroom-dusk.svg'
import libraryNight from '../assets/scenes/library-night.svg'
import rooftopStars from '../assets/scenes/rooftop-stars.svg'

interface SceneDef {
  id: string
  name: string
  url: string
  from: number
  to: number
}

/** 内置场景背景（程序化生成，无版权风险）。from/to 是自动切换用的时段。 */
const SCENES: SceneDef[] = [
  { id: 'sakura-path', name: '樱花道 · 清晨', url: sakuraPath, from: 5, to: 11 },
  { id: 'lab', name: '实验室 · 白天', url: labScene, from: 11, to: 17 },
  { id: 'classroom-dusk', name: '黄昏教室', url: classroomDusk, from: 17, to: 20 },
  { id: 'library-night', name: '夜晚图书馆', url: libraryNight, from: 20, to: 24 },
  { id: 'rooftop-stars', name: '星空天台', url: rooftopStars, from: 0, to: 5 }
]

function sceneForNow(): SceneDef {
  const hour = new Date().getHours()
  return SCENES.find((scene) => hour >= scene.from && hour < scene.to) ?? SCENES[2]
}

const HISTORY_FILTERS: { id: 'all' | HistoryKind; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'paper', label: '论文' },
  { id: 'textbook', label: '教材' },
  { id: 'script', label: '剧本' },
  { id: 'save', label: '存档' }
]

const HISTORY_ICON: Record<HistoryKind, React.ReactNode> = {
  paper: <ScienceRoundedIcon sx={{ fontSize: 18 }} />,
  textbook: <MenuBookRoundedIcon sx={{ fontSize: 18 }} />,
  script: <AutoStoriesRoundedIcon sx={{ fontSize: 18 }} />,
  save: <SaveRoundedIcon sx={{ fontSize: 18 }} />,
  tool: <GridViewRoundedIcon sx={{ fontSize: 18 }} />,
  action: <BoltRoundedIcon sx={{ fontSize: 18 }} />
}

const QUIPS = [
  '今天也一起加油吧～先从最容易的一小节开始！',
  '要不要试试把这篇论文变成 Galgame？我会讲得很有趣哦。',
  '别忘了番茄钟，专注 25 分钟就休息一下。',
  '黑板笔记写多了就会变成自己的知识，记得「精读本章」。',
  '课表上的下一节课准备好了吗？我可以帮你复习要点。',
  '累了就放点白噪音，雨声最适合看书了。',
  '有不懂的地方随时选中间问我，我一直都在。'
]

const BUCKET_ORDER = ['今天', '昨天', '本周', '更早'] as const

export function HomePage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const toast = useAppStore((state) => state.toast)

  const [characters, setCharacters] = useState<Character[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [filter, setFilter] = useState<'all' | HistoryKind>('all')
  const [bubble, setBubble] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ study: true })
  const [openBuckets, setOpenBuckets] = useState<Record<string, boolean>>({ 今天: true, 昨天: true })
  const [historyOpen, setHistoryOpen] = useState(true)
  const [navOpen, setNavOpen] = useState(true)
  const [scenePickerOpen, setScenePickerOpen] = useState(false)
  const [counts, setCounts] = useState({ paper: 0, textbook: 0, saves: 0, scripts: 0 })
  const [examplesAdded, setExamplesAdded] = useState(false)

  const companion = useMemo(
    () =>
      characters.find((item) => item.id === settings?.companion.activeCharacterId) ??
      characters.find((item) => item.isCompanion) ??
      characters[0] ??
      null,
    [characters, settings?.companion.activeCharacterId]
  )

  const activeScene = useMemo(() => {
    if (!settings?.home) return sceneForNow()
    if (settings.home.autoScene) return sceneForNow()
    return SCENES.find((scene) => scene.id === settings.home.sceneId) ?? sceneForNow()
  }, [settings?.home, settings?.home?.sceneId, settings?.home?.autoScene])

  const refreshHistory = useCallback(async () => {
    setHistory(await api.history.list(60).catch(() => []))
  }, [])

  useEffect(() => {
    void (async () => {
      const [characterList, saves, papers, textbooks, scripts] = await Promise.all([
        api.characters.list().catch(() => []),
        api.archive.list().catch(() => []),
        api.library.snapshot('paper').catch(() => null),
        api.library.snapshot('textbook').catch(() => null),
        api.gal.listScripts().catch(() => [])
      ])
      setCharacters(characterList)
      setCounts({
        paper: papers?.nodes.length ?? 0,
        textbook: textbooks?.nodes.length ?? 0,
        saves: saves.length,
        scripts: scripts.length
      })
    })()
    void refreshHistory()
    const unsubscribe = api.events.subscribe((event) => {
      const typed = event as { type: string }
      if (typed.type === 'history-changed') void refreshHistory()
    })
    return unsubscribe
  }, [refreshHistory])

  useEffect(() => {
    setBubble(companion?.greeting ?? '')
  }, [companion?.id, companion?.greeting])

  const ask = async (): Promise<void> => {
    const prompt = question.trim()
    if (!prompt) return
    setBusy(true)
    setBubble('……')
    try {
      const response = await api.ai.chat({
        capability: 'chat',
        messages: [
          { role: 'system', content: companion?.systemPrompt ?? '你是一位耐心的学习助手。' },
          { role: 'user', content: prompt }
        ]
      })
      setBubble(response.content)
      setQuestion('')
    } catch (error) {
      setBubble(`呜…暂时联系不上模型：${(error as Error).message}`)
      toast('warning', '对话失败，请检查「设置 → API 与语音」')
    } finally {
      setBusy(false)
    }
  }

  const addExamples = async (): Promise<void> => {
    try {
      const result = await api.gal.seedExamples()
      setExamplesAdded(true)
      setCounts((prev) => ({ ...prev, scripts: prev.scripts + result.added }))
      toast('success', `已添加 ${result.added} 个示例剧本，去「Gal 工坊」看看吧`)
    } catch (error) {
      toast('error', `添加示例失败：${(error as Error).message}`)
    }
  }

  const groupedHistory = useMemo(() => {
    const filtered = filter === 'all' ? history : history.filter((entry) => entry.kind === filter)
    const buckets = new Map<string, HistoryEntry[]>()
    for (const entry of filtered) {
      const bucket = dayBucket(entry.at)
      if (!buckets.has(bucket)) buckets.set(bucket, [])
      buckets.get(bucket)?.push(entry)
    }
    return BUCKET_ORDER.filter((bucket) => buckets.has(bucket)).map((bucket) => ({
      bucket,
      entries: buckets.get(bucket) ?? []
    }))
  }, [history, filter])

  const hidden = settings?.nav.hidden ?? []
  const devEnabled = settings?.developer.enabled ?? false
  const visibleModules = MODULES.filter((module) => {
    if (hidden.includes(module.id)) return false
    if (module.devOnly && !devEnabled) return false
    return true
  })

  const sprite = useMemo(
    () => companion?.sprites?.find((item) => item.emotion === 'happy')?.path ?? companion?.sprites?.[0]?.path ?? null,
    [companion]
  )

  return (
    <Stack spacing={2.5}>
      {/* ------------------------------ Galgame 场景 ------------------------------ */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 380, md: 460 },
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: `0 18px 40px -24px ${alpha(theme.palette.primary.main, 0.55)}`
        }}
      >
        <Box
          component="img"
          src={activeScene.url}
          alt={activeScene.name}
          onClick={() => setBubble(QUIPS[Math.floor(Math.random() * QUIPS.length)])}
          title="点击场景让伴学娘说句话"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'pointer',
            transition: 'transform 8s ease',
            '&:hover': { transform: 'scale(1.03)' }
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(12,8,18,0.18) 0%, rgba(12,8,18,0.02) 32%, rgba(12,8,18,0.72) 100%)'
          }}
        />

        {/* 立绘 / Live2D */}
        <Box
          sx={{
            position: 'absolute',
            right: { xs: '50%', md: '10%' },
            transform: { xs: 'translateX(50%)', md: 'none' },
            bottom: 130,
            height: '60%',
            minWidth: 180,
            display: 'grid',
            placeItems: 'end center',
            pointerEvents: 'none'
          }}
        >
          {settings?.live2d.enabled && companion?.live2d?.modelPath ? (
            <Box sx={{ width: 280, height: '100%', pointerEvents: 'auto' }}>
              <Live2DStage character={companion} height={300} bare />
            </Box>
          ) : sprite ? (
            <Box
              component="img"
              src={sprite}
              alt={companion?.name ?? ''}
              className="sig-breathe"
              sx={{ maxHeight: '100%', maxWidth: 340, filter: 'drop-shadow(0 16px 30px rgba(0,0,0,0.45))' }}
            />
          ) : (
            <Typography
              className="sig-breathe"
              sx={{ fontSize: 150, lineHeight: 1, filter: 'drop-shadow(0 16px 30px rgba(0,0,0,0.45))' }}
            >
              {companion?.avatar ?? '🌸'}
            </Typography>
          )}
        </Box>

        {/* 左上：场景选择 */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ position: 'absolute', top: 14, left: 14, right: 14, flexWrap: 'wrap', rowGap: 1 }}>
          <Chip
            size="small"
            icon={<TheaterComedyRoundedIcon sx={{ fontSize: 15 }} />}
            label={activeScene.name}
            onClick={() => setScenePickerOpen((value) => !value)}
            sx={{ bgcolor: 'rgba(20,14,26,0.5)', color: '#fff', backdropFilter: 'blur(8px)' }}
          />
          <Tooltip title="按时间自动切换场景">
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: 'rgba(20,14,26,0.5)', backdropFilter: 'blur(8px)' }}
            >
              <Typography variant="caption" sx={{ color: '#fff' }}>
                自动
              </Typography>
              <Switch
                size="small"
                checked={settings?.home?.autoScene ?? true}
                onChange={(event) => void patchSettings({ home: { ...(settings?.home as object), autoScene: event.target.checked } })}
                sx={{ mr: -0.5 }}
              />
            </Stack>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={0.75}>
            <Chip size="small" label={`论文 ${counts.paper}`} onClick={() => navigate('/library/paper')} clickable sx={{ bgcolor: 'rgba(20,14,26,0.5)', color: '#fff' }} />
            <Chip size="small" label={`教材 ${counts.textbook}`} onClick={() => navigate('/library/textbook')} clickable sx={{ bgcolor: 'rgba(20,14,26,0.5)', color: '#fff' }} />
            <Chip size="small" label={`剧本 ${counts.scripts}`} onClick={() => navigate('/galgame')} clickable sx={{ bgcolor: 'rgba(20,14,26,0.5)', color: '#fff' }} />
          </Stack>
        </Stack>

        {scenePickerOpen ? (
          <Stack
            direction="row"
            spacing={0.75}
            flexWrap="wrap"
            useFlexGap
            sx={{ position: 'absolute', top: 52, left: 14, right: 14, p: 1, borderRadius: 2, bgcolor: 'rgba(20,14,26,0.62)', backdropFilter: 'blur(10px)' }}
          >
            {SCENES.map((scene) => (
              <Chip
                key={scene.id}
                size="small"
                label={scene.name}
                color={scene.id === activeScene.id ? 'primary' : 'default'}
                onClick={() =>
                  void patchSettings({ home: { ...(settings?.home as object), sceneId: scene.id, autoScene: false } })
                }
                sx={scene.id === activeScene.id ? undefined : { bgcolor: 'rgba(255,255,255,0.16)', color: '#fff' }}
              />
            ))}
            <Chip
              size="small"
              variant="outlined"
              label="刷新"
              onClick={() => void patchSettings({ home: { ...(settings?.home as object), sceneId: sceneForNow().id, autoScene: true } })}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
            />
          </Stack>
        ) : null}

        {/* 对话框 */}
        <Box sx={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.background.paper, 0.9),
              backdropFilter: 'blur(12px)',
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.25)
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
              <Chip size="small" color="primary" label={companion?.name ?? '伴学娘'} />
              <Typography variant="caption" color="text.secondary">
                主页场景 · 点击背景让她说句话
              </Typography>
            </Stack>
            <Box sx={{ maxHeight: 108, overflowY: 'auto', mb: 1.25 }} className="sig-scroll-thin">
              {busy ? (
                <Typography variant="body2" color="text.secondary">
                  正在思考…
                </Typography>
              ) : (
                <MarkdownView compact>{bubble || '欢迎回来～今天想学点什么？'}</MarkdownView>
              )}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth
                size="small"
                placeholder="直接问伴学娘…（Ctrl+Shift+K 全局询问）"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void ask()
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AutoAwesomeRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 999 }
                }}
              />
              <Button
                variant="contained"
                onClick={() => void ask()}
                disabled={busy || !question.trim()}
                sx={{ minWidth: 96, whiteSpace: 'nowrap' }}
              >
                询问
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* ---------------------- 最近 + 导航 ---------------------- */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(320px, 420px)' }, gap: 2.5, alignItems: 'start' }}>
        {/* 最近 */}
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7),
            overflow: 'hidden'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.5 }}>
            <HistoryRoundedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              最近
            </Typography>
            <Chip size="small" label={`${history.length}`} />
            <Tooltip title="清空历史">
              <IconButton
                size="small"
                onClick={async () => {
                  await api.history.clear()
                  toast('info', '历史记录已清空')
                }}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setHistoryOpen((value) => !value)}>
              <ExpandMoreRoundedIcon
                fontSize="small"
                sx={{ transform: historyOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 180ms ease' }}
              />
            </IconButton>
          </Stack>
          <Collapse in={historyOpen} timeout={220} unmountOnExit>
            <Divider />
            <Stack direction="row" spacing={0.75} sx={{ px: 2.5, py: 1.25, overflowX: 'auto' }} className="sig-scroll-thin">
              {HISTORY_FILTERS.map((item) => (
                <Chip
                  key={item.id}
                  size="small"
                  label={item.label}
                  color={filter === item.id ? 'primary' : 'default'}
                  variant={filter === item.id ? 'filled' : 'outlined'}
                  onClick={() => setFilter(item.id)}
                />
              ))}
            </Stack>
            <Box sx={{ px: 2.5, pb: 2 }}>
              {groupedHistory.length === 0 ? (
                <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
                  <EmptyState
                    title="还没有学习记录"
                    description="打开论文、教材或游玩 Galgame 后，这里会出现最近记录。也可以先试试示例剧本。"
                  />
                  <Stack direction="row" spacing={1.5}>
                    <Button variant="contained" onClick={() => navigate('/library/paper')}>
                      去导入论文
                    </Button>
                    <Button variant="outlined" startIcon={<AutoStoriesRoundedIcon />} disabled={examplesAdded} onClick={() => void addExamples()}>
                      添加示例 Gal
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  {groupedHistory.map(({ bucket, entries }) => {
                    const isOpen = openBuckets[bucket] ?? false
                    return (
                      <Box key={bucket}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.5}
                          sx={{ cursor: 'pointer', py: 0.5, borderRadius: 2 }}
                          onClick={() => setOpenBuckets((prev) => ({ ...prev, [bucket]: !isOpen }))}
                        >
                          <ExpandMoreRoundedIcon
                            sx={{ fontSize: 18, color: 'text.disabled', transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms ease' }}
                          />
                          <Typography variant="caption" fontWeight={700} color="text.secondary">
                            {bucket}
                          </Typography>
                          <Chip size="small" variant="outlined" label={entries.length} sx={{ height: 18, fontSize: 11 }} />
                        </Stack>
                        <Collapse in={isOpen} timeout={180} unmountOnExit>
                          <List dense disablePadding>
                            {entries.map((entry) => (
                              <ListItemButton
                                key={entry.id}
                                onClick={() => entry.route && navigate(entry.route)}
                                title={entry.title}
                                sx={{ borderRadius: 1.5, mb: 0.25, '&:hover .delete-history': { opacity: 1 } }}
                              >
                                <ListItemIcon sx={{ minWidth: 34, color: 'primary.main' }}>{HISTORY_ICON[entry.kind]}</ListItemIcon>
                                <ListItemText
                                  primary={entry.title}
                                  secondary={entry.subtitle}
                                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                                  secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                                />
                                {entry.count > 1 ? (
                                  <Chip size="small" variant="outlined" label={`×${entry.count}`} sx={{ mr: 1, height: 18, fontSize: 11 }} />
                                ) : null}
                                <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5, flexShrink: 0 }}>
                                  {formatRelative(entry.at)}
                                </Typography>
                                <IconButton
                                  className="delete-history"
                                  size="small"
                                  sx={{ opacity: 0, transition: 'opacity 140ms ease' }}
                                  onClick={async (event) => {
                                    event.stopPropagation()
                                    await api.history.remove(entry.id)
                                  }}
                                >
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </ListItemButton>
                            ))}
                          </List>
                        </Collapse>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>
          </Collapse>
        </Box>

        {/* 导航 */}
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7),
            overflow: 'hidden'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.5 }}>
            <GridViewRoundedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              导航
            </Typography>
            <Chip size="small" label="Ctrl+K" variant="outlined" />
            <IconButton size="small" onClick={() => setNavOpen((value) => !value)}>
              <ExpandMoreRoundedIcon
                fontSize="small"
                sx={{ transform: navOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 180ms ease' }}
              />
            </IconButton>
          </Stack>
          <Collapse in={navOpen} timeout={220} unmountOnExit>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Stack spacing={1.25}>
                {NAV_GROUPS.map((group) => {
                  const children = group.children.filter((module) => visibleModules.some((item) => item.id === module.id))
                  if (children.length === 0) return null
                  const GroupIcon = group.icon
                  const isOpen = openGroups[group.id] ?? false
                  return (
                    <Box key={group.id}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !isOpen }))}
                        sx={{
                          cursor: 'pointer',
                          p: 1.25,
                          borderRadius: 2,
                          bgcolor: isOpen ? alpha(theme.palette.primary.main, 0.1) : 'var(--sig-surface-variant)',
                          transition: 'background-color 160ms ease'
                        }}
                      >
                        <GroupIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700}>
                            {group.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {group.description}
                          </Typography>
                        </Box>
                        <ChevronRightRoundedIcon
                          sx={{ fontSize: 18, color: 'text.disabled', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }}
                        />
                      </Stack>
                      <Collapse in={isOpen} timeout={180} unmountOnExit>
                        <Box
                          sx={{
                            mt: 1,
                            ml: 1.5,
                            pl: 1.5,
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                            display: 'grid',
                            gap: 0.75
                          }}
                        >
                          {children.map((module) => {
                            const Icon = module.icon
                            return (
                              <Box
                                key={module.id}
                                onClick={() => navigate(module.path)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.25,
                                  p: 1,
                                  borderRadius: 1.5,
                                  cursor: 'pointer',
                                  transition: 'background-color 140ms ease, transform 140ms ease',
                                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1), transform: 'translateX(2px)' }
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 1.25,
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: alpha(theme.palette.primary.main, 0.14),
                                    color: 'primary.main',
                                    flexShrink: 0
                                  }}
                                >
                                  <Icon sx={{ fontSize: 17 }} />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={600} noWrap>
                                    {module.label}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                                    {module.feature}
                                  </Typography>
                                </Box>
                              </Box>
                            )
                          })}
                        </Box>
                      </Collapse>
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          </Collapse>
        </Box>
      </Box>
    </Stack>
  )
}
