import { Button, Divider, Stack, Typography, Box } from '@mui/material'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import { GITHUB_URL } from '@shared/constants'

export function AboutSection() {
  const info = useAppStore((state) => state.info)
  const settings = useAppStore((state) => state.settings)
  const resetSettings = useAppStore((state) => state.resetSettings)
  const toast = useAppStore((state) => state.toast)

  return (
    <>
      <Section title="版本信息" subtitle={info ? `${info.name} ${info.version}` : '读取中…'}>
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
        </Stack>
      </Section>

      <Section title="开源许可" subtitle="GPL-3.0-or-later">
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            本软件以 GPL-3.0 许可发布；「论文转 Galgame」的产品灵感来自 Nova42x/paper2galgame，与此处的实现相互独立。
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
              void settings
            }}
          >
            恢复默认设置
          </Button>
        </Stack>
      </Section>
    </>
  )
}
