import { FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'

export function QuizSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  if (!settings) return null
  const quiz = settings.quiz

  return (
    <>
      <Section title="随堂问答" subtitle="读论文/教材或游玩 Gal 时出题，检验是否真的理解">
        <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={quiz.autoAtSceneEnd}
                onChange={(event) => void patchSettings({ quiz: { ...quiz, autoAtSceneEnd: event.target.checked } })}
              />
            }
            label="每读完一幕自动出题（Gal 播放时）"
          />
          <TextField
            select
            size="small"
            label="每组题目数量"
            value={quiz.count}
            onChange={(event) => void patchSettings({ quiz: { ...quiz, count: Number(event.target.value) } })}
            sx={{ width: 200 }}
          >
            {[1, 2, 3, 5, 8].map((value) => (
              <MenuItem key={value} value={value}>
                {value} 题
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            客观题由本地判分（不消耗额度），简答题交给模型批改。出题需要一个可用的 AI 提供商
            （在「API 与语音」里配置，能力路由用「对话 / 问答」）。阅读器右上角也有「出题」入口。
          </Typography>
        </Stack>
      </Section>

      <Section title="答题记录" subtitle="所有作答都保存在本机 quizzes.json">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            记录包含题目、你的作答与判定结果，可在后续版本里做错题本与复习队列。
          </Typography>
        </Stack>
      </Section>
    </>
  )
}
