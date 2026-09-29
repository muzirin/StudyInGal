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
      <Section title="阶段性检测" subtitle="读论文/教材或游玩 Gal 时，按进度穿插出题检验理解">
        <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={quiz.autoAtSceneEnd}
                onChange={(event) => void patchSettings({ quiz: { ...quiz, autoAtSceneEnd: event.target.checked } })}
              />
            }
            label="读到题目的锚点位置自动检测（Gal 播放时）"
          />
          <FormControlLabel
            control={
              <Switch
                checked={quiz.generateAtCheckpoint ?? false}
                onChange={(event) => void patchSettings({ quiz: { ...quiz, generateAtCheckpoint: event.target.checked } })}
              />
            }
            label="到检测点时用「已读内容」现场出题（严格循序渐进）"
          />
          <TextField
            select
            size="small"
            label="每次最多几题"
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
            题目随剧本一起生成，并锚定到对应段落：读到该段落后再检测，学到哪里问到哪里，不会一次问完、也不会问后面还没讲到的内容。
            打开上面的「现场出题」后，每个检测点只把已经读过的台词交给模型现出题（更严格，但每个检测点多一次调用）。
            旧剧本没有锚点时会退化为「每幕一批」。客观题本地判分（不消耗额度），简答题交给模型批改。
            出题需要一个可用的 AI 提供商（在「API 与语音」里配置，能力路由用「对话 / 问答」）。
            阅读器里每节末尾也有「检测本节」入口。
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
