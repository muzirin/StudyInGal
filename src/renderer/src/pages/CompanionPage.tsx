import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import AddCommentRoundedIcon from '@mui/icons-material/AddCommentRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { MarkdownView } from '../components/MarkdownView'
import { Live2DStage } from '../components/Live2DStage'
import { EmptyState } from '../components/Section'
import { formatRelative } from '../lib/format'
import type { Character, ChatMessage, Conversation } from '@shared/types'

const EMOTION_EMOJI: Record<string, string> = {
  neutral: '🙂',
  happy: '😊',
  thinking: '🤔',
  surprised: '😮',
  serious: '🧐',
  shy: '😳',
  excited: '🤩',
  sad: '😢',
  angry: '😠'
}

function guessEmotion(text: string): string {
  if (/(哈哈|嘿嘿|太好|太棒|开心|😄|😊)/.test(text)) return 'happy'
  if (/(哇|竟然|居然|没想到|😮)/.test(text)) return 'surprised'
  if (/(抱歉|遗憾|可惜|难过|😢)/.test(text)) return 'sad'
  if (/(注意|务必|小心|警告|重要)/.test(text)) return 'serious'
  if (/(\?|？|想一想|思考|也许)/.test(text)) return 'thinking'
  if (/(害羞|不好意思|😳)/.test(text)) return 'shy'
  return 'neutral'
}

type Panel = 'chat' | 'character' | 'history'

