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
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { Live2DStage } from '../components/Live2DStage'
import { MarkdownView } from '../components/MarkdownView'
import { EmptyState } from '../components/Section'
import { dayBucket, formatRelative } from '../lib/format'
import { NAV_GROUPS, MODULES } from '../modules/registry'
import type { Character, HistoryEntry, HistoryKind } from '@shared/types'

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

const BUCKET_ORDER = ['今天', '昨天', '本周', '更早'] as const

/** 点击立绘时说的随机台词（本地生成，不消耗 API 额度） */
const QUIPS = [
  '今天也一起加油吧～先从最容易的一小节开始！',
  '要不要试试把这篇论文变成 Galgame？我会讲得很有趣哦。',
  '别忘了番茄钟，专注 25 分钟就休息一下。',
  '黑板笔记写多了就会变成自己的知识，记得「精读本章」。',
  '课表上的下一节课准备好了吗？我可以帮你复习要点。',
  '累了就放点白噪音，雨声最适合看书了。',
  '有不懂的地方随时选中间问我，我一直都在。'
]

export function HomePage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
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
  const [counts, setCounts] = useState({ paper: 0, textbook: 0, saves: 0 })

  const companion = useMemo(
    () =>
      characters.find((item) => item.id === settings?.companion.activeCharacterId) ??
      characters.find((item) => item.isCompanion) ??
      characters[0] ??
      null,
    [characters, settings?.companion.activeCharacterId]
  )

  const refreshHistory = useCallback(async () => {
    setHistory(await api.history.list(60).catch(() => []))
  }, [])

  useEffect(() => {
    void (async () => {
      const [characterList, saves, papers, textbooks] = await Promise.all([
        api.characters.list().catch(() => []),
        api.archive.list().catch(() => []),
        api.library.snapshot('paper').catch(() => null),
        api.library.snapshot('textbook').catch(() => null)
      ])
      setCharacters(characterList)
      setCounts({
        paper: papers?.nodes.length ?? 0,
        textbook: textbooks?.nodes.length ?? 0,
        saves: saves.length
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
      toast('warning', '对话失败，请检查「设置 → API 提供商」')
    } finally {
      setBusy(false)
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

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(340px, 460px)' }, gap: 2.5 }}>
      {/* ------------------------------ 左：立绘舞台 ------------------------------ */}
      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            minHeight: { xs: 400, md: 430 },
            background: `radial-gradient(120% 90% at 78% 8%, ${alpha(theme.palette.primary.main, 0.3)} 0%, transparent 58%),
              radial-gradient(90% 80% at 8% 92%, ${alpha(theme.palette.secondary.main, 0.24)} 0%, transparent 62%),
              linear-gradient(160deg, var(--sig-surface-variant) 0%, transparent 70%)`
          }}
        >
          <Box className="sig-float-slow" sx={{ position: 'absolute', inset: 0 }}>
            <Box
              sx={{
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: '50%',
                top: -60,
                right: -40,
                background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.35)}, transparent 70%)`,
                filter: 'blur(8px)'
              }}
            />
          </Box>

          <Box
            sx={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 260px' },
              alignItems: 'center',
              gap: 2,
              p: { xs: 2.5, md: 3 },
              minHeight: { xs: 400, md: 430 }
            }}
          >
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" color="primary" label={companion?.name ?? '伴学娘'} />
                <Chip size="small" variant="outlined" label="今天也要加油" />
              </Stack>

              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.background.paper, 0.86),
                  backdropFilter: 'blur(10px)',
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: 132,
                  maxHeight: 260,
                  overflowY: 'auto'
                }}
                className="sig-scroll-thin"
              >
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
                    sx: { borderRadius: 999, bgcolor: alpha(theme.palette.background.paper, 0.9) }
                  }}
                />
                <IconButton color="primary" onClick={() => void ask()} disabled={busy || !question.trim()}>
                  <SendRoundedIcon />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`论文 ${counts.paper}`} onClick={() => navigate('/library/paper')} clickable />
                <Chip size="small" variant="outlined" label={`教材 ${counts.textbook}`} onClick={() => navigate('/library/textbook')} clickable />
                <Chip size="small" variant="outlined" label={`存档 ${counts.saves}`} onClick={() => navigate('/archive')} clickable />
              </Stack>
            </Stack>

            <Box
              onClick={() => setBubble(QUIPS[Math.floor(Math.random() * QUIPS.length)])}
              title="点击让伴学娘说句话"
              sx={{ justifySelf: 'center', alignSelf: 'end', width: '100%', maxWidth: 260, cursor: 'pointer' }}
            >
              <Live2DStage character={companion} height={320} bare />
            </Box>
          </Box>
        </Box>

        {/* ------------------------------ 历史记录 ------------------------------ */}
        <Box
          sx={{
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7),
            overflow: 'hidden'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.5 }}>
            <HistoryRoundedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              历史记录
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
                <EmptyState
                  title="还没有学习记录"
                  description="打开论文、教材或游玩 Galgame 后，这里会出现最近记录，方便一键继续。"
                  action={
                    <Button variant="contained" onClick={() => navigate('/library/paper')}>
                      去导入论文
                    </Button>
                  }
                />
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
                                sx={{ borderRadius: 2.5, mb: 0.25, '&:hover .delete-history': { opacity: 1 } }}
                              >
                                <ListItemIcon sx={{ minWidth: 34, color: 'primary.main' }}>
                                  {HISTORY_ICON[entry.kind]}
                                </ListItemIcon>
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
      </Stack>

      {/* ------------------------------ 右：导航 ------------------------------ */}
      <Box
        sx={{
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.7),
          overflow: 'hidden',
          alignSelf: 'start',
          position: { lg: 'sticky' },
          top: { lg: 8 },
          maxHeight: { lg: 'calc(100vh - 120px)' },
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, py: 1.5 }}>
          <GridViewRoundedIcon fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
            导航
          </Typography>
          <Chip size="small" label="Ctrl+K 搜索" variant="outlined" />
          <IconButton size="small" onClick={() => setNavOpen((value) => !value)}>
            <ExpandMoreRoundedIcon
              fontSize="small"
              sx={{ transform: navOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 180ms ease' }}
            />
          </IconButton>
        </Stack>
        <Collapse in={navOpen} timeout={220} unmountOnExit>
          <Divider />
          <Box sx={{ p: 2, overflowY: 'auto' }} className="sig-scroll-thin">
            <Stack spacing={1.5}>
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
                        borderRadius: 3,
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
                                borderRadius: 2.5,
                                cursor: 'pointer',
                                transition: 'background-color 140ms ease, transform 140ms ease',
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1), transform: 'translateX(2px)' }
                              }}
                            >
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 2,
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
  )
}
