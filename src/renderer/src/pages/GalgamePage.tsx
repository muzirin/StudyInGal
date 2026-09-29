import { useEffect, useMemo, useRef, useState } from 'react'
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
import QuizRoundedIcon from '@mui/icons-material/QuizRounded'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatDateTime } from '../lib/format'
import { splitSections, type DocumentSection } from '../lib/sections'
import { pickChapter } from '@mainlib/excerpt'
import type { ChapterRef, Character, GalExcerpt, GalScript, LibraryNode } from '@shared/types'

/** 章节选择里「整本合并」的哨兵值 */
const WHOLE_BOOK = '__all__'

export function GalgamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
  const [chapters, setChapters] = useState<ChapterRef[]>([])
  const [chapterPath, setChapterPath] = useState('')
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [sectionIndex, setSectionIndex] = useState(-1)
  const [sourceChars, setSourceChars] = useState(0)
  /** 不在目录列表里的所选章节的展示名（例如阅读器带过来的标题） */
  const [excerptTitle, setExcerptTitle] = useState('')
  /** 从「生成 Gal」按钮带过来的章节，等章节列表加载后再选中 */
  const pendingChapter = useRef('')
  const pendingChapterTitle = useRef('')

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
    const source = searchParams.get('source')
    const chapter = searchParams.get('chapter')
    const chapterTitle = searchParams.get('chapterTitle')
    if (source) setSourceId(source)
    if (chapter) {
      pendingChapter.current = chapter
      pendingChapterTitle.current = chapterTitle ?? ''
    }
    void refresh()
  }, [searchParams])

  const selectedSource = useMemo(() => nodes.find((node) => node.id === sourceId) ?? null, [nodes, sourceId])

  // 选中源文献后准备「取材单位」：教材分册按章节文件，单文件长文按标题切小节
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const chapterPathRef = useRef(chapterPath)
  chapterPathRef.current = chapterPath
  useEffect(() => {
    const source = nodesRef.current.find((node) => node.id === sourceId) ?? null
    if (!source) {
      setChapters([])
      setChapterPath('')
      setSections([])
      setSectionIndex(-1)
      setSourceChars(0)
      return
    }
    let cancelled = false
    const load = async (): Promise<void> => {
      if (source.format === 'folder') {
        const list = await api.library.chapters(source.id).catch(() => [] as ChapterRef[])
        if (cancelled) return
        setChapters(list)
        setSections([])
        setSectionIndex(-1)
        setSourceChars(0)
        // 优先用阅读器带过来的章节；其次是用户在当前源上已经选过的章节。
        // 命中目录就沿用目录里的标题，没命中也要保留这条路径（旧索引/刚改名），
        // 仅当完全没有候选时才默认第一章。
        const pending = pendingChapter.current
        const pendingTitle = pendingChapterTitle.current
        pendingChapter.current = ''
        pendingChapterTitle.current = ''
        const candidate = pending || chapterPathRef.current
        const matched = pickChapter(list, candidate)
        if (matched) {
          setChapterPath(matched.path)
          setExcerptTitle('')
          return
        }
        if (candidate && candidate !== WHOLE_BOOK) {
          setChapterPath(candidate)
          setExcerptTitle(pendingTitle)
          if (!pending) {
            toast('warning', '上次选的章节已不在目录中，生成时会按原路径直接读取（若文件被移动会提示重新选择）')
          }
          return
        }
        setChapterPath(list[0]?.path ?? WHOLE_BOOK)
        setExcerptTitle('')
        return
      }
      setChapters([])
      setChapterPath('')
      const document = await api.library.read(source.id).catch(() => null)
      if (cancelled) return
      const text = document?.text ?? ''
      const split = splitSections(text)
      setSourceChars(text.length)
      setSections(split)
      // 长文默认只取第一节，避免一次把整本书丢给模型
      setSectionIndex(split.length > 0 ? 0 : -1)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sourceId, nodes.length])

  /** 本次生成实际取材的范围：分册教材给章节路径，单文件给字符区间 */
  const excerpt = useMemo<GalExcerpt | undefined>(() => {
    if (!selectedSource) return undefined
    if (selectedSource.format === 'folder') {
      // 只要用户选了具体章节，就把这条路径原样带上；即使它不在当前目录列表里
      // （列表可能是旧索引，比如文件被改名/阅读器带来的是最新路径），也不能悄悄改成整本合并。
      if (!chapterPath || chapterPath === WHOLE_BOOK) return undefined
      const chapter = pickChapter(chapters, chapterPath)
      return { path: chapterPath, title: chapter?.title ?? excerptTitle }
    }
    const section = sectionIndex >= 0 ? sections[sectionIndex] : undefined
    return section ? { start: section.start, end: section.end, title: section.title } : undefined
  }, [selectedSource, chapters, chapterPath, sections, sectionIndex, excerptTitle])

  const excerptHint = useMemo(() => {
    if (!selectedSource) return ''
    if (selectedSource.format === 'folder') {
      const chapter = pickChapter(chapters, chapterPath)
      if (chapter) return `本次只生成「${chapter.title}」，其余章节不会被投喂给模型。`
      if (chapterPath && chapterPath !== WHOLE_BOOK) {
        return `本次只生成所选章节「${excerptTitle || chapterPath}」；它不在当前目录列表里（可能刚改名或来自阅读器），生成时会按这条路径直接读取。`
      }
      return chapters.length > 0 ? '本次会合并整本教材（内容很多，生成慢且容易只讲到前几章）。' : ''
    }
    const section = sectionIndex >= 0 ? sections[sectionIndex] : undefined
    if (section) {
      return `原文约 ${sourceChars.toLocaleString('zh-Hans-CN')} 字，已超过单次上限，默认只取「${section.title}」这一节。`
    }
    return sections.length > 0 ? `本次取全文（约 ${sourceChars.toLocaleString('zh-Hans-CN')} 字），超出部分会被截断。` : ''
  }, [selectedSource, chapters, chapterPath, sections, sectionIndex, sourceChars, excerptTitle])

  /** 不在目录列表里的所选章节的展示名（来自阅读器标题或文件名） */
  const unmatchedChapterLabel = useMemo(
    () => excerptTitle || chapterPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || '所选章节',
    [excerptTitle, chapterPath]
  )

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

  const generate = async (): Promise<void> => {
    if (!sourceId || !characterId) {
      toast('warning', '请先选择文献和角色')
      return
    }
    setBusy(true)
    try {
      const script = await api.ai.generateScript({ sourceId, characterId, depth, language, maxLines, focus: focus || undefined, excerpt })
      toast('success', excerpt?.title ? `已生成《${excerpt.title}》的 ${script.lines.length} 行剧本` : `已生成 ${script.lines.length} 行剧本`)
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
              <Button
                variant="contained"
                startIcon={<AutoAwesomeRoundedIcon />}
                disabled={busy || characters.length === 0}
                onClick={() => void generate()}
              >
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
          {selectedSource?.format === 'folder' && (chapters.length > 0 || (chapterPath && chapterPath !== WHOLE_BOOK)) ? (
            <TextField
              select
              label="取材章节"
              value={chapterPath}
              onChange={(event) => {
                setChapterPath(event.target.value)
                setExcerptTitle('')
              }}
              fullWidth
            >
              {chapters.map((chapter, index) => (
                <MenuItem key={chapter.path} value={chapter.path}>
                  {index + 1}. {chapter.title}
                </MenuItem>
              ))}
              {chapterPath && chapterPath !== WHOLE_BOOK && !pickChapter(chapters, chapterPath) ? (
                <MenuItem value={chapterPath}>{unmatchedChapterLabel}（不在目录中，将按此路径读取）</MenuItem>
              ) : null}
              <MenuItem value={WHOLE_BOOK}>整本合并（内容多，不推荐）</MenuItem>
            </TextField>
          ) : null}
          {selectedSource && selectedSource.format !== 'folder' && sections.length > 0 ? (
            <TextField
              select
              label="取材小节"
              value={sectionIndex}
              onChange={(event) => setSectionIndex(Number(event.target.value))}
              fullWidth
            >
              {sections.map((section) => (
                <MenuItem key={section.index} value={section.index}>
                  {section.title}（约 {(section.end - section.start).toLocaleString('zh-Hans-CN')} 字）
                </MenuItem>
              ))}
              <MenuItem value={-1}>全文（约 {sourceChars.toLocaleString('zh-Hans-CN')} 字，超出会被截断）</MenuItem>
            </TextField>
          ) : null}
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
        {excerptHint ? (
          <Box sx={{ px: 2, pb: 2 }}>
            <Alert severity="info" icon={false}>
              {excerptHint}
            </Alert>
          </Box>
        ) : null}
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

      {characters.length === 0 ? (
        <Alert
          severity="info"
          action={
            <Button size="small" color="inherit" onClick={() => navigate('/characters')}>
              去创建角色
            </Button>
          }
        >
          还没有任何角色，剧本需要至少一个角色来出演。先到「角色管理」创建一个吧。
        </Alert>
      ) : null}

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
                      : `${sourceTitle.get(script.sourceId) ?? '（已移除）'} · ${script.sourceKind === 'textbook' ? '教材' : '论文'}${
                          script.sourceChapter ? ` · ${script.sourceChapter}` : ''
                        }`}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
                    <Chip size="small" label={`${script.lines.length} 行`} />
                    <Chip
                      size="small"
                      color={(script.questions ?? []).length > 0 ? 'primary' : 'default'}
                      variant={(script.questions ?? []).length > 0 ? 'filled' : 'outlined'}
                      label={(script.questions ?? []).length > 0 ? `题 ${(script.questions ?? []).length}` : '无题目'}
                    />
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
                    {(script.questions ?? []).length === 0 ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<QuizRoundedIcon />}
                        onClick={async () => {
                          try {
                            const result = await api.quiz.generateForScript(script.id, 6)
                            toast('success', `已生成 ${result.questions.length} 道题并保存到剧本`)
                            await refresh()
                          } catch (error) {
                            toast('error', `出题失败：${(error as Error).message}`)
                          }
                        }}
                      >
                        出题
                      </Button>
                    ) : null}
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
