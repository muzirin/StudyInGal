import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { MarkdownView } from '../components/MarkdownView'
import { formatRelative } from '../lib/format'
import type { NoteEntry } from '@shared/types'

interface NodeMeta {
  id: string
  title: string
  kind: 'paper' | 'textbook'
}

const KIND_ICON = {
  ai: <SchoolRoundedIcon fontSize="small" />,
  user: <EditNoteRoundedIcon fontSize="small" />,
  quote: <FormatQuoteRoundedIcon fontSize="small" />
} as const

export function NotesPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const compact = useMediaQuery('(max-width: 1100px)')

  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [nodes, setNodes] = useState<NodeMeta[]>([])
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | NoteEntry['kind']>('all')
  const [activeNode, setActiveNode] = useState<string | 'all'>('all')

  const refresh = async (): Promise<void> => {
    const [noteList, papers, textbooks] = await Promise.all([
      api.notes.list().catch(() => []),
      api.library.snapshot('paper').catch(() => null),
      api.library.snapshot('textbook').catch(() => null)
    ])
    setNotes(noteList)
    setNodes([
      ...(papers?.nodes ?? []).map((node) => ({ id: node.id, title: node.title, kind: 'paper' as const })),
      ...(textbooks?.nodes ?? []).map((node) => ({ id: node.id, title: node.title, kind: 'textbook' as const }))
    ])
  }

  useEffect(() => {
    void refresh()
  }, [])

  const nodeMeta = useMemo(() => {
    const map = new Map<string, NodeMeta>()
    for (const node of nodes) map.set(node.id, node)
    return map
  }, [nodes])

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = notes
      .filter((note) => (kindFilter === 'all' ? true : note.kind === kindFilter))
      .filter((note) => (activeNode === 'all' ? true : note.nodeId === activeNode))
      .filter((note) => (keyword ? `${note.title} ${note.content} ${note.chapterTitle}`.toLowerCase().includes(keyword) : true))

    const byNode = new Map<string, NoteEntry[]>()
    for (const note of filtered) {
      if (!byNode.has(note.nodeId)) byNode.set(note.nodeId, [])
      byNode.get(note.nodeId)?.push(note)
    }
    return [...byNode.entries()]
      .map(([nodeId, entries]) => ({
        nodeId,
        title: nodeMeta.get(nodeId)?.title ?? '（已移除的文献）',
        kind: nodeMeta.get(nodeId)?.kind ?? null,
        entries: entries.sort((a, b) => b.updatedAt - a.updatedAt)
      }))
      .sort((a, b) => (b.entries[0]?.updatedAt ?? 0) - (a.entries[0]?.updatedAt ?? 0))
  }, [notes, query, kindFilter, activeNode, nodeMeta])

  const documents = useMemo(
    () => [...new Set(notes.map((note) => note.nodeId))].map((id) => ({ id, title: nodeMeta.get(id)?.title ?? '（已移除的文献）' })),
    [notes, nodeMeta]
  )

  const counts = useMemo(
    () => ({
      all: notes.length,
      ai: notes.filter((note) => note.kind === 'ai').length,
      user: notes.filter((note) => note.kind === 'user').length,
      quote: notes.filter((note) => note.kind === 'quote').length
    }),
    [notes]
  )

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '248px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
      {!compact ? (
        <Box
          sx={{
            position: 'sticky',
            top: 8,
            p: 1,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7),
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto'
          }}
          className="sig-scroll-thin"
        >
          <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ pl: 1.5, py: 1, display: 'block' }}>
            按文献
          </Typography>
          <List dense disablePadding>
            <ListItemButton selected={activeNode === 'all'} onClick={() => setActiveNode('all')} sx={{ borderRadius: 2.5, mb: 0.25 }}>
              <ListItemText primary={`全部文献（${counts.all}）`} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
            {documents.map((document) => (
              <ListItemButton
                key={document.id}
                selected={activeNode === document.id}
                onClick={() => setActiveNode(document.id)}
                sx={{ borderRadius: 2.5, mb: 0.25 }}
              >
                <ListItemText
                  primary={document.title}
                  primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ) : (
        <TextField
          select
          size="small"
          label="按文献筛选"
          value={activeNode}
          onChange={(event) => setActiveNode(event.target.value)}
        >
          <MenuItem value="all">全部文献（{counts.all}）</MenuItem>
          {documents.map((document) => (
            <MenuItem key={document.id} value={document.id}>
              {document.title}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Section
          title={`我的笔记 · ${notes.length}`}
          subtitle="精读笔记、随手笔记与原文引用都保存在本机 notes.json"
          action={
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadRoundedIcon />}
                disabled={notes.length === 0}
                onClick={async () => {
                  const target = await api.dialogs.saveFile({ defaultPath: 'study-in-gal-notes.md' })
                  if (!target) return
                  const result = await api.notes.export(activeNode === 'all' ? null : activeNode, target)
                  toast('success', `已导出 ${result.count} 条笔记`)
                }}
              >
                导出 Markdown
              </Button>
              <TextField
                size="small"
                placeholder="搜索笔记内容"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ width: 200 }}
              />
              <Stack direction="row" spacing={0.5}>
                {(
                  [
                    ['all', `全部 ${counts.all}`],
                    ['ai', `AI ${counts.ai}`],
                    ['user', `我 ${counts.user}`],
                    ['quote', `引用 ${counts.quote}`]
                  ] as ['all' | NoteEntry['kind'], string][]
                ).map(([id, label]) => (
                  <Chip
                    key={id}
                    size="small"
                    label={label}
                    clickable
                    color={kindFilter === id ? 'primary' : 'default'}
                    variant={kindFilter === id ? 'filled' : 'outlined'}
                    onClick={() => setKindFilter(id)}
                  />
                ))}
              </Stack>
            </Stack>
          }
        >
          {groups.length === 0 ? (
            <EmptyState
              title={notes.length === 0 ? '还没有笔记' : '没有匹配的笔记'}
              description="在阅读器里点击「精读本章」生成 AI 笔记，或选中文字后引用到黑板笔记。"
              action={
                <Button variant="contained" onClick={() => navigate('/library/paper')}>
                  去阅读文献
                </Button>
              }
            />
          ) : (
            <Stack spacing={2.5} sx={{ p: 2 }}>
              {groups.map((group) => (
                <Box key={group.nodeId}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                      {group.title}
                    </Typography>
                    <Chip size="small" variant="outlined" label={`${group.entries.length} 条`} />
                    <Box sx={{ flexGrow: 1 }} />
                    {group.kind ? (
                      <Button
                        size="small"
                        startIcon={<OpenInNewRoundedIcon />}
                        onClick={() => navigate(`/reader/${group.kind}/${group.nodeId}`)}
                      >
                        打开文献
                      </Button>
                    ) : null}
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                    {group.entries.map((note) => (
                      <Card key={note.id} elevation={0}>
                        <CardContent>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Chip
                              size="small"
                              icon={<Box sx={{ display: 'flex', '& svg': { fontSize: 14 } }}>{KIND_ICON[note.kind]}</Box>}
                              label={note.kind === 'ai' ? 'AI 精读' : note.kind === 'quote' ? '引用' : '笔记'}
                              sx={{ height: 20 }}
                            />
                            <Typography variant="caption" sx={{ flexGrow: 1, fontWeight: 600 }} noWrap>
                              {note.title}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {formatRelative(note.updatedAt)}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={async () => {
                                await api.notes.remove(note.id)
                                toast('info', '已删除笔记')
                                await refresh()
                              }}
                            >
                              <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Stack>
                          {note.chapterTitle ? (
                            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                              <FolderRoundedIcon sx={{ fontSize: 12, verticalAlign: '-2px', mr: 0.5 }} />
                              {note.chapterTitle}
                            </Typography>
                          ) : null}
                          <Box sx={{ mt: 1, maxHeight: 260, overflow: 'auto' }} className="sig-scroll-thin">
                            <MarkdownView compact>{note.content}</MarkdownView>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Section>
      </Stack>
    </Box>
  )
}
