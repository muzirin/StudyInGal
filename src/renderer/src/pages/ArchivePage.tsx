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

  const refresh = async (): Promise<void> => {
    setSaves(await api.archive.list())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(
    () =>
      saves
        .filter((save) => (favoriteOnly ? save.favorite : true))
        .filter((save) => (query ? save.title.toLowerCase().includes(query.toLowerCase()) : true)),
    [saves, favoriteOnly, query]
  )

  return (
    <Stack spacing={2.5}>
      <Section
        title={`存档管理 · ${saves.length}`}
        subtitle="论文/教材转 Gal 的进度、标签、收藏与云盘位置"
        action={
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="搜索存档"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }}
            />
            <Button variant={favoriteOnly ? 'contained' : 'outlined'} startIcon={favoriteOnly ? <StarRoundedIcon /> : <StarBorderRoundedIcon />} onClick={() => setFavoriteOnly((value) => !value)}>
              收藏
            </Button>
          </Stack>
        }
      >
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
