import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Drawer,
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
  Typography,
  useMediaQuery
} from '@mui/material'
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
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { Live2DStage } from '../components/Live2DStage'
import { MarkdownView } from '../components/MarkdownView'
import { dayBucket, formatRelative } from '../lib/format'
import { toAssetUrl } from '../lib/assets'
import { NAV_GROUPS, MODULES } from '../modules/registry'
import { GITHUB_URL } from '@shared/constants'
import type { Character, CustomScene, HistoryEntry, HistoryKind } from '@shared/types'

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
  custom?: boolean
}

/** 内置场景背景（程序化生成，无版权风险）。from/to 是「按时间自动切换」用的时段。 */
const BUILTIN_SCENES: SceneDef[] = [
  { id: 'sakura-path', name: '樱花道 · 清晨', url: sakuraPath, from: 5, to: 11 },
  { id: 'lab', name: '实验室 · 白天', url: labScene, from: 11, to: 17 },
  { id: 'classroom-dusk', name: '黄昏教室', url: classroomDusk, from: 17, to: 20 },
  { id: 'library-night', name: '夜晚图书馆', url: libraryNight, from: 20, to: 24 },
  { id: 'rooftop-stars', name: '星空天台', url: rooftopStars, from: 0, to: 5 }
]

function sceneForNow(scenes: SceneDef[]): SceneDef {
  const hour = new Date().getHours()
  return (
    scenes.find((scene) => !scene.custom && hour >= scene.from && hour < scene.to) ??
    scenes.find((scene) => scene.id === 'classroom-dusk') ??
    scenes[0]
  )
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

const GLASS = {
  bgcolor: 'rgba(18,12,24,0.55)',
  color: '#fff',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.14)'
} as const

