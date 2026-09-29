import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import QuizRoundedIcon from '@mui/icons-material/QuizRounded'
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded'
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MarkdownView } from '../components/MarkdownView'
import { QuizDialog } from '../components/QuizDialog'
import { DocumentRenderedView } from '../components/DocumentPreview'
import { sectionsFromMarkdown } from '../lib/markdown'
import type { ChapterRef, DocumentContent, LibraryKind, NoteEntry } from '@shared/types'

export function ReaderPage() {
  const theme = useTheme()
  const { nodeId = '' } = useParams<{ kind?: string; nodeId: string }>()
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const openAsk = useAppStore((state) => state.openAsk)
  const setCrumb = useAppStore((state) => state.setCrumb)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const settings = useAppStore((state) => state.settings)
  const compact = useMediaQuery('(max-width: 1200px)')

  const [document, setDocument] = useState<DocumentContent | null>(null)
  const [chapters, setChapters] = useState<ChapterRef[]>([])
  const [sections, setSections] = useState<ReturnType<typeof sectionsFromMarkdown>>([])
  const [activeChapter, setActiveChapter] = useState<string>('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<LibraryKind>('paper')
  const [mode, setMode] = useState<'rendered' | 'source'>('rendered')
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [tocOpen, setTocOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)
  const [explaining, setExplaining] = useState(false)
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [quizOpen, setQuizOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const saveTimer = useRef<number | null>(null)
  const lastSaved = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const content = await api.library.read(nodeId)
      const chapterList = await api.library.chapters(nodeId).catch(() => [] as ChapterRef[])
      setDocument(content)
      setChapters(chapterList)

      const [papers, textbooks] = await Promise.all([
        api.library.snapshot('paper').catch(() => null),
        api.library.snapshot('textbook').catch(() => null)
      ])
      const found = [...(papers?.nodes ?? []), ...(textbooks?.nodes ?? [])].find((node) => node.id === nodeId)
      setTitle(found?.title ?? '文献')
      setKind(found?.kind ?? 'paper')
      setCrumb({
        label: found?.title ?? '文献',
        hint: `${content.format.toUpperCase()} · ${found?.kind === 'textbook' ? '教材' : '论文'}`
      })

      if (content.format === 'folder') {
        const merged = await api.library.merge(nodeId)
        setSections(
          merged.chapters.map((chapter) => ({
            title: chapter.title,
            anchor: chapter.path,
            content: chapter.content
          }))
        )
        setActiveChapter((prev) => prev || merged.chapters[0]?.path || '')
      } else {
        setSections(sectionsFromMarkdown(content.text))
        setActiveChapter('')
      }

      setNotes(await api.notes.list(nodeId).catch(() => []))
      await api.library.update(found?.kind ?? 'paper', nodeId, { lastOpenedAt: Date.now() }).catch(() => undefined)
    } catch (error) {
      toast('error', `打开失败：${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [nodeId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const activeSection = useMemo(() => {
    if (document?.format === 'folder') {
      return sections.find((section) => section.anchor === activeChapter) ?? sections[0] ?? null
    }
    return null
  }, [document?.format, sections, activeChapter])

  const readableText = useMemo(() => {
    if (activeSection) return activeSection.content
    return document?.text ?? ''
  }, [activeSection, document?.text])

  /** PDF/DOC/DOCX 这类二进制文档：渲染视图展示原始排版，文本视图展示抽取结果 */
  const isBinaryDocument =
    document?.format === 'pdf' || document?.format === 'docx' || document?.format === 'doc'

  // 记录阅读进度：滚动容器是 AppShell 的 main，节流后写回库索引
  useEffect(() => {
    const scroller = contentRef.current?.closest('main') as HTMLElement | null
    if (!scroller) return
    const persist = (value: number): void => {
      if (Math.abs(value - lastSaved.current) < 0.02) return
      lastSaved.current = value
      void api.library.update(kind, nodeId, { readingProgress: value }).catch(() => undefined)
    }
    const onScroll = (): void => {
      if (saveTimer.current) return
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null
        const max = scroller.scrollHeight - scroller.clientHeight
        const ratio = max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0
        const chapterRatio =
          document?.format === 'folder' && sections.length > 1
            ? (sections.findIndex((section) => section.anchor === activeChapter) + 1) / sections.length
            : 0
        persist(Math.max(ratio, chapterRatio))
      }, 800)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [kind, nodeId, document?.format, sections, activeChapter])

  const wordCount = useMemo(() => readableText.replace(/\s+/g, '').length, [readableText])

  const captureSelection = (): void => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (!text || text.length < 2 || !contentRef.current) {
      setSelection(null)
      return
    }
    if (!contentRef.current.contains(sel?.anchorNode ?? null)) {
      setSelection(null)
      return
    }
    const rect = sel?.getRangeAt(0).getBoundingClientRect()
    if (!rect) return
    setSelection({ text, x: rect.left + rect.width / 2, y: rect.top })
  }

  const addNote = async (input: { kind: NoteEntry['kind']; title: string; content: string }): Promise<void> => {
    const saved = await api.notes.upsert({
      nodeId,
      chapterPath: activeSection?.anchor ?? '',
      chapterTitle: activeSection?.title ?? title,
      kind: input.kind,
      title: input.title,
      content: input.content
    })
    setNotes((prev) => [saved, ...prev])
  }

  const explainChapter = async (): Promise<void> => {
    if (!readableText.trim()) {
      toast('warning', '当前章节没有可讲解的文本')
      return
    }
    setExplaining(true)
    try {
      const response = await api.ai.chat({
        capability: 'chat',
        messages: [
          {
            role: 'system',
            content: [
              '你是一位擅长精读的助教。请用中文输出一份「黑板笔记」，结构固定为：',
              '1) 一句话主旨；2) 3-6 条要点；3) 关键公式/概念直觉解释；4) 2-3 个常见误区；5) 自测问题。',
              '使用 Markdown，小标题用 ##，要点用无序列表，公式用 $...$。不要复述原文，要提炼。'
            ].join('\n')
          },
          {
            role: 'user',
            content: `文献：《${title}》\n章节：${activeSection?.title ?? '全文'}\n\n${readableText.slice(0, 14000)}`
          }
        ]
      })
      await addNote({ kind: 'ai', title: `精读：${activeSection?.title ?? title}`, content: response.content })
      toast('success', '已生成精读笔记')
      setNotesOpen(true)
    } catch (error) {
      toast('error', `精读失败：${(error as Error).message}`)
    } finally {
      setExplaining(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const hasToc = sections.length > 1

  return (
    <Stack spacing={2} sx={{ minHeight: '100%' }}>
      {/* 顶部工具条 */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={700} noWrap title={title}>
                {title}
              </Typography>
              <Chip size="small" label={document?.format.toUpperCase() ?? ''} />
              <Chip size="small" variant="outlined" label={kind === 'paper' ? '论文' : '教材'} />
              <Chip size="small" variant="outlined" label={`${sections.length} 节`} />
              <Typography variant="caption" color="text.disabled">
                {wordCount} 字
              </Typography>
            </Stack>
            {activeSection ? (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                当前：{activeSection.title}
              </Typography>
            ) : null}
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {hasToc && compact ? (
              <Button size="small" startIcon={<ListAltRoundedIcon />} onClick={() => setTocOpen(true)}>
                目录
              </Button>
            ) : null}
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_event, value) => value && setMode(value)}>
              <ToggleButton value="rendered">渲染</ToggleButton>
              <ToggleButton value="source">{isBinaryDocument ? '文本' : '源码'}</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={0} alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 999, px: 0.5 }}>
              <Tooltip title="缩小字号">
                <IconButton
                  size="small"
                  onClick={() => void patchSettings({ editor: { ...(settings?.editor as object), fontSize: Math.max(11, (settings?.editor.fontSize ?? 15) - 1) } })}
                >
                  <RemoveRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" sx={{ minWidth: 26, textAlign: 'center' }}>
                {settings?.editor.fontSize ?? 15}
              </Typography>
              <Tooltip title="放大字号">
                <IconButton
                  size="small"
                  onClick={() => void patchSettings({ editor: { ...(settings?.editor as object), fontSize: Math.min(28, (settings?.editor.fontSize ?? 15) + 1) } })}
                >
                  <AddRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
            <Tooltip title="让 AI 生成本章黑板笔记">
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={explaining ? <CircularProgress size={14} /> : <SchoolRoundedIcon />}
                  disabled={explaining}
                  onClick={() => void explainChapter()}
                >
                  精读本章
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="根据本章内容出题自测">
              <Button size="small" variant="outlined" startIcon={<QuizRoundedIcon />} onClick={() => setQuizOpen(true)}>
                出题
              </Button>
            </Tooltip>
            <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => navigate(`/editor/${kind}/${nodeId}`)}>
              编辑
            </Button>
            <Button
              size="small"
              startIcon={<OpenInNewRoundedIcon />}
              onClick={async () => {
                const [papers, textbooks] = await Promise.all([
                  api.library.snapshot('paper').catch(() => null),
                  api.library.snapshot('textbook').catch(() => null)
                ])
                const node = [...(papers?.nodes ?? []), ...(textbooks?.nodes ?? [])].find((item) => item.id === nodeId)
                if (node) await api.app.openPath(node.path)
              }}
            >
              外部打开
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<HelpOutlineRoundedIcon />}
              onClick={() => openAsk({ sourceId: nodeId, title, selection: selection?.text })}
            >
              询问
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoStoriesRoundedIcon />}
              onClick={() => {
                const params = new URLSearchParams({ source: nodeId })
                // 分册教材把当前章节一起带过去，Gal 工坊只会取材这一章
                if (document?.format === 'folder' && activeSection?.anchor) {
                  params.set('chapter', activeSection.anchor)
                  params.set('chapterTitle', activeSection.title)
                }
                navigate(`/galgame?${params.toString()}`)
              }}
            >
              生成 Gal
            </Button>
            <Tooltip title={notesOpen ? '收起黑板笔记' : '展开黑板笔记'}>
              <IconButton size="small" onClick={() => setNotesOpen((value) => !value)}>
                <StickyNote2RoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {document?.format === 'folder' ? (
        <Alert severity="info" icon={false}>
          分册教材自动合并视图（只读，不改动磁盘原始章节文件）。左侧目录可逐章切换。
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: `${hasToc && tocOpen && !compact ? '240px ' : ''}minmax(0, 1fr)${
              notesOpen && !compact ? ' minmax(300px, 360px)' : ''
            }`
          },
          gap: 2,
          alignItems: 'start'
        }}
      >
        {hasToc && tocOpen && !compact ? (
          <Paper
            elevation={0}
            sx={{
              position: 'sticky',
              top: 8,
              p: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto'
            }}
            className="sig-scroll-thin"
          >
            <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.75 }}>
              <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ flexGrow: 1 }}>
                目录
              </Typography>
              <IconButton size="small" onClick={() => setTocOpen(false)}>
                <ChevronLeftRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
            <List dense disablePadding>
              {sections.map((section, index) => {
                const active = document?.format === 'folder' ? section.anchor === activeChapter : false
                const target = section.anchor
                return (
                  <ListItemButton
                    key={`${section.anchor}-${index}`}
                    selected={active}
                    onClick={() => {
                      if (document?.format === 'folder') {
                        setActiveChapter(target)
                      } else {
                        const headings = contentRef.current?.querySelectorAll('h1, h2, h3')
                        headings?.forEach((heading) => {
                          if (heading.textContent?.trim() === section.title) {
                            heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        })
                      }
                    }}
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.25,
                      '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.14) }
                    }}
                  >
                    <ListItemText
                      primary={`${index + 1}. ${section.title}`}
                      primaryTypographyProps={{ variant: 'body2', noWrap: true, fontWeight: active ? 700 : 400 }}
                    />
                  </ListItemButton>
                )
              })}
            </List>
          </Paper>
        ) : null}

        <Paper ref={contentRef} elevation={0} onMouseUp={captureSelection} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
          {mode === 'rendered' ? (
            isBinaryDocument ? (
              <>
                <DocumentRenderedView nodeId={nodeId} />
                {document?.format === 'pdf' && readableText.trim().length < 40 ? (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    这个 PDF 没能提取出文本（可能是扫描件）。渲染视图仍可正常阅读；若要用 AI 精读、出题或检测，请先执行本地 OCR，或切换到「文本」查看已抽取的内容。
                  </Alert>
                ) : null}
              </>
            ) : (
              <MarkdownView fontSize={settings?.editor.fontSize}>{readableText}</MarkdownView>
            )
          ) : (
            <Box
              component="pre"
              sx={{
                m: 0,
                fontSize: 13.5,
                whiteSpace: 'pre-wrap',
                fontFamily: 'JetBrains Mono, Consolas, monospace',
                color: 'text.primary'
              }}
            >
              {readableText}
            </Box>
          )}
          <Divider sx={{ my: 3 }} />
          {readableText.trim().length >= 200 ? (
            <Alert
              severity="info"
              icon={false}
              sx={{ mb: 1.5 }}
              action={
                <Button size="small" color="inherit" startIcon={<QuizRoundedIcon />} onClick={() => setQuizOpen(true)}>
                  检测本节
                </Button>
              }
            >
              阶段性检测：本节读完了，用几道题确认自己真的看懂了（题目只考这一节）。
            </Alert>
          ) : null}
          <Typography variant="caption" color="text.disabled">
            提示：选中任意文字可浮动「询问 / 引用到笔记」；点击「精读本章」让 AI 生成结构化黑板笔记。
          </Typography>
        </Paper>

        {notesOpen && !compact ? (
          <Box sx={{ position: 'sticky', top: 8 }}>
            <BlackboardNotes
              notes={notes}
              onDelete={async (id) => setNotes(await api.notes.remove(id))}
              onClear={async () => setNotes(await api.notes.clear(nodeId))}
              noteDraft={noteDraft}
              onDraftChange={setNoteDraft}
              onAdd={async () => {
                if (!noteDraft.trim()) return
                await addNote({
                  kind: 'user',
                  title: activeSection?.title ? `笔记：${activeSection.title}` : '随手笔记',
                  content: noteDraft.trim()
                })
                setNoteDraft('')
              }}
              onCollapse={() => setNotesOpen(false)}
            />
          </Box>
        ) : null}
      </Box>

      {hasToc && !tocOpen && !compact ? (
        <IconButton
          size="small"
          onClick={() => setTocOpen(true)}
          sx={{ position: 'fixed', left: 12, top: 120, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', zIndex: 4 }}
        >
          <ChevronRightRoundedIcon fontSize="small" />
        </IconButton>
      ) : null}

      {/* 移动端目录抽屉 */}
      <Drawer anchor="left" open={hasToc && tocOpen && compact} onClose={() => setTocOpen(false)}>
        <Box sx={{ width: 280, p: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            目录
          </Typography>
          <List dense disablePadding>
            {sections.map((section, index) => (
              <ListItemButton
                key={`${section.anchor}-drawer-${index}`}
                onClick={() => {
                  if (document?.format === 'folder') setActiveChapter(section.anchor)
                  setTocOpen(false)
                }}
                selected={document?.format === 'folder' && section.anchor === activeChapter}
              >
                <ListItemText primary={`${index + 1}. ${section.title}`} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* 移动端笔记抽屉 */}
      <Drawer anchor="right" open={notesOpen && compact} onClose={() => setNotesOpen(false)}>
        <Box sx={{ width: 340, p: 1.5 }}>
          <BlackboardNotes
            notes={notes}
            onDelete={async (id) => setNotes(await api.notes.remove(id))}
            onClear={async () => setNotes(await api.notes.clear(nodeId))}
            noteDraft={noteDraft}
            onDraftChange={setNoteDraft}
            onAdd={async () => {
              if (!noteDraft.trim()) return
              await addNote({ kind: 'user', title: '随手笔记', content: noteDraft.trim() })
              setNoteDraft('')
            }}
            onCollapse={() => setNotesOpen(false)}
          />
        </Box>
      </Drawer>

      {/* 选中文字浮动工具条 */}
      {selection ? (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            left: selection.x,
            top: Math.max(56, selection.y - 52),
            transform: 'translateX(-50%)',
            px: 0.75,
            py: 0.5,
            borderRadius: 999,
            zIndex: 1300,
            display: 'flex',
            gap: 0.5
          }}
        >
          <Button
            size="small"
            startIcon={<HelpOutlineRoundedIcon />}
            onClick={() => {
              openAsk({ sourceId: nodeId, title, selection: selection.text })
              setSelection(null)
            }}
          >
            询问
          </Button>
          <Button
            size="small"
            startIcon={<FormatQuoteRoundedIcon />}
            onClick={async () => {
              await addNote({ kind: 'quote', title: '引用', content: `> ${selection.text}` })
              setSelection(null)
              toast('success', '已引用到黑板笔记')
            }}
          >
            引用
          </Button>
        </Paper>
      ) : null}

      {notes.length > 0 ? (
        <Typography variant="caption" color="text.disabled">
          本章相关笔记共 {notes.length} 条，保存在本机 notes.json。
        </Typography>
      ) : null}

      <QuizDialog
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        sourceId={nodeId}
        contextText={readableText}
        title={activeSection?.title ? `${title} · ${activeSection.title}` : title}
        count={3}
      />
    </Stack>
  )
}

function BlackboardNotes({
  notes,
  onDelete,
  onClear,
  noteDraft,
  onDraftChange,
  onAdd,
  onCollapse
}: {
  notes: NoteEntry[]
  onDelete: (id: string) => void | Promise<void>
  onClear: () => void | Promise<void>
  noteDraft: string
  onDraftChange: (value: string) => void
  onAdd: () => void | Promise<void>
  onCollapse: () => void
}) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        maxHeight: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.06) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05) 0%, transparent 40%), linear-gradient(160deg, #24322c 0%, #1a2420 100%)',
        color: '#e9f3ec'
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(233,243,236,0.15)' }}>
        <SchoolRoundedIcon sx={{ fontSize: 16, color: '#b7e3c6' }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1, color: '#e9f3ec' }}>
          黑板笔记
        </Typography>
        <Chip size="small" label={notes.length} sx={{ bgcolor: 'rgba(233,243,236,0.14)', color: '#e9f3ec' }} />
        <Tooltip title="清空本页笔记">
          <IconButton size="small" sx={{ color: '#e9f3ec' }} onClick={() => void onClear()}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" sx={{ color: '#e9f3ec' }} onClick={onCollapse}>
          <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5 }} className="sig-scroll-thin">
        {notes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
            <Typography sx={{ fontSize: 40, opacity: 0.5 }}>🖍️</Typography>
            <Typography variant="subtitle2" sx={{ color: '#d7f0e1', mt: 1 }}>
              黑板还是空的
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(233,243,236,0.72)', display: 'block', mt: 0.5, lineHeight: 1.7 }}>
              点击「精读本章」让 AI 写出结构化笔记，或选中正文文字后引用到黑板。
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {notes.map((note) => (
              <Box
                key={note.id}
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(233,243,236,0.12)',
                  '&:hover .note-del': { opacity: 1 }
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                  <Chip
                    size="small"
                    label={note.kind === 'ai' ? 'AI 精读' : note.kind === 'quote' ? '引用' : '我'}
                    sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(183,227,198,0.2)', color: '#d7f0e1' }}
                  />
                  <Typography variant="caption" sx={{ flexGrow: 1, color: '#b7e3c6' }} noWrap>
                    {note.title}
                  </Typography>
                  <IconButton
                    className="note-del"
                    size="small"
                    sx={{ color: '#e9f3ec', opacity: 0, transition: 'opacity 140ms ease' }}
                    onClick={() => void onDelete(note.id)}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Stack>
                <Box sx={{ color: '#eaf6ee', fontSize: 13, lineHeight: 1.7, filter: 'contrast(1.05)' }}>
                  <MarkdownView compact>{note.content}</MarkdownView>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Box sx={{ p: 1.25, borderTop: '1px solid rgba(233,243,236,0.15)' }}>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder="写点什么…（Ctrl+Enter 保存）"
          value={noteDraft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void onAdd()
          }}
          InputProps={{
            sx: {
              color: '#e9f3ec',
              bgcolor: 'rgba(0,0,0,0.18)',
              borderRadius: 1.5,
              '& fieldset': { borderColor: 'rgba(233,243,236,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(233,243,236,0.4)' }
            }
          }}
        />
      </Box>
    </Box>
  )
}
