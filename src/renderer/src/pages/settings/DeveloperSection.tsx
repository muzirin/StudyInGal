import { Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'

export function DeveloperSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const info = useAppStore((state) => state.info)
  const toast = useAppStore((state) => state.toast)
  if (!settings) return null
  const developer = settings.developer
  const telemetry = settings.telemetry
  const playground = settings.playground

  return (
    <>
      <Section title="开发者模式" subtitle="解锁内嵌 CLI 终端与更详细的诊断信息">
        <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
          <FormControlLabel
            control={<Switch checked={developer.enabled} onChange={(event) => void patchSettings({ developer: { ...developer, enabled: event.target.checked } })} />}
            label="开启开发者模式（导航中出现「开发者模式」）"
          />
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              size="small"
              label="终端 Shell（留空自动检测）"
              value={developer.terminalShell}
              onChange={(event) => void patchSettings({ developer: { ...developer, terminalShell: event.target.value } })}
              sx={{ width: 300 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={developer.openDevToolsOnStart}
                  onChange={(event) => void patchSettings({ developer: { ...developer, openDevToolsOnStart: event.target.checked } })}
                />
              }
              label="启动时打开 DevTools"
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<FolderRoundedIcon />} onClick={() => info && void api.app.openPath(info.userDataPath)}>
              打开数据目录
            </Button>
            <Button size="small" variant="outlined" onClick={() => void api.app.devtools()}>
              打开 DevTools
            </Button>
          </Stack>
        </Stack>
      </Section>

      <Section title="错误采集与反馈" subtitle="错误只保存在本机；只有你点击汇报时才会把内容填入 GitHub Issue">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <FormControlLabel
            control={<Switch checked={telemetry.crashReporting} onChange={(event) => void patchSettings({ telemetry: { ...telemetry, crashReporting: event.target.checked } })} />}
            label="本地记录运行错误"
          />
          <FormControlLabel
            control={<Switch checked={telemetry.autoIssueDraft} onChange={(event) => void patchSettings({ telemetry: { ...telemetry, autoIssueDraft: event.target.checked } })} />}
            label="生成 Issue 草稿时附带错误日志"
          />
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<BugReportRoundedIcon />}
              onClick={async () => {
                const count = (await api.errors.list()).length
                toast('info', `当前已记录 ${count} 条错误，可在「开发者模式 → 错误与反馈」查看`)
              }}
            >
              查看错误数量
            </Button>
            <Button size="small" variant="outlined" onClick={() => void api.errors.openIssue()}>
              打开 Issue 页面
            </Button>
          </Stack>
        </Stack>
      </Section>

      <Section title="代码练习场" subtitle="默认不安装，需要时从 GitHub 拉取扩展环境">
        <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            当前状态：{playground.installed ? '已安装' : '未安装'}
            {playground.installPath ? ` · ${playground.installPath}` : ''}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FolderRoundedIcon />}
              onClick={async () => {
                const dir = await api.dialogs.pickDirectory()
                if (dir) void patchSettings({ playground: { ...playground, installPath: dir } })
              }}
            >
              选择安装目录
            </Button>
          </Stack>
        </Stack>
      </Section>

      <Section title="自动化截图" subtitle="用于视觉回归与问题排查" action={<PhotoCameraRoundedIcon fontSize="small" color="disabled" />}>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            通过环境变量 <code>SIG_CAPTURE_PATH</code> 与 <code>SIG_CAPTURE_ROUTE</code> 启动应用，可自动截取指定页面并退出；
            仓库内提供了 <code>scripts/capture-screens.ps1</code> 批量截图脚本。
          </Typography>
        </Box>
      </Section>
    </>
  )
}
