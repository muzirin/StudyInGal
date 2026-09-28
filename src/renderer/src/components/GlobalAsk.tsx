import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MarkdownView } from './MarkdownView'
import type { Character, ChatMessage } from '@shared/types'

interface Turn {
  question: string
  answer: string
}

export function GlobalAsk() {
  const open = useAppStore((state) => state.askOpen)
  const context = useAppStore((state) => state.askContext)
  const close = useAppStore((state) => state.closeAsk)
  const toast = useAppStore((state) => state.toast)

  const [characters, setCharacters] = useState<Character[]>([])
  const [question, setQuestion] = useState('')
  const [useContext, setUseContext] = useState(true)
  const [busy, setBusy] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    api.characters
      .list()
      .then(setCharacters)
      .catch(() => undefined)
    setError(null)
  }, [open])

  const companion = useMemo(
    () => characters.find((item) => item.isCompanion) ?? characters[0] ?? null,
    [characters]
  )

  const ask = async (): Promise<void> => {
    const prompt = question.trim()
    if (!prompt) return
    setBusy(true)
    setError(null)
    try {
      const systemParts = [
        companion?.systemPrompt ?? '你是一位耐心的学习助手，回答简洁准确。',
        context.title ? `当前用户正在阅读：《${context.title}》。` : '',
        useContext && context.selection ? `用户选中的片段：\n${context.selection}` : ''
      ]
      let systemText = systemParts.filter(Boolean).join('\n')

      if (useContext && context.sourceId) {
        try {
          const document = await api.library.read(context.sourceId)
          systemText += `\n\n以下是文献《${context.title ?? document.nodeId}》的正文节选，仅作为回答依据：\n${document.text.slice(0, 12000)}`
        } catch {
          /* 忽略上下文读取失败 */
        }
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: systemText },
        { role: 'user', content: prompt }
      ]
      const response = await api.ai.chat({ capability: 'chat', messages })
      setTurns((prev) => [...prev, { question: prompt, answer: response.content }])
      setQuestion('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>
        一键询问 · {companion?.name ?? '伴学娘'}
        {context.title ? <Chip size="small" label={context.title} sx={{ ml: 1 }} /> : null}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {context.selection ? (
            <Alert severity="info" icon={false}>
              <Typography variant="caption" color="text.secondary">
                已选中片段
              </Typography>
              <Typography variant="body2" sx={{ maxHeight: 90, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                {context.selection.slice(0, 400)}
              </Typography>
            </Alert>
          ) : null}

          {context.sourceId ? (
            <FormControlLabel
              control={<Switch checked={useContext} onChange={(event) => setUseContext(event.target.checked)} />}
              label="携带当前文献正文作为上下文"
            />
          ) : null}

          {turns.map((turn, index) => (
            <Box key={index}>
              <Typography variant="subtitle2" color="primary">
                我：{turn.question}
              </Typography>
              <MarkdownView>{turn.answer}</MarkdownView>
            </Box>
          ))}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          placeholder="输入你的问题，Ctrl+Enter 发送"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void ask()
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            if (!companion) {
              toast('warning', '还没有可用角色，请先在「角色管理」创建')
              return
            }
            void ask()
          }}
          disabled={busy || !question.trim()}
          startIcon={busy ? <CircularProgress size={16} /> : <SendRoundedIcon />}
        >
          发送
        </Button>
      </DialogActions>
    </Dialog>
  )
}