export function HomePage() {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const toast = useAppStore((state) => state.toast)
  const compact = useMediaQuery('(max-width: 1100px)')

  const [characters, setCharacters] = useState<Character[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [filter, setFilter] = useState<'all' | HistoryKind>('all')
  const [bubble, setBubble] = useState('')
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ study: true })
  const [openBuckets, setOpenBuckets] = useState<Record<string, boolean>>({ 今天: true, 昨天: true })
  const [sceneBarOpen, setSceneBarOpen] = useState(false)
  const [panel, setPanel] = useState<'nav' | 'recent' | null>(null)
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

  const scenes = useMemo<SceneDef[]>(() => {
    const custom: SceneDef[] = (settings?.home?.customScenes ?? []).map((scene: CustomScene) => ({
      id: scene.id,
      name: scene.name,
      url: toAssetUrl(scene.path) ?? scene.path,
      from: -1,
      to: -1,
      custom: true
    }))
    return [...BUILTIN_SCENES, ...custom]
  }, [settings?.home?.customScenes])

  const activeScene = useMemo(() => {
    if (settings?.home?.autoScene !== false) return sceneForNow(scenes)
    return scenes.find((scene) => scene.id === settings?.home?.sceneId) ?? sceneForNow(scenes)
  }, [scenes, settings?.home?.autoScene, settings?.home?.sceneId])

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

  const addCustomScene = async (): Promise<void> => {
    const paths = await api.dialogs.pickFiles({
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      multi: true
    })
    if (paths.length === 0) return
    const created: CustomScene[] = paths.map((path) => ({
      id: `scene_${Math.random().toString(36).slice(2, 8)}`,
      name: path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '自定义背景',
      path
    }))
    await patchSettings({
      home: { ...(settings?.home as object), customScenes: [...(settings?.home?.customScenes ?? []), ...created], sceneId: created[0].id, autoScene: false }
    })
    toast('success', `已添加 ${created.length} 张自定义背景`)
  }

  const removeCustomScene = async (id: string): Promise<void> => {
    await patchSettings({
      home: {
        ...(settings?.home as object),
        customScenes: (settings?.home?.customScenes ?? []).filter((scene) => scene.id !== id)
      }
    })
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

  /* --------------------------------- 面板内容 -------------------------------- */

  const recentPanel = (
    <Stack spacing={1.25} sx={{ minHeight: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <HistoryRoundedIcon sx={{ fontSize: 18 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
          最近
        </Typography>
        <Chip size="small" label={history.length} sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#fff' }} />
        <Tooltip title="清空历史">
          <IconButton
            size="small"
            sx={{ color: '#fff' }}
            onClick={async () => {
              await api.history.clear()
              toast('info', '历史记录已清空')
            }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto' }} className="sig-scroll-thin">
        {HISTORY_FILTERS.map((item) => (
          <Chip
            key={item.id}
            size="small"
            label={item.label}
            color={filter === item.id ? 'primary' : 'default'}
            variant={filter === item.id ? 'filled' : 'outlined'}
            onClick={() => setFilter(item.id)}
            sx={filter === item.id ? undefined : { color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}
          />
        ))}
      </Stack>
      <Box sx={{ minHeight: 0 }}>
        {groupedHistory.length === 0 ? (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
              还没有学习记录
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={() => navigate('/library/paper')}>
                导入论文
              </Button>
              <Button size="small" variant="outlined" disabled={examplesAdded} onClick={() => void addExamples()} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
                添加示例 Gal
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {groupedHistory.map(({ bucket, entries }) => {
              const isOpen = openBuckets[bucket] ?? false
              return (
                <Box key={bucket}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    sx={{ cursor: 'pointer', py: 0.25 }}
                    onClick={() => setOpenBuckets((prev) => ({ ...prev, [bucket]: !isOpen }))}
                  >
                    <ExpandMoreRoundedIcon
                      sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms ease' }}
                    />
                    <Typography variant="caption" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.75)' }}>
                      {bucket}
                    </Typography>
                    <Chip size="small" label={entries.length} sx={{ height: 17, fontSize: 10, bgcolor: 'rgba(255,255,255,0.14)', color: '#fff' }} />
                  </Stack>
                  <Collapse in={isOpen} timeout={180} unmountOnExit>
                    <List dense disablePadding>
                      {entries.map((entry) => (
                        <ListItemButton
                          key={entry.id}
                          onClick={() => {
                            if (entry.route) navigate(entry.route)
                            setPanel(null)
                          }}
                          sx={{ borderRadius: 1.25, mb: 0.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, '&:hover .del': { opacity: 1 } }}
                        >
                          <ListItemIcon sx={{ minWidth: 30, color: '#ffd7e6' }}>{HISTORY_ICON[entry.kind]}</ListItemIcon>
                          <ListItemText
                            primary={entry.title}
                            secondary={`${entry.subtitle} · ${formatRelative(entry.at)}`}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true, sx: { color: '#fff' } }}
                            secondaryTypographyProps={{ variant: 'caption', noWrap: true, sx: { color: 'rgba(255,255,255,0.6)' } }}
                          />
                          <IconButton
                            className="del"
                            size="small"
                            sx={{ color: '#fff', opacity: 0, transition: 'opacity 140ms ease' }}
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
    </Stack>
  )

  const navPanel = (
    <Stack spacing={1.25} sx={{ minHeight: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <GridViewRoundedIcon sx={{ fontSize: 18 }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
          导航
        </Typography>
        <Chip size="small" label="Ctrl+K" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#fff' }} />
      </Stack>
      <Stack spacing={0.75}>
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
                sx={{ cursor: 'pointer', p: 1, borderRadius: 1.25, bgcolor: isOpen ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)' }}
              >
                <GroupIcon sx={{ fontSize: 18, color: '#ffd7e6' }} />
                <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
                  {group.label}
                </Typography>
                <ChevronRightRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }} />
              </Stack>
              <Collapse in={isOpen} timeout={180} unmountOnExit>
                <Box sx={{ mt: 0.75, ml: 1, pl: 1, borderLeft: '1px solid rgba(255,255,255,0.18)', display: 'grid', gap: 0.25 }}>
                  {children.map((module) => {
                    const Icon = module.icon
                    return (
                      <Stack
                        key={module.id}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        onClick={() => {
                          navigate(module.path)
                          setPanel(null)
                        }}
                        sx={{ p: 0.75, borderRadius: 1.25, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}
                      >
                        <Icon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }} />
                        <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                          {module.label}
                        </Typography>
                        <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.5)' }}>
                          {module.feature}
                        </Typography>
                      </Stack>
                    )
                  })}
                </Box>
              </Collapse>
            </Box>
          )
        })}
      </Stack>
    </Stack>
  )

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* 场景背景 */}
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
          transition: 'transform 10s ease',
          '&:hover': { transform: 'scale(1.02)' }
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(10,6,16,0.45) 0%, rgba(10,6,16,0.05) 30%, rgba(10,6,16,0.1) 55%, rgba(10,6,16,0.8) 100%)',
          pointerEvents: 'none'
        }}
      />

      {/* 立绘 / Live2D */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: { xs: 150, md: 158 },
          transform: 'translateX(-50%)',
          height: { xs: '46%', md: '62%' },
          minWidth: 180,
          display: 'grid',
          placeItems: 'end center',
          pointerEvents: 'none'
        }}
      >
        {settings?.live2d.enabled && companion?.live2d?.modelPath ? (
          <Box sx={{ width: 300, height: '100%', pointerEvents: 'auto' }}>
            <Live2DStage character={companion} height={compact ? 280 : 380} bare />
          </Box>
        ) : sprite ? (
          <Box
            component="img"
            src={toAssetUrl(sprite)}
            alt={companion?.name ?? ''}
            className="sig-breathe"
            sx={{ maxHeight: '100%', maxWidth: 420, filter: 'drop-shadow(0 20px 34px rgba(0,0,0,0.5))' }}
          />
        ) : (
          <Typography
            className="sig-breathe"
            sx={{ fontSize: { xs: 130, md: 190 }, lineHeight: 1, filter: 'drop-shadow(0 20px 34px rgba(0,0,0,0.5))' }}
          >
            {companion?.avatar ?? '🌸'}
          </Typography>
        )}
      </Box>

      {/* 顶部信息条 */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ position: 'absolute', top: 12, left: 14, right: 14, flexWrap: 'wrap', rowGap: 0.75 }}
      >
        <Chip
          size="small"
          icon={<TheaterComedyRoundedIcon sx={{ fontSize: 15 }} />}
          label={activeScene.name}
          onClick={() => setSceneBarOpen((value) => !value)}
          sx={{ ...GLASS }}
        />
        <Tooltip title="按时间自动切换场景">
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, borderRadius: 999, ...GLASS }}>
            <Typography variant="caption">自动</Typography>
            <Switch
              size="small"
              checked={settings?.home?.autoScene ?? true}
              onChange={(event) => void patchSettings({ home: { ...(settings?.home as object), autoScene: event.target.checked } })}
            />
          </Stack>
        </Tooltip>
        {compact ? (
          <Stack direction="row" spacing={0.5}>
            <Chip size="small" icon={<GridViewRoundedIcon sx={{ fontSize: 15 }} />} label="导航" onClick={() => setPanel('nav')} sx={{ ...GLASS }} />
            <Chip size="small" icon={<HistoryRoundedIcon sx={{ fontSize: 15 }} />} label="最近" onClick={() => setPanel('recent')} sx={{ ...GLASS }} />
          </Stack>
        ) : null}
        <Box sx={{ flexGrow: 1 }} />
        {[
          { label: `论文 ${counts.paper}`, to: '/library/paper' },
          { label: `教材 ${counts.textbook}`, to: '/library/textbook' },
          { label: `剧本 ${counts.scripts}`, to: '/galgame' },
          { label: `存档 ${counts.saves}`, to: '/archive' }
        ].map((item) => (
          <Chip key={item.to} size="small" label={item.label} onClick={() => navigate(item.to)} clickable sx={{ ...GLASS }} />
        ))}
      </Stack>

      {/* 场景选择条 */}
      {sceneBarOpen ? (
        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{
            position: 'absolute',
            top: 56,
            left: 14,
            right: 14,
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'rgba(14,9,20,0.7)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.14)'
          }}
        >
          {scenes.map((scene) => (
            <Chip
              key={scene.id}
              size="small"
              label={scene.name}
              color={scene.id === activeScene.id ? 'primary' : 'default'}
              onDelete={scene.custom ? () => void removeCustomScene(scene.id) : undefined}
              onClick={() => void patchSettings({ home: { ...(settings?.home as object), sceneId: scene.id, autoScene: false } })}
              sx={scene.id === activeScene.id ? undefined : { color: '#fff', borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.1)' }}
            />
          ))}
          <Chip size="small" icon={<AddPhotoAlternateRoundedIcon sx={{ fontSize: 15 }} />} label="添加本地背景" onClick={() => void addCustomScene()} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.1)' }} />
          <Chip
            size="small"
            icon={<OpenInNewRoundedIcon sx={{ fontSize: 15 }} />}
            label="开源素材库"
            onClick={() => void api.app.openExternal(`${GITHUB_URL}/blob/main/docs/assets.md`)}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.1)' }}
          />
          <Chip
            size="small"
            label="恢复自动"
            onClick={() => void patchSettings({ home: { ...(settings?.home as object), sceneId: sceneForNow(scenes).id, autoScene: true } })}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.1)' }}
          />
          <IconButton size="small" sx={{ color: '#fff' }} onClick={() => setSceneBarOpen(false)}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : null}

      {/* 右侧浮层：最近 + 导航 */}
      {!compact ? (
        <Box
          sx={{
            position: 'absolute',
            top: 58,
            right: 14,
            height: 'calc(100% - 250px)',
            minHeight: 280,
            width: 336,
            display: 'grid',
            gridTemplateRows: 'minmax(0, 44%) minmax(0, 56%)',
            gap: 1.5,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ minHeight: 0, overflowY: 'auto', p: 1.5, borderRadius: 1.5, ...GLASS }} className="sig-scroll-thin">
            {recentPanel}
          </Box>
          <Box sx={{ minHeight: 0, overflowY: 'auto', p: 1.5, borderRadius: 1.5, ...GLASS }} className="sig-scroll-thin">
            {navPanel}
          </Box>
        </Box>
      ) : (
        <Drawer
          anchor="right"
          open={panel !== null}
          onClose={() => setPanel(null)}
          PaperProps={{ sx: { width: 320, bgcolor: 'rgba(16,10,22,0.94)', color: '#fff', backdropFilter: 'blur(16px)' } }}
        >
          <Box sx={{ p: 2 }}>{panel === 'nav' ? navPanel : recentPanel}</Box>
        </Drawer>
      )}

      {/* 底部对话框 */}
      <Box sx={{ position: 'absolute', left: 14, right: { xs: 14, lg: 366 }, bottom: 14 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 1.5,
            bgcolor: 'rgba(16,10,22,0.78)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.16)',
            boxShadow: '0 18px 40px -24px rgba(0,0,0,0.7)'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Chip size="small" color="primary" label={companion?.name ?? '伴学娘'} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              点击背景让她说句话 · 选中文字可问「精读」
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="打开发起剧本生成">
              <IconButton size="small" sx={{ color: '#fff' }} onClick={() => navigate('/galgame')}>
                <AutoStoriesRoundedIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ maxHeight: 96, overflowY: 'auto', mb: 1.25 }} className="sig-scroll-thin">
            {busy ? (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                正在思考…
              </Typography>
            ) : (
              <Box sx={{ color: '#fff', '& *': { color: '#fff' } }}>
                <MarkdownView compact>{bubble || '欢迎回来～今天想学点什么？'}</MarkdownView>
              </Box>
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
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }} />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 999,
                  bgcolor: 'rgba(255,255,255,0.92)',
                  '& input': { color: '#1c1220' }
                }
              }}
            />
            <Button
              variant="contained"
              onClick={() => void ask()}
              disabled={busy || !question.trim()}
              startIcon={<SendRoundedIcon />}
              sx={{ minWidth: 104, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              询问
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
