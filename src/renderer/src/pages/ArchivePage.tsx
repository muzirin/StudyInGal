import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatDateTime } from '../lib/format'
import type { ArchiveSave } from '@shared/types'

export function ArchivePage() {
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const [saves, setSaves] = useState<ArchiveSave[]>([])
  const [query, setQuery] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [kindFilter, setKindFilter] = useState<'all' | 'paper' | 'textbook'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'title'>('recent')

  const refresh = async (): Promise<void> => {
    setSaves(await api.archive.list())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const list = saves
      .filter((save) => (favoriteOnly ? save.favorite : true))
      .filter((save) => (kindFilter === 'all' ? true : save.kind === kindFilter))
      .filter((save) => (keyword ? save.title.toLowerCase().includes(keyword) : true))
    switch (sortBy) {
      case 'progress':
        return [...list].sort((a, b) => b.progress - a.progress)
      case 'title':
        return [...list].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
      default:
        return [...list].sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt))
    }
  }, [saves, favoriteOnly, kindFilter, query, sortBy])

  const stats = useMemo(
    () => ({
      total: saves.length,
      inProgress: saves.filter((save) => save.progress > 0 && save.progress < 1).length,
      finished: saves.filter((save) => save.progress >= 1).length,
      favorites: saves.filter((save) => save.favorite).length,
      remote: saves.filter((save) => save.storage !== 'local').length
    }),
    [saves]
  )

  return (
    <Stack spacing={2.5}>
      <Section
        title={`存档管理 · ${saves.length}`}
        subtitle="论文/教材转 Gal 的进度、标签、收藏与云盘位置"
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="搜索存档"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }}
              sx={{ width: 180 }}
            />
            <TextField select size="small" label="排序" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} sx={{ width: 130 }}>
              <MenuItem value="recent">最近游玩</MenuItem>
              <MenuItem value="progress">进度</MenuItem>
              <MenuItem value="title">标题</MenuItem>
            </TextField>
            <Button variant={favoriteOnly ? 'contained' : 'outlined'} startIcon={favoriteOnly ? <StarRoundedIcon /> : <StarBorderRoundedIcon />} onClick={() => setFavoriteOnly((value) => !value)}>
              收藏
            </Button>
          </Stack>
        }
      >
        <Stack direction="row" spacing={1} sx={{ px: 2, pt: 0.5, pb: 1 }} flexWrap="wrap" useFlexGap>
          {(
            [
              { id: 'all', label: '全部' },
              { id: 'paper', label: '论文' },
              { id: 'textbook', label: '教材' }
            ] as const
          ).map((item) => (
            <Chip
              key={item.id}
              size="small"
              label={item.label}
              clickable
              color={kindFilter === item.id ? 'primary' : 'default'}
              variant={kindFilter === item.id ? 'filled' : 'outlined'}
              onClick={() => setKindFilter(item.id)}
            />
          ))}
          <Box sx={{ flexGrow: 1 }} />
          <Chip size="small" variant="outlined" label={`共 ${stats.total}`} />
          <Chip size="small" variant="outlined" color="info" label={`进行中 ${stats.inProgress}`} />
          <Chip size="small" variant="outlined" color="success" label={`已完成 ${stats.finished}`} />
          <Chip size="small" variant="outlined" color="warning" label={`收藏 ${stats.favorites}`} />
          {stats.remote > 0 ? <Chip size="small" variant="outlined" label={`云盘 ${stats.remote}`} /> : null}
        </Stack>
        {filtered.length === 0 ? (
          <EmptyState title="暂无存档" description="在「Gal 工坊」生成剧本并开始游玩后，进度会自动保存到这里。" action={<Button variant="contained" onClick={() => navigate('/galgame')}>去生成剧本</Button>} />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2, p: 2 }}>
            {filtered.map((save) => (
              <Card key={save.id} elevation={0}>
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {save.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {save.kind === 'paper' ? '论文' : '教材'} · {formatDateTime(save.lastPlayedAt ?? save.updatedAt)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={async () => {
                        await api.archive.upsert({ id: save.id, favorite: !save.favorite })
                        await refresh()
                      }}
                    >
                      {save.favorite ? <StarRoundedIcon fontSize="small" color="warning" /> : <StarBorderRoundedIcon fontSize="small" />}
                    </IconButton>
                  </Stack>
                  <LinearProgress variant="determinate" value={save.progress * 100} sx={{ my: 1.5, borderRadius: 999 }} />
                  <Typography variant="caption" color="text.secondary">
                    进度 {Math.round(save.progress * 100)}% · {save.linesRead}/{save.totalLines} 行 · 存储：{save.storage}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button size="small" variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => navigate(`/galgame/${save.scriptId}`)} disabled={!save.scriptId}>
                      继续
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<DeleteRoundedIcon />}
                      onClick={async () => {
                        await api.archive.remove(save.id)
                        toast('info', '已删除存档记录（不会删除云端文件）')
                        await refresh()
                      }}
                    >
                      删除
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Section>
    </Stack>
  )
}
