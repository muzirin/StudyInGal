import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import Tooltip from '@mui/material/Tooltip'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatDateTime } from '../lib/format'
import type { Character, GalScript, LibraryNode } from '@shared/types'

export function GalgamePage() {
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)

  const [nodes, setNodes] = useState<(LibraryNode & { kindLabel: string })[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [scripts, setScripts] = useState<GalScript[]>([])
  const [sourceId, setSourceId] = useState('')
  const [characterId, setCharacterId] = useState('')
  const [depth, setDepth] = useState<'summary' | 'standard' | 'deep'>('standard')
  const [language, setLanguage] = useState<'zh' | 'en'>('zh')
  const [maxLines, setMaxLines] = useState(60)
  const [focus, setFocus] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'lines' | 'title'>('recent')

  const refresh = async (): Promise<void> => {
    const [papers, textbooks, characterList, scriptList] = await Promise.all([
      api.library.snapshot('paper').catch(() => null),
      api.library.snapshot('textbook').catch(() => null),
      api.characters.list().catch(() => []),
      api.gal.listScripts().catch(() => [])
    ])
    setNodes([
      ...(papers?.nodes ?? []).map((node) => ({ ...node, kindLabel: '论文' })),
      ...(textbooks?.nodes ?? []).map((node) => ({ ...node, kindLabel: '教材' }))
    ])
    setCharacters(characterList)
    setScripts(scriptList)
    setCharacterId((current) => current || characterList.find((item) => item.isCompanion)?.id || characterList[0]?.id || '')
  }

  useEffect(() => {
    void refresh()
  }, [])

  const selectedSource = useMemo(() => nodes.find((node) => node.id === sourceId) ?? null, [nodes, sourceId])

  const seedExamples = async (): Promise<void> => {
    const result = await api.gal.seedExamples(true)
    toast(result.added > 0 ? 'success' : 'info', result.added > 0 ? `已添加 ${result.added} 个示例剧本` : '示例剧本已存在')
    await refresh()
  }

  const sourceTitle = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) map.set(node.id, node.title)
    return map
  }, [nodes])

  const visibleScripts = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
      ? scripts.filter((script) => `${script.title} ${script.model ?? ''}`.toLowerCase().includes(keyword))
      : scripts
    switch (sortBy) {
      case 'lines':
        return [...filtered].sort((a, b) => b.lines.length - a.lines.length)
      case 'title':
        return [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
      default:
        return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt)
    }
  }, [scripts, query, sortBy])

  const generate = async (): Promise<void> => {    if (!sourceId || !characterId) {
      toast('warning', '请先选择文献和角色')
      return
    }
    setBusy(true)
    try {
      const script = await api.ai.generateScript({ sourceId, characterId, depth, language, maxLines, focus: focus || undefined })
      toast('success', `已生成 ${script.lines.length} 行剧本`)
      navigate(`/galgame/${script.id}`)
    } catch (error) {
      toast('error', `生成失败：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Section
        title="论文 / 教材 → Galgame 剧本"
        subtitle="调用你在「设置 → API 提供商」中为「剧本生产」路由配置的模型"
        action={
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Button size="small" variant="outlined" startIcon={<AutoStoriesRoundedIcon />} onClick={() => void seedExamples()}>
                添加示例剧本
              </Button>
              <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} disabled={busy} onClick={() => void generate()}>
                {busy ? '生成中…' : '生成剧本'}
              </Button>
            </Stack>
        }
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, p: 2 }}>
          <TextField select label="源文献" value={sourceId} onChange={(event) => setSourceId(event.target.value)} fullWidth>
            {nodes.length === 0 ? <MenuItem value="">（库中暂无文献，请先导入）</MenuItem> : null}
            {nodes.map((node) => (
              <MenuItem key={node.id} value={node.id}>
                [{node.kindLabel}] {node.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="角色" value={characterId} onChange={(event) => setCharacterId(event.target.value)} fullWidth>
            {characters.map((character) => (
              <MenuItem key={character.id} value={character.id}>
                {character.avatar} {character.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="解析深度" value={depth} onChange={(event) => setDepth(event.target.value as typeof depth)} fullWidth>
            <MenuItem value="summary">概述（快）</MenuItem>
            <MenuItem value="standard">标准</MenuItem>
            <MenuItem value="deep">深度（慢，消耗更多 token）</MenuItem>
          </TextField>
          <TextField select label="语言" value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} fullWidth>
            <MenuItem value="zh">中文</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </TextField>
          <TextField
            label="最大对话行数"
            type="number"
            value={maxLines}
            onChange={(event) => setMaxLines(Math.max(10, Math.min(400, Number(event.target.value) || 60)))}
            fullWidth
          />
          <TextField label="重点聚焦（可选）" value={focus} onChange={(event) => setFocus(event.target.value)} fullWidth placeholder="例如：第三章的算法复杂度" />
        </Box>
        {selectedSource ? (
          <Box sx={{ px: 2, pb: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={selectedSource.format.toUpperCase()} />
              <Chip size="small" label={selectedSource.kindLabel} />
              {selectedSource.format === 'folder' ? <Chip size="small" label={`${selectedSource.chapters.length} 章`} /> : null}
            </Stack>
          </Box>
        ) : null}
      </Section>

      {busy ? <Alert severity="info" icon={<CircularProgress size={16} />}>正在让伴学娘阅读并改写剧本，长论文可能需要一两分钟…</Alert> : null}

      <Section
        title={`已有剧本 · ${scripts.length}`}
        subtitle="点击继续游玩，进度会保存到存档"
        action={
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="搜索剧本"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ width: 160 }}
            />
            <TextField
              select
              size="small"
              label="排序"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              sx={{ width: 130 }}
            >
              <MenuItem value="recent">最近更新</MenuItem>
              <MenuItem value="lines">行数</MenuItem>
              <MenuItem value="title">标题</MenuItem>
            </TextField>
          </Stack>
        }
      >
        {scripts.length === 0 ? (
          <EmptyState
            title="还没有剧本"
            description="选择一篇论文或教材，生成第一段伴学 Galgame 吧。"
            action={
              <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => void generate()} disabled={!sourceId || busy}>
                立即生成
              </Button>
            }
          />
        ) : visibleScripts.length === 0 ? (
          <EmptyState title="没有匹配的剧本" description="换一个关键词试试。" />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2, p: 2 }}>
            {visibleScripts.map((script) => (
              <Card key={script.id} elevation={0}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} noWrap title={script.title}>
                    {script.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    源：
                    {script.sourceId === '__example__'
                      ? '内置示例'
                      : `${sourceTitle.get(script.sourceId) ?? '（已移除）'} · ${script.sourceKind === 'textbook' ? '教材' : '论文'}`}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
                    <Chip size="small" label={`${script.lines.length} 行`} />
                    {script.sourceId === '__example__' ? <Chip size="small" color="secondary" label="示例" /> : null}
                    <Chip size="small" variant="outlined" label={script.model ?? '未知模型'} />
                  </Stack>
                  <Typography variant="caption" color="text.disabled" display="block">
                    更新于 {formatDateTime(script.updatedAt)}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => navigate(`/galgame/${script.id}`)}>
                      游玩
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SaveRoundedIcon />}
                      onClick={async () => {
                        try {
                          await api.gal.exportSave(script.id, null)
                          toast('success', '存档已导出到本地 archive 目录')
                        } catch (error) {
                          toast('error', `导出失败：${(error as Error).message}`)
                        }
                      }}
                    >
                      导出存档
                    </Button>
                    <Tooltip title="导出为 Markdown（方便复习与分享）">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<FileDownloadRoundedIcon />}
                        onClick={async () => {
                          const target = await api.dialogs.saveFile({ defaultPath: `${script.title}.md` })
                          if (!target) return
                          const result = await api.gal.exportMarkdown(script.id, target)
                          toast('success', `已导出 ${result.lines} 行剧本`)
                        }}
                      >
                        Markdown
                      </Button>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={async () => {
                        await api.gal.deleteScript(script.id)
                        await refresh()
                      }}
                    >
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
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
