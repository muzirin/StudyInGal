import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MarkdownView } from '../components/MarkdownView'
import { Live2DStage } from '../components/Live2DStage'
import { EmptyState, Section } from '../components/Section'
import type { Character, ChatMessage } from '@shared/types'

interface Bubble {
  id: string
  role: 'user' | 'assistant'
  content: string
  at: number
}

export function CompanionPage() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const toast = useAppStore((state) => state.toast)

  const [characters, setCharacters] = useState<Character[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void api.characters.list().then((list) => {
      setCharacters(list)
      setActiveId(settings?.companion.activeCharacterId ?? list.find((item) => item.isCompanion)?.id ?? list[0]?.id ?? null)
    })
  }, [settings?.companion.activeCharacterId])

  const active = useMemo(() => characters.find((item) => item.id === activeId) ?? null, [characters, activeId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [bubbles])

  const speak = (text: string): void => {
    if (!('speechSynthesis' in window)) {
      toast('warning', '当前环境不支持 Web Speech 语音合成')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = settings?.locale ?? 'zh-CN'
    utterance.rate = active?.voice.rate ?? settings?.ai.tts.rate ?? 1
    utterance.pitch = active?.voice.pitch ?? settings?.ai.tts.pitch ?? 1
    if (active?.voice.voiceId) {
      const voice = window.speechSynthesis.getVoices().find((item) => item.name === active.voice.voiceId)
      if (voice) utterance.voice = voice
    }
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const send = async (): Promise<void> => {
    const prompt = input.trim()
    if (!prompt || !active) return
    const history: Bubble[] = [...bubbles, { id: `u${Date.now()}`, role: 'user', content: prompt, at: Date.now() }]
    setBubbles(history)
    setInput('')
    setBusy(true)
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: active.systemPrompt },
        ...history.slice(-16).map((bubble) => ({ role: bubble.role, content: bubble.content }) as ChatMessage)
      ]
      const response = await api.ai.chat({ capability: 'chat', messages })
      setBubbles((prev) => [...prev, { id: `a${Date.now()}`, role: 'assistant', content: response.content, at: Date.now() }])
      if (settings?.companion.showBubbles) speak(response.content)
    } catch (error) {
      toast('error', `对话失败：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '420px 1fr' }, gap: 2.5, alignItems: 'start' }}>
      <Stack spacing={2.5}>
        <Section
          title="角色"
          subtitle="Live2D / 立绘 / 语音"
          action={
            <Tooltip title={speaking ? '停止朗读' : '朗读上一条'}>
              <IconButton
                size="small"
                onClick={() => {
                  if (speaking) {
                    window.speechSynthesis.cancel()
                    setSpeaking(false)
                  } else {
                    const last = [...bubbles].reverse().find((bubble) => bubble.role === 'assistant')
                    if (last) speak(last.content)
                  }
                }}
              >
                {speaking ? <StopRoundedIcon fontSize="small" /> : <VolumeUpRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          }
        >
          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="当前伴学娘"
              value={activeId ?? ''}
              onChange={(event) => {
                setActiveId(event.target.value)
                void patchSettings({ companion: { ...(settings?.companion as object), activeCharacterId: event.target.value } })
              }}
            >
              {characters.map((character) => (
                <MenuItem key={character.id} value={character.id}>
                  {character.avatar} {character.name}
                </MenuItem>
              ))}
            </TextField>
            <Live2DStage character={active} height={260} />
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {(active?.tags ?? []).map((tag) => (
                <Chip key={tag} size="small" label={tag} variant="outlined" />
              ))}
            </Stack>
            {active ? (
              <Typography variant="caption" color="text.secondary">
                {active.personality}
              </Typography>
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.companion.proactive ?? false}
                  onChange={(event) =>
                    void patchSettings({ companion: { ...(settings?.companion as object), proactive: event.target.checked } })
                  }
                />
              }
              label="允许主动搭话"
            />
            <Button
              variant="outlined"
              startIcon={<DeleteSweepRoundedIcon />}
              onClick={() => {
                setBubbles([])
                toast('info', '已清空当前会话')
              }}
            >
              清空会话
            </Button>
          </Stack>
        </Section>
      </Stack>

      <Section
        title="对话"
        subtitle={active ? `正在与 ${active.name} 交谈` : '请选择角色'}
        action={<Chip size="small" label={`${bubbles.length} 条`} />}
      >
        <Stack spacing={2} sx={{ minHeight: 420 }}>
          <Box ref={scrollRef} sx={{ flexGrow: 1, maxHeight: 520, overflowY: 'auto', pr: 1 }}>
            {bubbles.length === 0 ? (
              <EmptyState
                title={active ? `${active.name}：${active.greeting}` : '还没有对话'}
                description="试试问：「帮我用通俗的话解释这篇论文的核心贡献」或「给我出三道练习题」。"
              />
            ) : (
              <Stack spacing={1.5}>
                {bubbles.map((bubble) => (
                  <Box
                    key={bubble.id}
                    sx={{
                      alignSelf: bubble.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '92%',
                      bgcolor: bubble.role === 'user' ? 'primary.main' : 'var(--sig-surface-variant)',
                      color: bubble.role === 'user' ? 'primary.contrastText' : 'text.primary',
                      borderRadius: 3,
                      px: 2,
                      py: 1.2
                    }}
                  >
                    {bubble.role === 'user' ? (
                      <Typography variant="body2">{bubble.content}</Typography>
                    ) : (
                      <MarkdownView compact>{bubble.content}</MarkdownView>
                    )}
                  </Box>
                ))}
                {busy ? <Alert severity="info" icon={false}>正在思考…</Alert> : null}
              </Stack>
            )}
          </Box>

          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              maxRows={5}
              placeholder="和伴学娘说点什么…（Ctrl+Enter 发送）"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void send()
              }}
            />
            <Button variant="contained" onClick={() => void send()} disabled={busy || !input.trim()} startIcon={<SendRoundedIcon />}>
              发送
            </Button>
          </Stack>
        </Stack>
      </Section>
    </Box>
  )
}
