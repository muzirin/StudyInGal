import { useEffect, useState } from 'react'
import { FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material'
import { api } from '../../api'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import type { CloudMount } from '@shared/types'

export function SyncSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  const [mounts, setMounts] = useState<CloudMount[]>([])

  useEffect(() => {
    void api.cloud.list().then(setMounts).catch(() => undefined)
  }, [])

  if (!settings) return null
  const sync = settings.sync

  return (
    <Section title="多端同步" subtitle="基于 WebDAV / SMB / 本地目录的增量同步">
      <Stack spacing={2.5} sx={{ px: 2, pb: 2 }}>
        <FormControlLabel
          control={<Switch checked={sync.autoSync} onChange={(event) => void patchSettings({ sync: { ...sync, autoSync: event.target.checked } })} />}
          label="启用自动同步"
        />
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            select
            size="small"
            label="同步间隔"
            value={sync.intervalMinutes}
            onChange={(event) => void patchSettings({ sync: { ...sync, intervalMinutes: Number(event.target.value) } })}
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
            value={sync.mountId ?? ''}
            onChange={(event) => void patchSettings({ sync: { ...sync, mountId: event.target.value || null } })}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">未指定</MenuItem>
            {mounts.map((mount) => (
              <MenuItem key={mount.id} value={mount.id}>
                {mount.name}（{mount.kind}）
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
    </Section>
  )
}
