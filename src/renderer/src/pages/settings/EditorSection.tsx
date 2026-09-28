import { Box, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'

export function EditorSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  if (!settings) return null
  const editor = settings.editor
  const library = settings.library

  return (
    <>
      <Section title="编辑器" subtitle="Markdown / LaTeX 源码编辑体验">
        <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              label="等宽字体"
              value={editor.fontFamily}
              onChange={(event) => void patchSettings({ editor: { ...editor, fontFamily: event.target.value } })}
              sx={{ width: 300 }}
            />
            <TextField
              size="small"
              type="number"
              label="字号"
              value={editor.fontSize}
              onChange={(event) => void patchSettings({ editor: { ...editor, fontSize: Number(event.target.value) || 15 } })}
              sx={{ width: 120 }}
            />
            <TextField
              size="small"
              type="number"
              label="自动保存延迟（毫秒）"
              value={editor.autosaveMs}
              onChange={(event) => void patchSettings({ editor: { ...editor, autosaveMs: Number(event.target.value) || 1500 } })}
              sx={{ width: 200 }}
            />
          </Stack>
          <FormControlLabel
            control={<Switch checked={editor.autosave} onChange={(event) => void patchSettings({ editor: { ...editor, autosave: event.target.checked } })} />}
            label="启用自动保存（Ctrl+S 随时手动保存）"
          />
        </Stack>
      </Section>

      <Section title="OCR 与文档解析" subtitle="本地优先：Tesseract.js，首次运行会下载语言包">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
            <TextField
              size="small"
              label="OCR 语言包"
              value={library.ocrLanguage}
              onChange={(event) => void patchSettings({ library: { ...library, ocrLanguage: event.target.value } })}
              helperText="例如 chi_sim+eng"
              sx={{ width: 240 }}
            />
            <FormControlLabel
              control={<Switch checked={library.autoOcr} onChange={(event) => void patchSettings({ library: { ...library, autoOcr: event.target.checked } })} />}
              label="导入扫描件后自动 OCR"
            />
          </Stack>
        </Stack>
      </Section>

      <Section title="库目录" subtitle="用于集中存放扫描文本、合并导出与本地同步缓存">
        <Stack spacing={1.5} sx={{ px: 2, pb: 2 }}>
          {(
            [
              { key: 'paper', label: '论文库根目录' },
              { key: 'textbook', label: '教材库根目录' }
            ] as const
          ).map((item) => (
            <Box key={item.key}>
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                  {library.roots[item.key] || '未设置'}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<FolderRoundedIcon />}
                  onClick={async () => {
                    const dir = await api.dialogs.pickDirectory()
                    if (dir) void patchSettings({ library: { ...library, roots: { ...library.roots, [item.key]: dir } } })
                  }}
                >
                  选择
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Section>
    </>
  )
}
