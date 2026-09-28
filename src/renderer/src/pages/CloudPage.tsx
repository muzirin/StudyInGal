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
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import WifiTetheringRoundedIcon from '@mui/icons-material/WifiTetheringRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { EmptyState, Section } from '../components/Section'
import { formatDateTime } from '../lib/format'
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

export function CloudPage() {
  const toast = useAppStore((state) => state.toast)
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)

  const [mounts, setMounts] = useState<CloudMount[]>([])
  const [draft, setDraft] = useState<(Partial<CloudMount> & { kind: CloudKind }) | null>(null)
  const [browsing, setBrowsing] = useState<{ mountId: string; path: string; entries: CloudEntry[] } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const refresh = async (): Promise<void> => setMounts(await api.cloud.list())

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
    setMounts(await api.cloud.list())
    toast('success', `已保存挂载：${saved.name}`)
  }

  return (
    <Stack spacing={2.5}>
      <Alert severity="warning">
        夸克网盘适配器为实验性实现（基于网页端接口，需自行提供 Cookie），目前支持浏览与下载；上传请使用 WebDAV 或 SMB。
      </Alert>

      <Section
        title={`云盘挂载 · ${mounts.length}`}
        subtitle="SMB / WebDAV / 夸克网盘 / 本地目录，用于多端同步与存档托管"
        action={
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDraft({ kind: 'webdav', name: '', remotePath: '/StudyInGal', enabled: true, config: {} })}>
            新建挂载
          </Button>
        }
      >
        {mounts.length === 0 ? (
          <EmptyState title="还没有挂载" description="推荐使用 WebDAV（坚果云、Nextcloud、Alist 等）或 SMB 作为同步后端。" />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2, p: 2 }}>
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
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {mount.kind.toUpperCase()} · {mount.remotePath}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    上次同步：{formatDateTime(mount.lastSyncAt)}
                  </Typography>
                  {mount.lastError ? (
                    <Typography variant="caption" color="error" display="block" sx={{ wordBreak: 'break-all' }}>
                      {mount.lastError}
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
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
                          await refresh()
                        } catch (error) {
                          toast('error', `同步失败：${(error as Error).message}`)
                        } finally {
                          setBusyId(null)
                          setProgress(null)
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
                    <Button size="small" onClick={() => setDraft(mount)}>
                      编辑
                    </Button>
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
        {progress ? <Alert severity="info" sx={{ mx: 2, mb: 2 }}>同步进度：{progress}</Alert> : null}
      </Section>

      <Section title="自动同步" subtitle="应用启动后按间隔自动同步所有已启用挂载">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2 }} flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="同步间隔"
            value={settings?.sync.intervalMinutes ?? 15}
            onChange={(event) => void patchSettings({ sync: { ...(settings?.sync as object), intervalMinutes: Number(event.target.value) } })}
            sx={{ width: 160 }}
          >
            {[5, 15, 30, 60, 120].map((value) => (
              <MenuItem key={value} value={value}>
                {value} 分钟
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={async () => {
              const results = await api.sync.run()
              toast('success', `已同步 ${results.length} 个挂载`)
            }}
          >
            立即全部同步
          </Button>
        </Stack>
      </Section>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>挂载配置</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="类型" value={draft?.kind ?? 'webdav'} onChange={(event) => setDraft({ ...(draft ?? {}), kind: event.target.value as CloudKind, config: {} })}>
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
    </Stack>
  )
}
