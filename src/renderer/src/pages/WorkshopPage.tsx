import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import PublishRoundedIcon from '@mui/icons-material/PublishRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import SettingsSuggestRoundedIcon from '@mui/icons-material/SettingsSuggestRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatBytes, formatDateTime } from '../lib/format'
import type { WorkshopManifest, WorkshopPackageType } from '@shared/types'

const PACKAGE_TYPES: WorkshopPackageType[] = ['character', 'gal-script', 'theme', 'textbook-pack', 'tool', 'bundle']

const TYPE_LABEL: Record<WorkshopPackageType, string> = {
  character: '角色包',
  'gal-script': '剧本包',
  theme: '主题包',
  'textbook-pack': '教材包',
  tool: '工具',
  bundle: '合集'
}

type Panel = 'publish' | 'install' | 'installed' | 'config'

export function WorkshopPage() {
  const theme = useTheme()
  const toast = useAppStore((state) => state.toast)
  const compact = useMediaQuery('(max-width: 1100px)')

  const [panel, setPanel] = useState<Panel>('publish')
  const [installed, setInstalled] = useState<WorkshopManifest[]>([])
  const [validation, setValidation] = useState<{ ok: boolean; errors: string[] } | null>(null)
  const [installPath, setInstallPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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
      const result = await api.workshop.export({ manifest: { ...form, entry: form.entry || null }, target, include })
      toast('success', `已导出 ${result.fileCount} 个资源到 ${result.bundlePath}`)
      await refresh()
    } catch (error) {
      toast('error', `导出失败：${(error as Error).message}`)
    }
  }

  const filteredInstalled = installed.filter((manifest) =>
    query.trim() ? `${manifest.name} ${manifest.author} ${manifest.id}`.toLowerCase().includes(query.trim().toLowerCase()) : true
  )

  const panelNav = (
    <List dense disablePadding>
      {(
        [
          { id: 'publish' as Panel, label: '打包发布', hint: '导出 .sigpkg', icon: <PublishRoundedIcon fontSize="small" /> },
          { id: 'install' as Panel, label: '安装资源', hint: '校验并安装', icon: <DownloadRoundedIcon fontSize="small" /> },
          { id: 'installed' as Panel, label: '已安装', hint: `${installed.length} 个`, icon: <InventoryRoundedIcon fontSize="small" /> },
          { id: 'config' as Panel, label: '配置导出', hint: '脱敏迁移配置', icon: <SettingsSuggestRoundedIcon fontSize="small" /> }
        ]
      ).map((item) => (
        <ListItemButton
          key={item.id}
          selected={item.id === panel}
          onClick={() => setPanel(item.id)}
          sx={{ borderRadius: 2, mb: 0.5, minHeight: 46, '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.14) } }}
        >
          <ListItemIcon sx={{ minWidth: 34, color: item.id === panel ? 'primary.main' : 'text.secondary' }}>{item.icon}</ListItemIcon>
          <ListItemText
            primary={item.label}
            secondary={item.hint}
            primaryTypographyProps={{ variant: 'body2', fontWeight: item.id === panel ? 700 : 500 }}
            secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
          />
        </ListItemButton>
      ))}
    </List>
  )

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '228px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
      {compact ? (
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }} className="sig-scroll-thin">
          {(
            [
              ['publish', '打包发布'],
              ['install', '安装资源'],
              ['installed', '已安装'],
              ['config', '配置导出']
            ] as [Panel, string][]
          ).map(([id, label]) => (
            <Chip key={id} label={label} clickable color={panel === id ? 'primary' : 'default'} variant={panel === id ? 'filled' : 'outlined'} onClick={() => setPanel(id)} />
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            position: 'sticky',
            top: 8,
            p: 1,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7)
          }}
        >
          <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ pl: 1.5, py: 1, display: 'block' }}>
            创意工坊
          </Typography>
          {panelNav}
        </Box>
      )}

      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Alert severity="info">
          创意工坊采用「自打包 + 自部署」模式：StudyInGal 只负责生成 <code>.sigpkg</code> 资源包并做 SHA-256 完整性校验，
          上传者需要自己把包部署到对象存储 / CDN，并在 <code>baseUrl</code> 中填写分发地址。
        </Alert>

        {panel === 'publish' ? (
          <Section
            title="打包资源包"
            subtitle="填写清单 → 选择文件 → 导出 .sigpkg"
            action={
              <Button size="small" variant="contained" startIcon={<PublishRoundedIcon />} onClick={() => void doExport()}>
                导出资源包
              </Button>
            }
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, p: 2 }}>
              <TextField label="包 ID" value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} helperText="英文 / 数字 / 连字符" />
              <TextField label="名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <TextField label="版本" value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} />
              <TextField label="作者" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} />
              <TextField select label="类型" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as WorkshopPackageType })}>
                {PACKAGE_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {TYPE_LABEL[type]}（{type}）
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="许可证" value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} />
              <TextField label="入口文件（可选）" value={form.entry} onChange={(event) => setForm({ ...form, entry: event.target.value })} />
              <TextField label="分发地址 baseUrl" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://cdn.example.com/pkgs" />
              <TextField label="描述" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Box>
            <Divider sx={{ mx: 2 }} />
            <Stack spacing={1.5} sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" onClick={() => void pickInclude()}>
                  添加文件 / 文件夹
                </Button>
                {include.length > 0 ? (
                  <Button size="small" color="inherit" onClick={() => setInclude([])}>
                    清空选择
                  </Button>
                ) : null}
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {include.length === 0 ? (
                  <Typography variant="caption" color="text.disabled">
                    还没有选择任何文件
                  </Typography>
                ) : (
                  include.map((item) => (
                    <Chip key={item} size="small" label={item.split(/[\\/]/).pop()} onDelete={() => setInclude(include.filter((entry) => entry !== item))} />
                  ))
                )}
              </Stack>
              <Typography variant="caption" color="text.disabled">
                资源包会记录每个文件的 SHA-256 与大小；安装方会逐项校验，避免损坏或被篡改。
              </Typography>
            </Stack>
          </Section>
        ) : null}

        {panel === 'install' ? (
          <Section
            title="安装资源包"
            subtitle="支持先校验再安装"
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<VerifiedRoundedIcon />}
                  onClick={async () => {
                    const path = await api.dialogs.pickFiles({ filters: [{ name: '资源包', extensions: ['sigpkg'] }], multi: false })
                    if (!path[0]) return
                    const result = await api.workshop.validate(path[0])
                    setValidation(result)
                    toast(result.ok ? 'success' : 'error', result.ok ? '校验通过' : result.errors.join('；'))
                  }}
                >
                  仅校验
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<DownloadRoundedIcon />}
                  onClick={async () => {
                    const path = await api.dialogs.pickFiles({ filters: [{ name: '资源包', extensions: ['sigpkg'] }], multi: false })
                    if (!path[0]) return
                    const result = await api.workshop.install(path[0])
                    toast(result.ok ? 'success' : 'error', result.message)
                    if (result.ok) {
                      setInstallPath(path[0])
                      await refresh()
                    }
                  }}
                >
                  安装
                </Button>
              </Stack>
            }
          >
            <Stack spacing={2} sx={{ p: 2 }}>
              {validation ? (
                <Alert severity={validation.ok ? 'success' : 'error'}>
                  {validation.ok ? '资源包校验通过，可以安全安装。' : validation.errors.join('；')}
                </Alert>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  选择 <code>.sigpkg</code> 文件后，会先校验清单中每个资源的 SHA-256 与大小，再解压到用户数据目录的 <code>workshop/</code> 下。
                </Typography>
              )}
              {installPath ? (
                <Typography variant="caption" color="text.disabled">
                  最近安装来源：{installPath}
                </Typography>
              ) : null}
            </Stack>
          </Section>
        ) : null}

        {panel === 'installed' ? (
          <Section
            title={`已安装资源 · ${installed.length}`}
            subtitle="安装后可在角色管理、主题、剧本等位置使用"
            action={
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  placeholder="搜索已安装资源"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                  sx={{ width: 200 }}
                />
                <Button size="small" onClick={() => void refresh()}>
                  刷新
                </Button>
              </Stack>
            }
          >
            {filteredInstalled.length === 0 ? (
              <EmptyState
                title={installed.length === 0 ? '还没有安装资源包' : '没有匹配的资源包'}
                description="安装的资源会保存在用户数据目录的 workshop 下，卸载应用不会自动删除。"
              />
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2, p: 2 }}>
                {filteredInstalled.map((manifest) => (
                  <Card key={`${manifest.id}@${manifest.version}`} elevation={0}>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flexGrow: 1 }}>
                          {manifest.name}
                        </Typography>
                        <Chip size="small" label={TYPE_LABEL[manifest.type] ?? manifest.type} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {manifest.id} · v{manifest.version} · {manifest.author}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, minHeight: 40 }} noWrap>
                        {manifest.description || '（无描述）'}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                        <Chip size="small" label={`${manifest.assets.length} 资源`} />
                        <Chip size="small" variant="outlined" label={formatBytes(manifest.assets.reduce((acc, asset) => acc + asset.sizeBytes, 0))} />
                        <Chip size="small" variant="outlined" label={manifest.license} />
                      </Stack>
                      <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
                        打包于 {formatDateTime(manifest.createdAt)}
                      </Typography>
                      {manifest.baseUrl ? (
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<OpenInNewRoundedIcon />}
                          sx={{ mt: 1 }}
                          onClick={() => void api.app.openExternal(manifest.baseUrl)}
                        >
                          打开分发地址
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Section>
        ) : null}

        {panel === 'config' ? (
          <Section
            title="一键导出配置"
            subtitle="设置、角色与云盘挂载（自动脱敏 API Key / 密码 / Cookie）"
            action={
              <Button
                size="small"
                variant="contained"
                startIcon={<FileDownloadRoundedIcon />}
                onClick={async () => {
                  const target = await api.dialogs.saveFile({ defaultPath: 'study-in-gal-config.json' })
                  if (!target) return
                  const result = await api.workshop.exportConfig(target)
                  toast('success', `已导出配置（${formatBytes(result.bytes)}）`)
                }}
              >
                导出配置
              </Button>
            }
          >
            <Stack spacing={2} sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                导出的 JSON 包含：外观与导航偏好、API 提供商（Key 以 <code>__REDACTED__</code> 占位）、
                角色卡、云盘挂载（密码与 Cookie 脱敏）。适合换机迁移或分享一份起始配置。
              </Typography>
              <Alert severity="warning" icon={false}>
                导出文件仍包含模型名称、服务地址等非敏感信息，分享前请自行确认。
              </Alert>
            </Stack>
          </Section>
        ) : null}
      </Stack>
    </Box>
  )
}
