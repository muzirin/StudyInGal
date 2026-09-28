import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'

type ClearTarget = 'history' | 'conversations' | 'notes' | 'errors' | null

const CLEAR_LABEL: Record<Exclude<ClearTarget, null>, string> = {
  history: '历史记录',
  conversations: '伴学娘会话',
  notes: '黑板笔记',
  errors: '错误日志'
}

export function PrivacySection() {
  const info = useAppStore((state) => state.info)
  const toast = useAppStore((state) => state.toast)
  const [target, setTarget] = useState<ClearTarget>(null)
  const [stats, setStats] = useState<{ history: number; conversations: number; notes: number; errors: number } | null>(null)

  const refreshStats = async (): Promise<void> => {
    const [history, conversations, notes, errors] = await Promise.all([
      api.history.list().catch(() => []),
      api.conversations.list().catch(() => []),
      api.notes.list().catch(() => []),
      api.errors.list().catch(() => [])
    ])
    setStats({ history: history.length, conversations: conversations.length, notes: notes.length, errors: errors.length })
  }

  const runClear = async (): Promise<void> => {
    if (!target) return
    if (target === 'history') await api.history.clear()
    else if (target === 'conversations') {
      const list = await api.conversations.list()
      for (const conversation of list) await api.conversations.remove(conversation.id)
    } else if (target === 'notes') {
      // 逐条删除（按节点清空需要 nodeId，这里做全局清理）
      const list = await api.notes.list()
      for (const note of list) await api.notes.remove(note.id)
    } else await api.errors.clear()
    toast('success', `已清理${CLEAR_LABEL[target]}`)
    setTarget(null)
    await refreshStats()
  }

  return (
    <>
      <Section
        title="数据位置"
        subtitle="所有学习数据默认只保存在本机"
        action={
          <Button size="small" variant="outlined" startIcon={<FolderRoundedIcon />} onClick={() => info && void api.app.openPath(info.userDataPath)}>
            打开目录
          </Button>
        }
      >
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              用户数据目录
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {info?.userDataPath ?? '—'}
            </Typography>
          </Box>
          <Alert severity="info" icon={false}>
            数据目录下包含 <code>data/settings.json</code>、<code>data/library.json</code>、<code>data/conversations.json</code>、
            <code>data/notes.json</code>、<code>data/archive.json</code> 等。卸载应用不会自动删除该目录。
          </Alert>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={async () => {
                const target = await api.dialogs.saveFile({ defaultPath: 'study-in-gal-config.json' })
                if (!target) return
                const result = await api.workshop.exportConfig(target)
                toast('success', `已导出配置（${result.bytes} 字节，密钥已脱敏）`)
              }}
            >
              导出配置（脱敏）
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FolderRoundedIcon />}
              onClick={async () => {
                if (!info) return
                await navigator.clipboard.writeText(info.userDataPath).catch(() => undefined)
                toast('success', '数据目录路径已复制到剪贴板')
              }}
            >
              复制数据目录路径
            </Button>
          </Stack>
        </Stack>
      </Section>

      <Section
        title="清理本地数据"
        subtitle="仅删除本机记录，不会删除你的原始文献与云盘文件"
        action={
          <Button size="small" onClick={() => void refreshStats()}>
            刷新统计
          </Button>
        }
      >
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          {stats ? (
            <Typography variant="body2" color="text.secondary">
              历史 {stats.history} 条 · 会话 {stats.conversations} 个 · 笔记 {stats.notes} 条 · 错误 {stats.errors} 条
            </Typography>
          ) : (
            <Typography variant="caption" color="text.disabled">
              点击「刷新统计」查看当前记录数量
            </Typography>
          )}
          <Divider />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(Object.keys(CLEAR_LABEL) as Exclude<ClearTarget, null>[]).map((key) => (
              <Button key={key} size="small" color="warning" variant="outlined" startIcon={<DeleteSweepRoundedIcon />} onClick={() => setTarget(key)}>
                清空{CLEAR_LABEL[key]}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Section>

      <Dialog open={target !== null} onClose={() => setTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>确认清理</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            确定要清空「{target ? CLEAR_LABEL[target] : ''}」吗？该操作不可撤销，但不会影响你的原始文献文件与云盘内容。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>取消</Button>
          <Button color="warning" variant="contained" onClick={() => void runClear()}>
            确认清理
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
