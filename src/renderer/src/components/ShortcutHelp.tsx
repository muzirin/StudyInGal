import { useState } from 'react'
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded'

const GROUPS: { title: string; items: { keys: string; label: string }[] }[] = [
  {
    title: '全局',
    items: [
      { keys: 'Ctrl + K', label: '打开命令面板（跳转 / 执行操作）' },
      { keys: 'Ctrl + Shift + K', label: '一键询问伴学娘' },
      { keys: 'Ctrl + ,', label: '打开设置' },
      { keys: 'Alt + 1…9', label: '快速切换到常用 / 前九个模块' },
      { keys: 'Esc', label: '关闭当前弹窗 / 面板' },
      { keys: 'F12', label: '开发者工具（仅开发者模式）' }
    ]
  },
  {
    title: '阅读与编辑',
    items: [
      { keys: 'Ctrl + S', label: '保存当前编辑内容' },
      { keys: '选中文字', label: '浮动菜单：询问 / 引用到黑板笔记' },
      { keys: 'Ctrl + Enter', label: '保存黑板笔记草稿' }
    ]
  },
  {
    title: '伴学娘与 Galgame',
    items: [
      { keys: 'Ctrl + Enter', label: '发送对话消息' },
      { keys: '空格 / 点击正文', label: '推进到下一句台词' },
      { keys: 'F 或 F11', label: 'Galgame 全屏游玩（隐藏导航与标题栏）' },
      { keys: 'Esc', label: '退出全屏 / 关闭弹窗' },
      { keys: '自动播放', label: '按节奏自动推进剧本' }
    ]
  }
]

export function ShortcutHelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip title="键盘快捷键">
        <IconButton className="no-drag" size="small" onClick={() => setOpen(true)}>
          <KeyboardRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>键盘快捷键</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {GROUPS.map((group) => (
              <Box key={group.title}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  {group.title}
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={1}>
                  {group.items.map((item) => (
                    <Stack key={item.keys} direction="row" spacing={2} alignItems="center">
                      <Chip size="small" variant="outlined" label={item.keys} sx={{ minWidth: 150, fontFamily: 'monospace' }} />
                      <Typography variant="body2" color="text.secondary">
                        {item.label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
            <Typography variant="caption" color="text.disabled">
              提示：在 macOS 上请将 Ctrl 替换为 Command。
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  )
}
