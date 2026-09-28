import { Box, Button, FormControlLabel, MenuItem, Slider, Stack, Switch, TextField, Typography } from '@mui/material'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import { PALETTES } from '../../theme/palettes'
import type { NavPosition } from '@shared/types'

export function AppearanceSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  if (!settings) return null
  const theme = settings.theme

  return (
    <>
      <Section title="配色方案" subtitle="Material Design 3 基于种子色生成整套色板">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ px: 2, pb: 2 }}>
          {PALETTES.map((palette) => {
            const active = theme.palette === palette.id
            return (
              <Button
                key={palette.id}
                size="small"
                variant={active ? 'contained' : 'outlined'}
                onClick={() => void patchSettings({ theme: { ...theme, palette: palette.id } })}
                sx={{ borderColor: palette.seed, color: active ? undefined : 'text.primary' }}
                startIcon={
                  <Box
                    className="dot"
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: palette.seed,
                      border: '2px solid',
                      borderColor: 'background.paper',
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.08)'
                    }}
                  />
                }
              >
                {palette.name}
              </Button>
            )
          })}
        </Stack>
      </Section>

      <Section title="显示" subtitle="明暗模式、信息密度与形状">
        <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="明暗模式"
              value={theme.mode}
              onChange={(event) => void patchSettings({ theme: { ...theme, mode: event.target.value as typeof theme.mode } })}
              sx={{ width: 170 }}
            >
              <MenuItem value="system">跟随系统</MenuItem>
              <MenuItem value="light">浅色</MenuItem>
              <MenuItem value="dark">深色</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="信息密度"
              value={theme.density}
              onChange={(event) =>
                void patchSettings({ theme: { ...theme, density: event.target.value as typeof theme.density } })
              }
              sx={{ width: 170 }}
            >
              <MenuItem value="comfortable">舒适</MenuItem>
              <MenuItem value="compact">紧凑</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="导航栏位置"
              value={theme.navPosition}
              onChange={(event) =>
                void patchSettings({ theme: { ...theme, navPosition: event.target.value as NavPosition } })
              }
              sx={{ width: 170 }}
            >
              <MenuItem value="left">居左（默认）</MenuItem>
              <MenuItem value="right">居右</MenuItem>
              <MenuItem value="top">顶部</MenuItem>
              <MenuItem value="bottom">底部</MenuItem>
            </TextField>
          </Stack>

          <Box sx={{ maxWidth: 360 }}>
            <Typography variant="caption" color="text.secondary">
              圆角 {theme.radius}（约 {theme.radius * 2}px）
            </Typography>
            <Slider
              size="small"
              min={0}
              max={14}
              value={Math.min(14, theme.radius)}
              onChange={(_event, value) => void patchSettings({ theme: { ...theme, radius: value as number } })}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={theme.touchOptimized}
                onChange={(event) => void patchSettings({ theme: { ...theme, touchOptimized: event.target.checked } })}
              />
            }
            label="触屏大按钮模式（为平板/触屏设备放大点击区域）"
          />
        </Stack>
      </Section>
    </>
  )
}
