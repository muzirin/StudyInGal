import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import PublishRoundedIcon from '@mui/icons-material/PublishRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import type { WorkshopManifest, WorkshopPackageType } from '@shared/types'

const PACKAGE_TYPES: WorkshopPackageType[] = ['character', 'gal-script', 'theme', 'textbook-pack', 'tool', 'bundle']

export function WorkshopPage() {
  const toast = useAppStore((state) => state.toast)
  const [installed, setInstalled] = useState<WorkshopManifest[]>([])
  const [validation, setValidation] = useState<{ ok: boolean; errors: string[] } | null>(null)
  const [form, setForm] = useState({
    id: '',
    name: '',
    version: '1.0.0',
    author: '',
    description: '',
    license: 'GPL-3.0-or-later',
    type: 'bundle' as WorkshopPackageType,
    baseUrl: '',
    entry: ''
  })
  const [include, setInclude] = useState<string[]>([])

  const refresh = async (): Promise<void> => setInstalled(await api.workshop.list())

  useEffect(() => {
    void refresh()
  }, [])

  const pickInclude = async (): Promise<void> => {
    const files = await api.dialogs.pickFiles({ multi: true })
    const folder = files.length === 0 ? await api.dialogs.pickDirectory() : null
    setInclude([...include, ...files, ...(folder ? [folder] : [])])
  }

  const doExport = async (): Promise<void> => {
    if (!form.id.trim()) {
      toast('warning', '请填写包 ID')
      return
    }
    if (include.length === 0) {
      toast('warning', '请至少选择一个要打包的文件或文件夹')
      return
    }
    const target = await api.dialogs.saveFile({ defaultPath: `${form.id}.sigpkg` })
    if (!target) return
    try {
      const result = await api.workshop.export({
        manifest: { ...form, entry: form.entry || null },
        target,
        include
      })
      toast('success', `已导出 ${result.fileCount} 个资源到 ${result.bundlePath}`)
      await refresh()
    } catch (error) {
      toast('error', `导出失败：${(error as Error).message}`)
    }
  }

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        创意工坊采用「自打包 + 自部署」模式：StudyInGal 只负责生成 <code>.sigpkg</code> 资源包并做完整性校验（SHA-256）。
        上传者需要自己把包部署到自己的对象存储 / CDN，并在 <code>baseUrl</code> 中填写分发地址。
      </Alert>

      <Section
        title="打包资源"
        subtitle="定义清单 → 选择文件 → 导出 .sigpkg"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={async () => {
                const target = await api.dialogs.saveFile({ defaultPath: 'study-in-gal-config.json' })
                if (!target) return
                const result = await api.workshop.exportConfig(target)
                toast('success', `已导出配置（${result.bytes} 字节，密钥已脱敏）`)
              }}
            >
              一键导出配置
            </Button>
            <Button size="small" startIcon={<VerifiedRoundedIcon />} onClick={async () => {
              const path = await api.dialogs.pickFiles({ filters: [{ name: '资源包', extensions: ['sigpkg'] }], multi: false })
              if (!path[0]) return
              const result = await api.workshop.validate(path[0])
              setValidation(result)
              toast(result.ok ? 'success' : 'error', result.ok ? '校验通过' : result.errors.join('；'))
            }}>
              校验包
            </Button>
            <Button size="small" variant="contained" startIcon={<PublishRoundedIcon />} onClick={() => void doExport()}>
              导出资源包
            </Button>
          </Stack>
        }
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, p: 2 }}>
          <TextField label="包 ID" value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} />
          <TextField label="名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="版本" value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} />
          <TextField label="作者" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} />
          <TextField select label="类型" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as WorkshopPackageType })}>
            {PACKAGE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="许可证" value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} />
          <TextField label="入口文件（可选）" value={form.entry} onChange={(event) => setForm({ ...form, entry: event.target.value })} />
          <TextField label="分发地址 baseUrl" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://cdn.example.com/pkgs" />
          <TextField label="描述" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pb: 2 }} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" onClick={() => void pickInclude()}>
            添加文件 / 文件夹
          </Button>
          {include.map((item) => (
            <Chip key={item} size="small" label={item.split(/[\\/]/).pop()} onDelete={() => setInclude(include.filter((entry) => entry !== item))} />
          ))}
        </Stack>
      </Section>

      {validation ? (
        <Alert severity={validation.ok ? 'success' : 'error'}>
          {validation.ok ? '资源包校验通过，可以分发。' : validation.errors.join('；')}
        </Alert>
      ) : null}

      <Section
        title={`已安装资源 · ${installed.length}`}
        subtitle="安装后会出现在角色库 / 主题 / 剧本等对应位置"
        action={
          <Button
            size="small"
            variant="contained"
            startIcon={<DownloadRoundedIcon />}
            onClick={async () => {
              const path = await api.dialogs.pickFiles({ filters: [{ name: '资源包', extensions: ['sigpkg'] }], multi: false })
              if (!path[0]) return
              const result = await api.workshop.install(path[0])
              toast(result.ok ? 'success' : 'error', result.message)
              await refresh()
            }}
          >
            安装资源包
          </Button>
        }
      >
        {installed.length === 0 ? (
          <EmptyState title="还没有安装资源包" description="安装后可以在这里管理，资源会保存在用户数据目录的 workshop 下。" />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2, p: 2 }}>
            {installed.map((manifest) => (
              <Card key={`${manifest.id}@${manifest.version}`} elevation={0}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {manifest.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {manifest.type} · v{manifest.version} · {manifest.author}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }} noWrap>
                    {manifest.description || '（无描述）'}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={`${manifest.assets.length} 资源`} />
                    <Chip size="small" label={manifest.license} />
                  </Stack>
                  <Button size="small" color="inherit" startIcon={<DeleteRoundedIcon />} sx={{ mt: 1 }} onClick={() => void refresh()}>
                    刷新
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Section>
    </Stack>
  )
}
