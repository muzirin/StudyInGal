import { useState } from 'react'
import { Alert, Button, Divider, Stack, Typography, Box } from '@mui/material'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import { GITHUB_URL } from '@shared/constants'

export function AboutSection() {
  const info = useAppStore((state) => state.info)
  const toast = useAppStore((state) => state.toast)
  const resetSettings = useAppStore((state) => state.resetSettings)
  const [checking, setChecking] = useState(false)
  const [update, setUpdate] = useState<{ ok: boolean; hasUpdate: boolean; latest: string | null; url: string | null; message: string } | null>(null)

  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      const result = await api.app.checkUpdate()
      setUpdate(result)
      toast(result.hasUpdate ? 'info' : result.ok ? 'success' : 'warning', result.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <Section
        title="版本信息"
        subtitle={info ? `${info.name} ${info.version}` : '读取中…'}
        action={
          <Button size="small" variant="outlined" startIcon={<SystemUpdateAltRoundedIcon />} disabled={checking} onClick={() => void check()}>
            {checking ? '检查中…' : '检查更新'}
          </Button>
        }
      >
        <Stack spacing={1} sx={{ px: 2, pb: 2 }} divider={<Divider flexItem />}>
          {[
            ['版本', info?.version],
            ['Electron', info?.electron],
            ['Chromium', info?.chrome],
            ['Node', info?.node],
            ['平台', info ? `${info.platform} ${info.arch}` : ''],
            ['数据目录', info?.userDataPath]
          ].map(([label, value]) => (
            <Stack key={label} direction="row" spacing={2} sx={{ py: 0.75 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 100, flexShrink: 0 }}>
                {label}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {value ?? '—'}
              </Typography>
            </Stack>
          ))}
          {update ? (
            <Alert
              severity={update.hasUpdate ? 'info' : update.ok ? 'success' : 'warning'}
              sx={{ mt: 1 }}
              action={
                update.hasUpdate && update.url ? (
                  <Button size="small" endIcon={<OpenInNewRoundedIcon fontSize="inherit" />} onClick={() => void api.app.openExternal(update.url as string)}>
                    前往下载
                  </Button>
                ) : undefined
              }
            >
              {update.hasUpdate ? `发现新版本 ${update.latest}（当前 ${info?.version}）` : update.message}
            </Alert>
          ) : null}
        </Stack>
      </Section>

      <Section title="开源许可" subtitle="GPL-3.0-or-later">
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            本软件以 GPL-3.0 许可发布；「论文转 Galgame」的产品灵感来自 Nova42x/paper2galgame，与此处的实现相互独立。
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            内置素材署名：场景背景 by <strong>spiral atlas</strong>（CC-BY 3.0）· 立绘 by <strong>madameberry</strong>（CC0）。
            完整清单见 resources/assets/CREDITS.md。
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="contained" startIcon={<ScienceRoundedIcon />} onClick={() => void api.app.openExternal(GITHUB_URL)}>
              仓库主页
            </Button>
            <Button size="small" variant="outlined" startIcon={<BugReportRoundedIcon />} onClick={() => void api.errors.openIssue()}>
              反馈问题
            </Button>
            <Button size="small" variant="outlined" onClick={() => void api.app.openExternal(`${GITHUB_URL}/releases`)}>
              更新日志
            </Button>
            <Button size="small" variant="outlined" onClick={() => void api.app.openExternal(`${GITHUB_URL}/blob/main/docs/assets.md`)}>
              素材来源
            </Button>
            <Button size="small" variant="outlined" onClick={() => void api.app.openExternal(`${GITHUB_URL}/blob/main/resources/assets/CREDITS.md`)}>
              内置素材署名
            </Button>
          </Stack>
        </Box>
      </Section>

      <Section title="重置" subtitle="恢复所有设置为默认值（不会删除文献、剧本与存档）">
        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }}>
          <Button
            size="small"
            color="warning"
            variant="outlined"
            startIcon={<RestartAltRoundedIcon />}
            onClick={async () => {
              await resetSettings()
              toast('success', '已恢复默认设置')
            }}
          >
            恢复默认设置
          </Button>
        </Stack>
      </Section>
    </>
  )
}
