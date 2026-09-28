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
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import WifiTetheringRoundedIcon from '@mui/icons-material/WifiTetheringRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import CloudRoundedIcon from '@mui/icons-material/CloudRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatDateTime, formatRelative } from '../lib/format'
import type { CloudEntry, CloudKind, CloudMount } from '@shared/types'

const KIND_FIELDS: Record<CloudKind, { key: string; label: string; type?: string; placeholder?: string }[]> = {
  local: [{ key: 'root', label: '本地目录', placeholder: 'D:\\StudyInGalSync' }],
  webdav: [
    { key: 'url', label: 'WebDAV 地址', placeholder: 'https://dav.example.com/remote.php/dav/files/user' },
    { key: 'username', label: '用户名' },
    { key: 'password', label: '密码', type: 'password' },
    { key: 'basePath', label: '子目录', placeholder: '/StudyInGal' }
  ],
  smb: [
    { key: 'share', label: '共享路径', placeholder: '\\\\server\\share' },
    { key: 'domain', label: '域（可选）' },
    { key: 'username', label: '用户名' },
    { key: 'password', label: '密码', type: 'password' },
    { key: 'basePath', label: '子目录', placeholder: 'StudyInGal' }
  ],
  quark: [
    { key: 'cookie', label: '登录 Cookie', placeholder: '浏览器 F12 → Network 复制 Cookie' },
    { key: 'rootFid', label: '根目录 fid', placeholder: '留空表示根目录 0' },
    { key: 'baseUrl', label: '接口地址', placeholder: 'https://drive-pc.quark.cn' }
  ]
}

interface SyncLog {
  id: string
  mountName: string
  at: number
  uploaded: number
  downloaded: number
  skipped: number
  conflicts: number
  ok: boolean
  message: string
}

type Panel = 'mounts' | 'log' | 'auto'

