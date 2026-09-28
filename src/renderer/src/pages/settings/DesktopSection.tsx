import { Alert, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'

export function DesktopSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const info = useAppStore((state) => state.info)
  const toast = useAppStore((state) => state.toast)
  if (!settings) return null

  const desktop = settings.desktop

  return (
    <>
      <Section title="系统托盘" subtitle="常驻托盘可以让你收起窗口后继续收到主动搭话与同步提示">
        <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
          <FormControlLabel
            control={
              <Switch checked={desktop.trayEnabled} onChange={(event) => void patchSettings({ desktop: { ...desktop, trayEnabled: event.target.checked } })} />
            }
            label="在系统托盘显示图标"
          />
          <FormControlLabel
            control={
              <Switch
                disabled={!desktop.trayEnabled}
                checked={desktop.closeToTray}
                onChange={(event) => void patchSettings({ desktop: { ...desktop, closeToTray: event.target.checked } })}
              />
            }
            label="点击关闭按钮时最小化到托盘（而不是退出）"
          />
          {desktop.closeToTray ? (
            <Alert severity="info" icon={false}>
              启用后请使用托盘菜单的「退出」来完全关闭应用。
            </Alert>
          ) : null}
        </Stack>
      </Section>

      <Section title="全局快捷键" subtitle="在任何应用中都可以唤出并打开一键询问">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              label="快捷键"
              value={desktop.globalAskShortcut}
              onChange={(event) => void patchSettings({ desktop: { ...desktop, globalAskShortcut: event.target.value } })}
              helperText="Electron Accelerator 语法，例如 CommandOrControl+Shift+Space"
              sx={{ maxWidth: 400 }}
              fullWidth
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => void patchSettings({ desktop: { ...desktop, globalAskShortcut: 'CommandOrControl+Shift+Space' } })}
            >
              恢复默认
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            若快捷键被其他软件占用，注册会失败并在控制台给出提示；这里留空可关闭全局快捷键。
          </Typography>
        </Stack>
      </Section>

      <Section title="应用与窗口" subtitle={info ? `${info.platform} ${info.arch} · Electron ${info.electron}` : ''}>
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAltRoundedIcon />}
            onClick={() => void api.app.relaunch()}
          >
            重启应用
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={async () => {
              await api.app.window('close')
              toast('info', '已请求关闭窗口（若开启托盘则最小化到托盘）')
            }}
          >
            关闭窗口
          </Button>
        </Stack>
      </Section>
    </>
  )
}
