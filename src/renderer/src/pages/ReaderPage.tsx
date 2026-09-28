import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MarkdownView } from '../components/MarkdownView'
import { Section } from '../components/Section'
import type { ChapterRef, DocumentContent } from '@shared/types'

export function ReaderPage() {
  const { nodeId = '' } = useParams<{ nodeId: string }>()
  const navigate = useNavigate()
  const toast = useAppStore((state) => state.toast)
  const openAsk = useAppStore((state) => state.openAsk)

  const [document, setDocument] = useState<DocumentContent | null>(null)
  const [chapters, setChapters] = useState<ChapterRef[]>([])
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'rendered' | 'source'>('rendered')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [content, chapterList] = await Promise.all([
          api.library.read(nodeId),
          api.library.chapters(nodeId).catch(() => [])
        ])
        if (cancelled) return
        setDocument(content)
        setChapters(chapterList)
        const [papers, textbooks] = await Promise.all([
          api.library.snapshot('paper').catch(() => null),
          api.library.snapshot('textbook').catch(() => null)
        ])
        const found = [...(papers?.nodes ?? []), ...(textbooks?.nodes ?? [])].find((node) => node.id === nodeId)
        setTitle(found?.title ?? '文献')
        setMode(content.editable && content.format !== 'folder' ? 'source' : 'rendered')
        await api.library.update(found?.kind ?? 'paper', nodeId, { lastOpenedAt: Date.now() }).catch(() => undefined)
      } catch (error) {
        toast('error', `打开失败：${(error as Error).message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nodeId, toast])

  const selectedText = (): string => (typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '')

  const wordCount = useMemo(() => document?.text.replace(/\s+/g, '').length ?? 0, [document])

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Stack spacing={2.5}>
      <Section
        title={title || '文献'}
        subtitle={`${document?.format.toUpperCase() ?? ''} · ${wordCount} 字 · ${chapters.length} 章`}
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => navigate(`/editor/${nodeId}`)}>
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
              startIcon={<HelpOutlineRoundedIcon />}
              onClick={() => openAsk({ sourceId: nodeId, title, selection: selectedText() })}
            >
              询问选中内容
            </Button>
            <Button size="small" variant="contained" startIcon={<AutoStoriesRoundedIcon />} onClick={() => navigate('/galgame')}>
              生成 Gal
            </Button>
          </Stack>
        }
      />

      {document?.format === 'folder' ? (
        <Alert severity="info">
          这是分册教材的自动合并视图（GUI 只读合并，不会改动磁盘上的原始章节文件）。
          {chapters.length > 0 ? `已识别 ${chapters.length} 章。` : ''}
        </Alert>
      ) : null}

      {chapters.length > 1 ? (
        <Section title="目录" subtitle="合并视图章节顺序">
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {chapters.map((chapter) => (
              <Chip key={chapter.id} size="small" label={`${chapter.order + 1}. ${chapter.title}`} />
            ))}
          </Stack>
        </Section>
      ) : null}

      <Section
        title="正文"
        action={
          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_event, value) => value && setMode(value)}>
            <ToggleButton value="rendered">渲染</ToggleButton>
            <ToggleButton value="source">源码</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        <Divider sx={{ mb: 2 }} />
        {document?.format === 'pdf' && document.text.trim().length < 40 ? (
          <Alert severity="warning">
            该 PDF 可能是扫描件，未能提取到文本。可以先执行本地 OCR，或点击「外部打开」用系统阅读器查看。
          </Alert>
        ) : null}
        {mode === 'rendered' ? (
          <MarkdownView>{document?.text ?? ''}</MarkdownView>
        ) : (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: 'var(--sig-surface-variant)',
              borderRadius: 2,
              overflow: 'auto',
              fontSize: 13.5,
              fontFamily: 'JetBrains Mono, Consolas, monospace',
              whiteSpace: 'pre-wrap'
            }}
          >
            {document?.text ?? ''}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          提示：选中任意文字后点击「询问选中内容」，可以把片段一键发给伴学娘。
        </Typography>
      </Section>
    </Stack>
  )
}
