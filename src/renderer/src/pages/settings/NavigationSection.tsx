import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded'
import { useAppStore } from '../../state/appStore'
import { Section } from '../../components/Section'
import { GROUP_ORDER, MODULES } from '../../modules/registry'

export function NavigationSection() {
  const settings = useAppStore((state) => state.settings)
  const patchSettings = useAppStore((state) => state.patchSettings)
  if (!settings) return null

  const hidden = settings.nav.hidden
  const pinned = settings.nav.pinned

  const toggleHidden = (id: string): void => {
    void patchSettings({
      nav: { ...settings.nav, hidden: hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id] }
    })
  }

  const togglePinned = (id: string): void => {
    void patchSettings({
      nav: { ...settings.nav, pinned: pinned.includes(id) ? pinned.filter((item) => item !== id) : [...pinned, id] }
    })
  }

  return (
    <>
      <Section title="模块可见性" subtitle="关闭的模块不会出现在侧边导航、首页导航与命令面板中">
        <Stack spacing={2} sx={{ px: 2, pb: 2 }}>
          {GROUP_ORDER.map((group) => {
            const children = MODULES.filter((module) => module.group === group)
            if (children.length === 0) return null
            return (
              <Box key={group}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  {group}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {children.map((module) => {
                    const isHidden = hidden.includes(module.id)
                    const isPinned = pinned.includes(module.id)
                    return (
                      <Chip
                        key={module.id}
                        icon={<Box sx={{ display: 'flex', '& svg': { fontSize: 16 } }}>{isHidden ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</Box>}
                        label={module.label}
                        variant={isHidden ? 'outlined' : 'filled'}
                        color={isHidden ? 'default' : 'primary'}
                        onClick={() => toggleHidden(module.id)}
                        onDelete={isHidden ? undefined : () => togglePinned(module.id)}
                        deleteIcon={
                          isPinned ? (
                            <Tooltip title="取消常用">
                              <PushPinRoundedIcon sx={{ fontSize: 15 }} />
                            </Tooltip>
                          ) : (
                            <Tooltip title="设为常用">
                              <PushPinRoundedIcon sx={{ fontSize: 15, opacity: 0.35 }} />
                            </Tooltip>
                          )
                        }
                        sx={{ opacity: isHidden ? 0.6 : 1 }}
                      />
                    )
                  })}
                </Stack>
              </Box>
            )
          })}
        </Stack>
      </Section>

      <Section title="常用（置顶）" subtitle="固定到侧边导航顶部的模块，收起为图标栏时同样生效">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ px: 2, pb: 2 }}>
          {pinned.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              还没有常用模块。在上方模块右侧点击图钉即可固定。
            </Typography>
          ) : (
            pinned.map((id) => {
              const module = MODULES.find((item) => item.id === id)
              if (!module) return null
              return <Chip key={id} label={module.label} color="primary" onDelete={() => togglePinned(id)} />
            })
          )}
        </Stack>
      </Section>
    </>
  )
}