export function CloudPage() {
  const theme = useTheme()
  const toast = useAppStore((state) => state.toast)
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const compact = useMediaQuery('(max-width: 1100px)')

  const [panel, setPanel] = useState<Panel>('mounts')
  const [mounts, setMounts] = useState<CloudMount[]>([])
  const [log, setLog] = useState<SyncLog[]>([])
  const [draft, setDraft] = useState<(Partial<CloudMount> & { kind: CloudKind }) | null>(null)
  const [browsing, setBrowsing] = useState<{ mountId: string; path: string; entries: CloudEntry[] } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    setMounts(await api.cloud.list())
    setLog((await api.cloud.log().catch(() => [])) as SyncLog[])
  }

  useEffect(() => {
    void refresh()
    const unsubscribe = api.events.subscribe((event) => {
      const typed = event as { type: string; payload: Record<string, unknown> }
      if (typed.type === 'sync-progress') {
        setProgress(`${String(typed.payload.phase)} ${typed.payload.current}/${typed.payload.total}`)
      }
    })
    return unsubscribe
  }, [])

  const saveMount = async (): Promise<void> => {
    if (!draft) return
    const saved = await api.cloud.upsert(draft)
    setDraft(null)
    await refresh()
    toast('success', `已保存挂载：${saved.name}`)
  }

  if (!settings) return null

  const panelNav = (
    <List dense disablePadding>
      {(
        [
          { id: 'mounts' as Panel, label: '云盘挂载', hint: `${mounts.length} 个`, icon: <CloudRoundedIcon fontSize="small" /> },
          { id: 'auto' as Panel, label: '自动同步', hint: settings.sync.autoSync ? `${settings.sync.intervalMinutes} 分钟` : '未开启', icon: <ScheduleRoundedIcon fontSize="small" /> },
          { id: 'log' as Panel, label: '同步日志', hint: `${log.length} 条`, icon: <HistoryRoundedIcon fontSize="small" /> }
        ]
      ).map((item) => (
        <ListItemButton
          key={item.id}
          selected={item.id === panel}
          onClick={() => setPanel(item.id)}
          sx={{
            borderRadius: 3,
            mb: 0.5,
            minHeight: 46,
            '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.14) }
          }}
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
          {(['mounts', 'auto', 'log'] as Panel[]).map((id) => (
            <Chip
              key={id}
              label={id === 'mounts' ? '云盘挂载' : id === 'auto' ? '自动同步' : '同步日志'}
              clickable
              color={panel === id ? 'primary' : 'default'}
              variant={panel === id ? 'filled' : 'outlined'}
              onClick={() => setPanel(id)}
            />
          ))}
        </Stack>
      ) : (
        <Box
          sx={{
            position: 'sticky',
            top: 8,
            p: 1,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.7)
          }}
        >
          <Typography variant="caption" fontWeight={700} letterSpacing={1} color="text.disabled" sx={{ pl: 1.5, py: 1, display: 'block' }}>
            云盘与同步
          </Typography>
          {panelNav}
        </Box>
      )}

      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Alert severity="warning" icon={false}>
          夸克网盘适配器为实验性实现（基于网页端接口，需自行提供 Cookie），目前支持浏览与下载；上传请使用 WebDAV 或 SMB。
        </Alert>

        {panel === 'auto' ? (
          <Section title="自动同步" subtitle="应用启动后按间隔自动同步已启用挂载，结果会记录到同步日志">
            <Stack spacing={2.5} sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button
                  variant={settings.sync.autoSync ? 'contained' : 'outlined'}
                  onClick={() => void patchSettings({ sync: { ...settings.sync, autoSync: !settings.sync.autoSync } })}
                >
                  {settings.sync.autoSync ? '已开启自动同步' : '开启自动同步'}
                </Button>
                <TextField
                  select
                  size="small"
                  label="同步间隔"
                  value={settings.sync.intervalMinutes}
                  onChange={(event) => void patchSettings({ sync: { ...settings.sync, intervalMinutes: Number(event.target.value) } })}
                  sx={{ width: 170 }}
                >
                  {[5, 15, 30, 60, 120].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value} 分钟
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="默认同步挂载"
                  value={settings.sync.mountId ?? ''}
                  onChange={(event) => void patchSettings({ sync: { ...settings.sync, mountId: event.target.value || null } })}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">全部已启用挂载</MenuItem>
                  {mounts.map((mount) => (
                    <MenuItem key={mount.id} value={mount.id}>
                      {mount.name}（{mount.kind}）
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  startIcon={<SyncRoundedIcon />}
                  onClick={async () => {
                    setBusyId('__all__')
                    try {
                      const results = await api.sync.run()
                      toast('success', `已同步 ${results.length} 个挂载`)
                    } catch (error) {
                      toast('error', `同步失败：${(error as Error).message}`)
                    } finally {
                      setBusyId(null)
                      setProgress(null)
                      await refresh()
                    }
                  }}
                  disabled={busyId !== null}
                >
                  立即全部同步
                </Button>
              </Stack>
              {progress ? <Alert severity="info">同步进度：{progress}</Alert> : null}
            </Stack>
          </Section>
        ) : null}

        {panel === 'log' ? (
          <Section
            title={`同步日志 · ${log.length}`}
            subtitle="仅保留最近 100 条"
            action={
              <Button size="small" onClick={() => void refresh()}>
                刷新
              </Button>
            }
          >
            {log.length === 0 ? (
              <EmptyState title="还没有同步记录" description="执行一次同步后，这里会显示上传/下载/冲突统计。" />
            ) : (
              <List dense sx={{ px: 1, pb: 1 }}>
                {log.map((entry) => (
                  <ListItemButton key={entry.id} sx={{ borderRadius: 2, mb: 0.25 }} onClick={() => setPanel('mounts')}>
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <Chip size="small" label={entry.conflicts > 0 ? '冲突' : '完成'} color={entry.conflicts > 0 ? 'warning' : 'success'} />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${entry.mountName} · 上传 ${entry.uploaded}，下载 ${entry.downloaded}，跳过 ${entry.skipped}`}
                      secondary={`${formatDateTime(entry.at)} · ${formatRelative(entry.at)}`}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    {entry.conflicts > 0 ? <Chip size="small" variant="outlined" label={`${entry.conflicts} 冲突`} /> : null}
                  </ListItemButton>
                ))}
              </List>
            )}
          </Section>
        ) : null}

        {panel === 'mounts' ? (
          <Section
            title={`云盘挂载 · ${mounts.length}`}
            subtitle="SMB / WebDAV / 夸克网盘 / 本地目录，用于多端同步与存档托管"
            action={
              <Button
                size="small"
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => setDraft({ kind: 'webdav', name: '', remotePath: '/StudyInGal', enabled: true, config: {} })}
              >
                新建挂载
              </Button>
            }
          >
            {mounts.length === 0 ? (
              <EmptyState title="还没有挂载" description="推荐使用 WebDAV（坚果云、Nextcloud、Alist 等）或 SMB 作为同步后端。" />
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, p: 2 }}>
                {mounts.map((mount) => (
                  <Card key={mount.id} elevation={0}>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }} noWrap>
                          {mount.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={mount.status}
                          color={mount.status === 'connected' ? 'success' : mount.status === 'error' ? 'error' : 'default'}
                        />
                        <Chip size="small" variant="outlined" label={mount.kind.toUpperCase()} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {mount.remotePath} · 上次同步 {formatDateTime(mount.lastSyncAt)}
                      </Typography>
                      {mount.lastError ? (
                        <Typography variant="caption" color="error" display="block" sx={{ wordBreak: 'break-all' }}>
                          {mount.lastError}
                        </Typography>
                      ) : null}
                      <Divider sx={{ my: 1.25 }} />
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          startIcon={<WifiTetheringRoundedIcon />}
                          onClick={async () => {
                            const result = await api.cloud.test(mount.id)
                            toast(result.ok ? 'success' : 'error', result.message)
                            await refresh()
                          }}
                        >
                          测试
                        </Button>
                        <Button
                          size="small"
                          startIcon={<SyncRoundedIcon />}
                          disabled={busyId === mount.id}
                          onClick={async () => {
                            setBusyId(mount.id)
                            try {
                              const result = await api.cloud.sync(mount.id)
                              toast('success', `同步完成：上传 ${result.uploaded}，下载 ${result.downloaded}，跳过 ${result.skipped}`)
                            } catch (error) {
                              toast('error', `同步失败：${(error as Error).message}`)
                            } finally {
                              setBusyId(null)
                              setProgress(null)
                              await refresh()
                            }
                          }}
                        >
                          同步
                        </Button>
                        <Button
                          size="small"
                          startIcon={<FolderOpenRoundedIcon />}
                          onClick={async () => {
                            const entries = await api.cloud.listRemote(mount.id, mount.remotePath).catch(() => [])
                            setBrowsing({ mountId: mount.id, path: mount.remotePath, entries })
                          }}
                        >
                          浏览
                        </Button>
                        <IconButton size="small" onClick={() => setDraft(mount)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={async () => {
                            await api.cloud.remove(mount.id)
                            await refresh()
                          }}
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Section>
        ) : null}
      </Stack>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>挂载配置</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="类型"
              value={draft?.kind ?? 'webdav'}
              onChange={(event) => setDraft({ ...(draft ?? {}), kind: event.target.value as CloudKind, config: {} })}
            >
              <MenuItem value="webdav">WebDAV</MenuItem>
              <MenuItem value="smb">SMB / Samba</MenuItem>
              <MenuItem value="quark">夸克网盘（实验性）</MenuItem>
              <MenuItem value="local">本地目录</MenuItem>
            </TextField>
            <TextField label="显示名称" value={draft?.name ?? ''} onChange={(event) => setDraft({ ...(draft ?? { kind: 'webdav' }), name: event.target.value })} />
            <TextField label="远端根路径" value={draft?.remotePath ?? ''} onChange={(event) => setDraft({ ...(draft ?? { kind: 'webdav' }), remotePath: event.target.value })} />
            {(KIND_FIELDS[(draft?.kind ?? 'webdav') as CloudKind] ?? []).map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                type={field.type ?? 'text'}
                placeholder={field.placeholder}
                value={String((draft?.config as Record<string, unknown>)?.[field.key] ?? '')}
                onChange={(event) =>
                  setDraft({
                    ...(draft ?? { kind: 'webdav' }),
                    config: { ...((draft?.config as Record<string, unknown>) ?? {}), [field.key]: event.target.value }
                  })
                }
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)}>取消</Button>
          <Button variant="contained" onClick={() => void saveMount()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={browsing !== null} onClose={() => setBrowsing(null)} fullWidth maxWidth="sm">
        <DialogTitle>远端浏览 · {browsing?.path}</DialogTitle>
        <DialogContent dividers>
          {browsing?.entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              目录为空或无法访问。
            </Typography>
          ) : (
            <Stack spacing={1}>
              {browsing?.entries.map((entry) => (
                <Stack key={entry.path} direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={entry.isDirectory ? '目录' : '文件'} />
                  <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                    {entry.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry.sizeBytes} B
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBrowsing(null)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
