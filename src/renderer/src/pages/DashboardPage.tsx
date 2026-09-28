import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Chip, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import EventRoundedIcon from '@mui/icons-material/EventRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MarkdownView } from '../components/MarkdownView'
import { EmptyState, MetricCard, Section } from '../components/Section'
import { Live2DStage } from '../components/Live2DStage'
import type { ArchiveSave, Character, LibrarySnapshot, ScheduleEvent } from '@shared/types'

export function DashboardPage() {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const toast = useAppStore((state) => state.toast)

  const [papers, setPapers] = useState<LibrarySnapshot | null>(null)
  const [textbooks, setTextbooks] = useState<LibrarySnapshot | null>(null)
  const [saves, setSaves] = useState<ArchiveSave[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [greeting, setGreeting] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const [paperSnapshot, textbookSnapshot, saveList, eventList, characterList] = await Promise.all([
        api.library.snapshot('paper').catch(() => null),
        api.library.snapshot('textbook').catch(() => null),
        api.archive.list().catch(() => []),
        api.schedule.list().catch(() => []),
        api.characters.list().catch(() => [])
      ])
      setPapers(paperSnapshot)
      setTextbooks(textbookSnapshot)
      setSaves(saveList)
      setEvents(eventList)
      setCharacters(characterList)
    })()
  }, [])

  const companion = useMemo(
    () =>
      characters.find((item) => item.id === settings?.companion.activeCharacterId) ??
      characters.find((item) => item.isCompanion) ??
      characters[0] ??
      null,
    [characters, settings?.companion.activeCharacterId]
  )

  const upcoming = useMemo(
    () => events.filter((event) => (event.end ?? event.start) >= Date.now() - 3600_000).slice(0, 6),
    [events]
  )

  const greet = async (): Promise<void> => {
    setBusy(true)
    try {
      const now = new Date()
      const response = await api.ai.chat({
        capability: 'chat',
        messages: [
          { role: 'system', content: companion?.systemPrompt ?? '你是伴学娘。' },
          {
            role: 'user',
            content: `现在是 ${now.toLocaleString('zh-CN')}。我有 ${papers?.nodes.length ?? 0} 篇论文、${
              textbooks?.nodes.length ?? 0
            } 本教材、${saves.length} 个存档。请用一两句话跟我打个招呼。`
          }
        ]
      })
      setGreeting(response.content)
    } catch (error) {
      toast('warning', `伴学娘暂时没能回应：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, gap: 3 }}>
        <Section
          title={`${companion?.name ?? '伴学娘'} 的问候`}
          subtitle="点击按钮让角色结合你的学习数据打招呼"
          action={
            <Button size="small" variant="contained" disabled={busy} onClick={() => void greet()}>
              {busy ? '生成中…' : '打招呼'}
            </Button>
          }
        >
          <Stack spacing={2}>
            <Live2DStage character={companion} height={230} showControls={false} />
            {greeting ? (
              <MarkdownView compact>{greeting}</MarkdownView>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {companion?.greeting ?? '先到「角色管理」创建一位伴学娘吧～'}
              </Typography>
            )}
          </Stack>
        </Section>

        <Section
          title="近期安排"
          subtitle="课表 / 考试 / 待办"
          action={
            <Button size="small" onClick={() => navigate('/tools')} startIcon={<EventRoundedIcon fontSize="small" />}>
              管理
            </Button>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState
              title="暂无安排"
              description="在「学习工具 → 日程课表」里添加课程、考试或计划。"
              action={
                <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={() => navigate('/tools')}>
                  添加安排
                </Button>
              }
            />
          ) : (
            <List dense>
              {upcoming.map((event) => (
                <ListItem
                  key={event.id}
                  disableGutters
                  secondaryAction={
                    <Chip
                      size="small"
                      label={new Date(event.start).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                    />
                  }
                >
                  <ListItemText
                    primary={event.title}
                    secondary={`${new Date(event.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}${
                      event.location ? ` · ${event.location}` : ''
                    }`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <MetricCard
          label="论文库"
          value={papers?.nodes.length ?? 0}
          hint="LaTeX / MD / PDF / Doc"
          icon={<ScienceRoundedIcon />}
          onClick={() => navigate('/library/paper')}
        />
        <MetricCard
          label="教材库"
          value={textbooks?.nodes.length ?? 0}
          hint="支持分册合并与 OCR"
          icon={<MenuBookRoundedIcon />}
          onClick={() => navigate('/library/textbook')}
        />
        <MetricCard
          label="Gal 存档"
          value={saves.length}
          hint={`${saves.filter((save) => save.favorite).length} 个收藏`}
          icon={<SaveRoundedIcon />}
          onClick={() => navigate('/archive')}
        />
        <MetricCard
          label="进行中的剧本"
          value={saves.filter((save) => save.progress > 0 && save.progress < 1).length}
          hint="继续上次的学习"
          icon={<AutoStoriesRoundedIcon />}
          onClick={() => navigate('/galgame')}
        />
      </Box>

      <Section title="快速开始" subtitle="论文/教材 → Galgame 剧本 → 边玩边学">
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/library/paper')}>
            导入论文
          </Button>
          <Button variant="outlined" startIcon={<MenuBookRoundedIcon />} onClick={() => navigate('/library/textbook')}>
            导入教材
          </Button>
          <Button variant="outlined" startIcon={<PlayArrowRoundedIcon />} onClick={() => navigate('/galgame')}>
            生成 Galgame
          </Button>
          <Button variant="outlined" startIcon={<AutoStoriesRoundedIcon />} onClick={() => navigate('/companion')}>
            和伴学娘聊聊
          </Button>
        </Stack>
      </Section>
    </Stack>
  )
}
