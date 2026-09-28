import { useCallback, useEffect, useState } from 'react'
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
  LinearProgress,
  Stack,
  Typography
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { QuizQuestion, QuizResult, QuizStats } from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
  sourceId?: string
  scriptId?: string | null
  /** 出题依据的正文；不传则用 sourceId 对应的文献 */
  contextText?: string
  title?: string
  count?: number
  /** 直接给题（例如随剧本生成好的题目），不再调用模型 */
  questions?: QuizQuestion[]
  /** 没有现成题目时用于补题（例如给旧剧本「重新出题」） */
  regenerate?: () => Promise<{ questions: QuizQuestion[]; truncated: boolean }>
}

export function QuizDialog({
  open,
  onClose,
  sourceId,
  scriptId,
  contextText,
  title,
  count = 3,
  questions: provided,
  regenerate
}: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<QuizResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [session, setSession] = useState({ answered: 0, correct: 0 })
  const [stats, setStats] = useState<QuizStats | null>(null)

  const current = questions[index] ?? null
  const hasProvided = Boolean(provided && provided.length > 0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setIndex(0)
    setAnswer('')
    setResult(null)
    setSession({ answered: 0, correct: 0 })
    try {
      const history = await api.quiz.stats({ sourceId, scriptId: scriptId ?? undefined }).catch(() => null)
      setStats(history)
      if (provided && provided.length > 0) {
        setQuestions(provided)
        return
      }
      const generated = regenerate
        ? await regenerate()
        : await api.quiz.generate({ sourceId, scriptId, contextText, title, count })
      setQuestions(generated.questions)
      if (generated.truncated) setError('题目较多，模型输出被截断，已保留可用的部分。')
    } catch (err) {
      setQuestions([])
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sourceId, scriptId, contextText, title, count, provided, regenerate])

  useEffect(() => {
    if (open) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (): Promise<void> => {
    if (!current || !answer.trim()) return
    setChecking(true)
    try {
      const outcome = await api.quiz.evaluate({ question: current, answer })
      setResult(outcome)
      setSession((prev) => ({ answered: prev.answered + 1, correct: prev.correct + (outcome.correct ? 1 : 0) }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const next = (): void => {
    setResult(null)
    setAnswer('')
    setIndex((value) => value + 1)
  }

  const finished = questions.length > 0 && index >= questions.length
  const accuracy = session.answered > 0 ? session.correct / session.answered : 0

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        随堂问答
        <Typography variant="caption" color="text.secondary" display="block">
          {title ? `依据：${title}` : '依据当前内容'}
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ position: 'absolute', top: 14, right: 14 }}>
          {stats && stats.total > 0 ? (
            <Chip size="small" variant="outlined" label={`历史正确率 ${Math.round(stats.accuracy * 100)}%`} />
          ) : null}
          {session.answered > 0 ? <Chip size="small" color="primary" label={`本轮 ${session.correct}/${session.answered}`} /> : null}
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 260 }}>
        {loading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              {hasProvided ? '准备题目…' : '正在根据内容出题…'}
            </Typography>
          </Stack>
        ) : null}

        {!loading && questions.length === 0 ? (
          <Stack spacing={2}>
            <Alert severity="warning">{error ?? '还没有可用题目。'}</Alert>
            <Typography variant="body2" color="text.secondary">
              {hasProvided
                ? ''
                : '出题需要一个可用的 AI 提供商（「设置 → API 与语音」，能力路由选「对话 / 问答」）。读懂剧本本身不需要联网。'}
            </Typography>
          </Stack>
        ) : null}

        {!loading && finished ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <Typography variant="h5" fontWeight={700}>
              {Math.round(accuracy * 100)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              本轮答对 {session.correct} / {session.answered} 题
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>
                再来一组
              </Button>
              <Button onClick={onClose}>结束</Button>
            </Stack>
          </Stack>
        ) : null}

        {!loading && current ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={`第 ${index + 1} / ${questions.length} 题`} />
              <Chip size="small" variant="outlined" label="单选" />
            </Stack>
            <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.7 }}>
              {current.question}
            </Typography>

            <Stack spacing={1}>
              {current.options.map((option, optionIndex) => {
                const selected = answer === String(optionIndex)
                const isAnswer = result ? optionIndex === current.answerIndex : false
                const isWrongPick = Boolean(result) && selected && !isAnswer
                return (
                  <Button
                    key={`${option}-${optionIndex}`}
                    variant={selected || isAnswer ? 'contained' : 'outlined'}
                    color={isAnswer ? 'success' : isWrongPick ? 'error' : 'primary'}
                    disabled={Boolean(result)}
                    onClick={() => setAnswer(String(optionIndex))}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1.5, py: 1 }}
                  >
                    {String.fromCharCode(65 + optionIndex)}. {option}
                  </Button>
                )
              })}
            </Stack>

            {result ? (
              <Alert
                severity={result.correct ? 'success' : 'error'}
                icon={result.correct ? <CheckCircleRoundedIcon /> : <CancelRoundedIcon />}
              >
                <Typography variant="body2" fontWeight={600}>
                  {result.feedback}
                </Typography>
                {result.explanation ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {result.explanation}
                  </Typography>
                ) : null}
              </Alert>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {!loading && questions.length === 0 ? (
          <>
            <Button onClick={() => navigate('/settings')} startIcon={<SettingsRoundedIcon />}>
              去设置
            </Button>
            <Button onClick={() => void load()} startIcon={<RefreshRoundedIcon />}>
              重试
            </Button>
          </>
        ) : result ? (
          <Button variant="contained" onClick={next}>
            {index + 1 >= questions.length ? '查看结果' : '下一题'}
          </Button>
        ) : (
          <>
            <Box sx={{ flexGrow: 1, mr: 1 }}>
              <LinearProgress
                variant="determinate"
                value={questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0}
                sx={{ borderRadius: 999 }}
              />
            </Box>
            <Button variant="contained" disabled={!answer.trim() || checking} onClick={() => void submit()}>
              {checking ? '判分中…' : '提交'}
            </Button>
          </>
        )}
        <Button onClick={onClose} color="inherit">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  )
}
