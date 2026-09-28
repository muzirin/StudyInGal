import { useEffect, useState } from 'react'
import { FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import type { Character } from '@shared/types'

export function CompanionSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const [characters, setCharacters] = useState<Character[]>([])

  useEffect(() => {
    void api.characters.list().then(setCharacters).catch(() => undefined)
  }, [])

  if (!settings) return null
  const companion = settings.companion

  return (
    <>
      <Section title="默认伴学娘" subtitle="首页问候、一键询问与主动搭话都会优先使用该角色">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <TextField
            select
            size="small"
            label="角色"
            value={companion.activeCharacterId ?? ''}
            onChange={(event) => void patchSettings({ companion: { ...companion, activeCharacterId: event.target.value || null } })}
            sx={{ maxWidth: 320 }}
          >
            <MenuItem value="">自动（第一个角色）</MenuItem>
            {characters.map((character) => (
              <MenuItem key={character.id} value={character.id}>
                {character.avatar} {character.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Section>

      <Section title="主动搭话" subtitle="按间隔结合你的学习数据主动发起对话">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <FormControlLabel
            control={<Switch checked={companion.proactive} onChange={(event) => void patchSettings({ companion: { ...companion, proactive: event.target.checked } })} />}
            label="启用主动搭话"
          />
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              size="small"
              type="number"
              label="间隔（分钟，最小 5）"
              value={companion.proactiveIntervalMinutes}
              onChange={(event) =>
                void patchSettings({
                  companion: { ...companion, proactiveIntervalMinutes: Math.max(5, Number(event.target.value) || 45) }
                })
              }
              sx={{ width: 190 }}
            />
            <FormControlLabel
              control={
                <Switch checked={companion.showBubbles} onChange={(event) => void patchSettings({ companion: { ...companion, showBubbles: event.target.checked } })} />
              }
              label="用语音朗读回复"
            />
          </Stack>
          <TextField
            label="主动搭话提示词"
            multiline
            minRows={3}
            value={companion.proactivePrompt}
            onChange={(event) => void patchSettings({ companion: { ...companion, proactivePrompt: event.target.value } })}
            helperText="每次触发时会附带你的论文 / 教材 / 存档 / 待办数量作为上下文"
          />
        </Stack>
      </Section>
    </>
  )
}