export function CompanionPage() {
  const theme = useTheme()
  const compact = useMediaQuery('(max-width: 1100px)')
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const toast = useAppStore((state) => state.toast)

  const [panel, setPanel] = useState<Panel>('chat')
  const [characters, setCharacters] = useState<Character[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Conversation['messages']>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [emotion, setEmotion] = useState('neutral')
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const active = useMemo(() => characters.find((item) => item.id === activeId) ?? null, [characters, activeId])

  const refreshConversations = async (characterId: string): Promise<void> => {
    setConversations(await api.conversations.list(characterId).catch(() => []))
  }

  useEffect(() => {
    void api.characters.list().then((list) => {
      setCharacters(list)
      const preferred =
        settings?.companion.activeCharacterId ?? list.find((item) => item.isCompanion)?.id ?? list[0]?.id ?? null
      setActiveId(preferred)
    })
  }, [settings?.companion.activeCharacterId])

  useEffect(() => {
    if (!activeId) return
    void refreshConversations(activeId)
    setConversationId(null)
    setMessages([])
  }, [activeId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const speak = (text: string): void => {
    if (!('speechSynthesis' in window)) return
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
    setInput('')
    setBusy(true)

    const userMessage = await api.conversations.append({
      conversationId: conversationId ?? undefined,
      characterId: active.id,
      message: { role: 'user', content: prompt }
    })
    setConversationId(userMessage.id)
    setMessages(userMessage.messages)
    void refreshConversations(active.id)

    try {
      const history: ChatMessage[] = [
        { role: 'system', content: active.systemPrompt },
        ...userMessage.messages.slice(-16).map((message) => ({ role: message.role, content: message.content }) as ChatMessage)
      ]
      const response = await api.ai.chat({ capability: 'chat', messages: history })
      const nextEmotion = guessEmotion(response.content)
      setEmotion(nextEmotion)
      const assistantMessage = await api.conversations.append({
        conversationId: userMessage.id,
        characterId: active.id,
        message: { role: 'assistant', content: response.content, emotion: nextEmotion }
      })
      setMessages(assistantMessage.messages)
      void refreshConversations(active.id)
      if (settings?.companion.showBubbles) speak(response.content)
    } catch (error) {
      toast('error', `对话失败：${(error as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return null

  const panels: { id: Panel; label: string; hint: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: '对话', hint: `${messages.length} 条消息`, icon: <ForumRoundedIcon fontSize="small" /> },
    { id: 'character', label: '角色', hint: active ? active.name : '未选择', icon: <SmartToyRoundedIcon fontSize="small" /> },
    { id: 'history', label: '会话记录', hint: `${conversations.length} 个会话`, icon: <HistoryRoundedIcon fontSize="small" /> }
  ]

  const panelNav = (
    <List dense disablePadding>
      {panels.map((item) => (
        <ListItemButton
          key={item.id}
          selected={item.id === panel}
          onClick={() => setPanel(item.id)}
          sx={{
            borderRadius: 3,
            mb: 0.5,
            minHeight: 46,
            '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.14) }
          }}
        >
          <Box sx={{ display: 'flex', mr: 1.5, color: item.id === panel ? 'primary.main' : 'text.secondary' }}>{item.icon}</Box>
          <ListItemText
            primary={item.label}
            secondary={item.hint}
            primaryTypographyProps={{ variant: 'body2', fontWeight: item.id === panel ? 700 : 500 }}
            secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
          />
        </ListItemButton>
      ))}
    </List>
  )

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '232px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
      {compact ? (
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }} className="sig-scroll-thin">
          {panels.map((item) => (
            <Chip
              key={item.id}
              icon={<Box sx={{ display: 'flex', '& svg': { fontSize: 16 } }}>{item.icon}</Box>}
              label={item.label}
              clickable
              color={item.id === panel ? 'primary' : 'default'}
              variant={item.id === panel ? 'filled' : 'outlined'}
              onClick={() => setPanel(item.id)}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            position: 'sticky',
            top: 8,
            p: 1,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7)
          }}
        >
          <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ pl: 1.5, py: 1, display: 'block' }}>
            伴学娘
          </Typography>
          {panelNav}
        </Box>
      )}

      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        {panel === 'character' ? (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
                gap: 2.5,
                p: 2.5,
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                background: `radial-gradient(110% 80% at 84% 6%, ${alpha(theme.palette.primary.main, 0.22)} 0%, transparent 60%), var(--sig-surface-variant)`
              }}
            >
              <Stack spacing={2}>
                <TextField
                  select
                  size="small"
                  label="当前伴学娘"
                  value={activeId ?? ''}
                  onChange={(event) => {
                    setActiveId(event.target.value)
                    void patchSettings({ companion: { ...settings.companion, activeCharacterId: event.target.value } })
                  }}
                  sx={{ maxWidth: 320 }}
                >
                  {characters.map((character) => (
                    <MenuItem key={character.id} value={character.id}>
                      {character.avatar} {character.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="body2" color="text.secondary">
                  {active?.personality ?? '尚未选择角色'}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {(active?.tags ?? []).map((tag) => (
                    <Chip key={tag} size="small" label={tag} variant="outlined" />
                  ))}
                  <Chip size="small" label={`${active?.sprites.length ?? 0} 立绘`} />
                  {active?.live2d?.modelPath ? <Chip size="small" color="primary" label="Live2D" /> : null}
                </Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.companion.proactive}
                      onChange={(event) => void patchSettings({ companion: { ...settings.companion, proactive: event.target.checked } })}
                    />
                  }
                  label="允许主动搭话"
                />
                <Button size="small" variant="outlined" onClick={() => toast('info', '更多角色设定请前往「角色管理」')}>
                  编辑角色设定
                </Button>
              </Stack>
              <Live2DStage character={active} height={320} emotion={emotion} />
            </Box>
          </>
        ) : null}

        {panel === 'history' ? (
          <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
                会话记录
              </Typography>
              <Button
                size="small"
                startIcon={<AddCommentRoundedIcon />}
                variant="contained"
                onClick={() => {
                  setConversationId(null)
                  setMessages([])
                  setPanel('chat')
                }}
              >
                新会话
              </Button>
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            {conversations.length === 0 ? (
              <EmptyState title="还没有会话" description="和伴学娘的对话会自动保存到本机，方便随时继续。" />
            ) : (
              <List dense disablePadding>
                {conversations.map((conversation) => (
                  <ListItemButton
                    key={conversation.id}
                    selected={conversation.id === conversationId}
                    onClick={() => {
                      setConversationId(conversation.id)
                      setMessages(conversation.messages)
                      setPanel('chat')
                    }}
                    sx={{ borderRadius: 2.5, mb: 0.25 }}
                  >
                    <ListItemIconPlaceholder />
                    <ListItemText
                      primary={conversation.title}
                      secondary={`${conversation.messages.length} 条 · ${formatRelative(conversation.updatedAt)}`}
                      primaryTypographyProps={{ variant: 'body2', noWrap: true, fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                    />
                    <Tooltip title="重命名">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation()
                          setRenameTarget(conversation)
                          setRenameValue(conversation.title)
                        }}
                      >
                        <EditRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={async (event) => {
                        event.stopPropagation()
                        const list = await api.conversations.remove(conversation.id)
                        setConversations(list)
                        if (conversationId === conversation.id) {
                          setConversationId(null)
                          setMessages([])
                        }
                      }}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        ) : null}

        {panel === 'chat' ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' }, gap: 2.5, alignItems: 'start' }}>
            <Box
              sx={{
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.background.paper, 0.7),
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 190px)',
                minHeight: 420,
                overflow: 'hidden'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }} noWrap>
                  {active ? `与 ${active.name} 对话` : '对话'}
                </Typography>
                <Chip size="small" label={`${EMOTION_EMOJI[emotion] ?? ''} ${emotion}`} />
                <Tooltip title={speaking ? '停止朗读' : '朗读最新回复'}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (speaking) {
                        window.speechSynthesis.cancel()
                        setSpeaking(false)
                        return
                      }
                      const last = [...messages].reverse().find((message) => message.role === 'assistant')
                      if (last) speak(last.content)
                    }}
                  >
                    {speaking ? <StopRoundedIcon fontSize="small" /> : <VolumeUpRoundedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="清空当前会话显示">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setConversationId(null)
                      setMessages([])
                    }}
                  >
                    <DeleteSweepRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Box ref={scrollRef} sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }} className="sig-scroll-thin">
                {messages.length === 0 ? (
                  <EmptyState
                    title={active ? `${active.name}：${active.greeting}` : '还没有对话'}
                    description="试试问：「帮我用通俗的话解释这篇论文的核心贡献」或「给我出三道练习题」。对话会自动保存。"
                  />
                ) : (
                  <Stack spacing={1.5}>
                    {messages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '92%',
                          bgcolor: message.role === 'user' ? 'primary.main' : 'var(--sig-surface-variant)',
                          color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                          borderRadius: 3,
                          px: 2,
                          py: 1.25
                        }}
                      >
                        {message.role === 'assistant' ? (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            {EMOTION_EMOJI[message.emotion] ?? ''} {active?.name}
                          </Typography>
                        ) : null}
                        {message.role === 'user' ? (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {message.content}
                          </Typography>
                        ) : (
                          <MarkdownView compact>{message.content}</MarkdownView>
                        )}
                      </Box>
                    ))}
                    {busy ? (
                      <Box sx={{ alignSelf: 'flex-start' }}>
                        <Alert severity="info" icon={false} sx={{ py: 0.25 }}>
                          {active?.name ?? '伴学娘'}正在思考…
                        </Alert>
                      </Box>
                    ) : null}
                  </Stack>
                )}
              </Box>

              <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={5}
                  size="small"
                  placeholder="和伴学娘说点什么…（Ctrl+Enter 发送）"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void send()
                  }}
                />
                <Button
                  variant="contained"
                  onClick={() => void send()}
                  disabled={busy || !input.trim()}
                  startIcon={<SendRoundedIcon />}
                  sx={{ whiteSpace: 'nowrap', minWidth: 104, flexShrink: 0 }}
                >
                  发送
                </Button>
              </Stack>
            </Box>

            <Stack spacing={2} sx={{ minWidth: 0 }}>
              <Live2DStage character={active} height={280} emotion={emotion} />
              <Alert severity="info" icon={false}>
                对话记录保存在本机 conversations.json；「精读本章」等 AI 笔记在阅读器中生成。
              </Alert>
            </Stack>
          </Box>
        ) : null}
      </Stack>

      <Dialog open={renameTarget !== null} onClose={() => setRenameTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>重命名会话</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="标题"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && renameValue.trim() && renameTarget) {
                void api.conversations
                  .rename(renameTarget.id, renameValue.trim())
                  .then((list) => setConversations(list))
                  .then(() => setRenameTarget(null))
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>取消</Button>
          <Button
            variant="contained"
            disabled={!renameValue.trim()}
            onClick={async () => {
              if (!renameTarget) return
              setConversations(await api.conversations.rename(renameTarget.id, renameValue.trim()))
              setRenameTarget(null)
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function ListItemIconPlaceholder() {
  return <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mr: 1.5, flexShrink: 0 }} />
}
