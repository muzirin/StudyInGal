import { Alert, Box, Button, FormControlLabel, Slider, Stack, Switch, TextField, Typography } from '@mui/material'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'

export function Live2dSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  if (!settings) return null
  const live2d = settings.live2d

  return (
    <Section title="Live2D 运行时" subtitle="模型文件按角色单独配置（角色管理 → Live2D）">
      <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
        <Alert severity="info">
          Cubism Core 与运行库受各自许可约束，不随安装包分发。安装 <code>pixi.js</code> 与{' '}
          <code>pixi-live2d-display</code> 后开启本项即可在首页与伴学娘页面渲染模型；未安装时回退为静态立绘。
        </Alert>

        <FormControlLabel
          control={<Switch checked={live2d.enabled} onChange={(event) => void patchSettings({ live2d: { ...live2d, enabled: event.target.checked } })} />}
          label="启用 Live2D 渲染"
        />

        <TextField
          size="small"
          label="Cubism Core 脚本地址"
          placeholder="https://your-cdn.example.com/live2dcubismcore.min.js"
          value={live2d.coreUrl}
          onChange={(event) => void patchSettings({ live2d: { ...live2d, coreUrl: event.target.value } })}
          helperText="Cubism Core 由 Live2D Inc. 授权，需自行获取并托管；留空则尝试使用页面已加载的 Live2DCubismCore。"
          fullWidth
        />

        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
          <Box sx={{ width: 200 }}>
            <Typography variant="caption" color="text.secondary">
              缩放 {live2d.scale.toFixed(2)}
            </Typography>
            <Slider
              size="small"
              min={0.4}
              max={2.5}
              step={0.05}
              value={live2d.scale}
              onChange={(_event, value) => void patchSettings({ live2d: { ...live2d, scale: value as number } })}
            />
          </Box>
          <Box sx={{ width: 200 }}>
            <Typography variant="caption" color="text.secondary">
              水平位置 {live2d.x.toFixed(2)}
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.01}
              value={live2d.x}
              onChange={(_event, value) => void patchSettings({ live2d: { ...live2d, x: value as number } })}
            />
          </Box>
          <Box sx={{ width: 200 }}>
            <Typography variant="caption" color="text.secondary">
              垂直位置 {live2d.y.toFixed(2)}
            </Typography>
            <Slider
              size="small"
              min={-1}
              max={1}
              step={0.01}
              value={live2d.y}
              onChange={(_event, value) => void patchSettings({ live2d: { ...live2d, y: value as number } })}
            />
          </Box>
          <Box sx={{ width: 200 }}>
            <Typography variant="caption" color="text.secondary">
              不透明度 {live2d.opacity.toFixed(2)}
            </Typography>
            <Slider
              size="small"
              min={0.2}
              max={1}
              step={0.05}
              value={live2d.opacity}
              onChange={(_event, value) => void patchSettings({ live2d: { ...live2d, opacity: value as number } })}
            />
          </Box>
        </Stack>

        <Box>
          <Button size="small" variant="outlined" onClick={() => void api.app.openExternal('https://github.com/guansss/pixi-live2d-display')}>
            查看接入文档
          </Button>
        </Box>
      </Stack>
    </Section>
  )
}
