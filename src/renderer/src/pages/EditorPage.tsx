import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MarkdownView } from '../components/MarkdownView'
import { Section } from '../components/Section'
import type { ChapterRef, LibraryNode } from '@shared/types'

export function EditorPage() {
  const { nodeId = '' } = useParams<{ nodeId: string }>()
  const toast = useAppStore((state) => state.toast)
  const settings = useAppStore((state) => state.settings)

  const [node, setNode] = useState<LibraryNode | null>(null)
  const [chapters, setChapters] = useState<ChapterRef[]>([])
  const [targetPath, setTargetPath] = useState<string>('')
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [preview, setPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const autosaveTimer = useRef<number | null>(null)

  const load = useCallback(
    async (path?: string) => {
      const [papers, textbooks] = await Promise.all([api.library.snapshot('paper'), api.library.snapshot('textbook')])
      const found = [...papers.nodes, ...textbooks.nodes].find((item) => item.id === nodeId) ?? null
      setNode(found)
      const chapterList = await api.library.chapters(nodeId).catch(() => [] as ChapterRef[])
      setChapters(chapterList)
      const active = path ?? (found?.format === 'folder' ? chapterList[0]?.path ?? '' : found?.path ?? '')
      setTargetPath(active)
      if (found?.format === 'folder') {
        const merged = await api.library.merge(nodeId)
        const chapter = merged.chapters.find((item) => item.path === active)
        setContent(chapter?.content ?? '')
        setOriginal(chapter?.content ?? '')
      } else {
        const document = await api.library.read(nodeId)
        setContent(document.text)
        setOriginal(document.text)
      }
    },
    [nodeId]
  )

  useEffect(() => {
    void load()
  }, [load])

  const dirty = content !== original

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await api.library.write(nodeId, content, node?.format === 'folder' ? targetPath : undefined)
      setOriginal(content)
      toast('success', '已保存')
    } catch (error) {
      toast('error', `保存失败：${(error as Error).message}`)
    } finally {
      setSaving(false)
    }
  }, [content, node?.format, nodeId, targetPath, toast])

  useEffect(() => {
    const autosave = settings?.editor.autosave ?? true
    if (!autosave || !dirty) return
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => void save(), settings?.editor.autosaveMs ?? 1500)
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    }
  }, [content, dirty, save, settings?.editor.autosave, settings?.editor.autosaveMs])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  const lineCount = useMemo(() => content.split('\n').length, [content])

  return (
    <Stack spacing={2.5} sx={{ height: '100%' }}>
      <Section
        title={`编辑：${node?.title ?? '文献'}`}
        subtitle={`${lineCount} 行 · ${content.length} 字符${dirty ? ' · 未保存' : ''}`}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {node?.format === 'folder' ? (
              <TextField
                select
                size="small"
                label="章节文件"
                value={targetPath}
                onChange={(event) => void load(event.target.value)}
                sx={{ minWidth: 220 }}
              >
                {chapters.map((chapter) => (
                  <MenuItem key={chapter.id} value={chapter.path}>
                    {chapter.title}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <ToggleButtonGroup size="small" exclusive value={preview} onChange={(_event, value) => value !== null && setPreview(value)}>
              <ToggleButton value={true}>预览</ToggleButton>
              <ToggleButton value={false}>专注</ToggleButton>
            </ToggleButtonGroup>
            <Chip size="small" color={dirty ? 'warning' : 'default'} label={dirty ? '未保存' : '已同步'} />
            <Button variant="contained" size="small" startIcon={<SaveRoundedIcon />} disabled={!dirty || saving} onClick={() => void save()}>
              保存
            </Button>
          </Stack>
        }
      />

      <Alert severity="info" icon={false}>
        支持 Markdown / LaTeX / TXT 源码编辑，Ctrl+S 保存。Markdown 预览支持公式（KaTeX）与 GFM 表格。
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: preview ? { xs: '1fr', lg: '1fr 1fr' } : '1fr', gap: 2, flexGrow: 1, minHeight: 0 }}>
        <Box
          component="textarea"
          value={content}
          spellCheck={false}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setContent(event.target.value)}
          sx={{
            width: '100%',
            minHeight: 420,
            resize: 'vertical',
            p: 2,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'var(--sig-surface-variant)',
            color: 'text.primary',
            fontFamily: settings?.editor.fontFamily ?? 'JetBrains Mono, Consolas, monospace',
            fontSize: settings?.editor.fontSize ?? 14,
            lineHeight: 1.7,
            outline: 'none'
          }}
        />
        {preview ? (
          <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'auto', maxHeight: 720 }}>
            <MarkdownView>{content}</MarkdownView>
          </Box>
        ) : null}
      </Box>

      {!node ? <Typography variant="caption" color="text.secondary">未能定位文献元数据。</Typography> : null}
    </Stack>
  )
}
