/**
 * 文档「渲染视图」：把原始文档画出来，而不是展示抽取/OCR 后的文本。
 * - PDF：pdf.js 渲染到 canvas（另叠一层文本层，可选中复制）
 * - DOCX：主进程/移动端用 mammoth 转出保留格式的 HTML，这里净化后展示
 * 渲染数据由 `library:preview` 提供（见 shared/types 的 DocumentPreview）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import DOMPurify from 'dompurify'
import 'pdfjs-dist/web/pdf_viewer.css'
import { api } from '../api'
import type { DocumentPreview } from '@shared/types'

const ZOOM_STEP = 0.15

/* --------------------------------- PDF ---------------------------------- */

function PdfView({ base64 }: { base64: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textRef = useRef<HTMLDivElement | null>(null)
  const [doc, setDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1.1)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')
  const pdfjsRef = useRef<typeof import('pdfjs-dist') | null>(null)

  useEffect(() => {
    let cancelled = false
    let loaded: import('pdfjs-dist').PDFDocumentProxy | null = null
    setError('')
    setDoc(null)
    setRendering(true)
    void (async () => {
      try {
        const pdfjs = pdfjsRef.current ?? (await import('pdfjs-dist'))
        pdfjsRef.current = pdfjs
        // 用 Vite 的 ?worker 语法把 worker 一起打包，Electron/Capacitor 下都能用
        const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')
        pdfjs.GlobalWorkerOptions.workerPort = new workerModule.default()
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
        loaded = await pdfjs.getDocument({ data: bytes }).promise
        if (cancelled) {
          void loaded.destroy()
          return
        }
        setDoc(loaded)
        setPages(loaded.numPages)
        setPage(1)
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'PDF 渲染失败')
      }
    })()
    return () => {
      cancelled = true
      if (loaded) void loaded.destroy()
    }
  }, [base64])

  useEffect(() => {
    if (!doc) return
    let cancelled = false
    setRendering(true)
    void (async () => {
      try {
        const target = await doc.getPage(page)
        const viewport = target.getViewport({ scale })
        const canvas = canvasRef.current
        const container = textRef.current
        if (!canvas || !container || cancelled) return
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        await target.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0]
        }).promise
        // 文本层：让 PDF 里的文字可选中（位置/字号由 pdf.js 依据 --scale-factor 计算）
        if (container && !cancelled) {
          container.innerHTML = ''
          container.style.setProperty('--scale-factor', String(viewport.scale))
          container.style.width = `${Math.floor(viewport.width)}px`
          container.style.height = `${Math.floor(viewport.height)}px`
          const textLayer = new pdfjsRef.current!.TextLayer({
            textContentSource: await target.getTextContent(),
            container,
            viewport
          })
          await textLayer.render()
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'PDF 页面渲染失败')
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc, page, scale])

  if (error) {
    return <Alert severity="warning">渲染 PDF 失败：{error}。可切换到文本视图查看提取内容，或用「外部打开」。</Alert>
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Tooltip title="上一页">
          <span>
            <IconButton size="small" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeftRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 74, textAlign: 'center' }}>
          {rendering ? '渲染中…' : `${page} / ${pages || '?'}`}
        </Typography>
        <Tooltip title="下一页">
          <span>
            <IconButton size="small" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="缩小">
          <IconButton size="small" onClick={() => setScale((value) => Math.max(0.5, Number((value - ZOOM_STEP).toFixed(2))))}>
            <RemoveRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 42, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </Typography>
        <Tooltip title="放大">
          <IconButton size="small" onClick={() => setScale((value) => Math.min(3, Number((value + ZOOM_STEP).toFixed(2))))}>
            <AddRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {rendering ? <CircularProgress size={14} /> : null}
      </Stack>
      <Box
        sx={{
          position: 'relative',
          alignSelf: 'flex-start',
          maxWidth: '100%',
          maxHeight: '72vh',
          overflow: 'auto',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          p: 1
        }}
        className="sig-scroll-thin"
      >
        <Box sx={{ position: 'relative', lineHeight: 0 }}>
          <canvas ref={canvasRef} />
          <Box
            ref={textRef}
            className="textLayer"
            sx={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              lineHeight: 1,
              '& span': { position: 'absolute', whiteSpace: 'pre', cursor: 'text', transformOrigin: '0% 0%' }
            }}
          />
        </Box>
      </Box>
    </Stack>
  )
}

/* --------------------------------- DOCX --------------------------------- */

function HtmlView({ html }: { html: string }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['colspan', 'rowspan'] }),
    [html]
  )
  return (
    <Box
      className="sig-markdown sig-docx sig-scroll-thin"
      sx={{
        maxHeight: '72vh',
        overflow: 'auto',
        p: { xs: 1.5, md: 2 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        fontSize: 15,
        lineHeight: 1.75,
        wordBreak: 'break-word',
        '& h1': { fontSize: '1.6em', mt: 2, mb: 1 },
        '& h2': { fontSize: '1.35em', mt: 2.4, mb: 0.8 },
        '& h3': { fontSize: '1.15em', mt: 2, mb: 0.6 },
        '& p': { my: 1 },
        '& img': { maxWidth: '100%', borderRadius: 1 },
        '& table': { borderCollapse: 'collapse', width: '100%', my: 1.5 },
        '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1.2, py: 0.7 },
        '& blockquote': { my: 1.2, px: 1.5, borderLeft: '4px solid', borderColor: 'primary.main', bgcolor: 'var(--sig-surface-variant)' }
      }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

/* ------------------------------- 顶层组件 ------------------------------- */

export function DocumentRenderedView({ nodeId }: { nodeId: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data?: DocumentPreview; message?: string }>({
    status: 'loading'
  })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const data = await api.library.preview(nodeId)
      setState({ status: 'ready', data })
    } catch (error) {
      setState({ status: 'error', message: (error as Error).message })
    }
  }, [nodeId])

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'loading') {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 4, justifyContent: 'center' }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          正在载入原始文档…
        </Typography>
      </Stack>
    )
  }

  if (state.status === 'error') {
    return <Alert severity="warning">渲染视图加载失败：{state.message}。可切换到文本视图查看提取的内容。</Alert>
  }

  if (!state.data || state.data.mode === 'none') {
    return (
      <Alert severity="info">
        {state.data?.reason ?? '该格式没有渲染视图'}。切换到文本视图可查看提取的内容。
      </Alert>
    )
  }

  if (state.data.mode === 'pdf') return <PdfView base64={state.data.base64} />
  return <HtmlView html={state.data.html} />
}
