import type { ReactNode } from 'react'
import { Box, Card, CardContent, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import InboxRoundedIcon from '@mui/icons-material/InboxRounded'

export function Section({
  title,
  subtitle,
  action,
  children,
  disablePadding
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children?: ReactNode
  disablePadding?: boolean
}) {
  return (
    <Card elevation={0} sx={{ height: '100%' }}>
      <CardContent sx={{ p: disablePadding ? 0 : 2.5, '&:last-child': { pb: disablePadding ? 0 : 2.5 } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: disablePadding ? 0 : 1.5, px: disablePadding ? 2.5 : 0, pt: disablePadding ? 2.5 : 0 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 6, px: 3, textAlign: 'center' }}>
      <Box sx={{ color: 'text.disabled', '& svg': { fontSize: 44 } }}>{icon ?? <InboxRoundedIcon fontSize="inherit" />}</Box>
      <Typography variant="subtitle1">{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
          {description}
        </Typography>
      ) : null}
      {action}
    </Stack>
  )
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  onClick
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  onClick?: () => void
}) {
  return (
    <Card elevation={0} sx={{ height: '100%', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {icon ? <Box sx={{ color: 'primary.main', '& svg': { fontSize: 30 } }}>{icon}</Box> : null}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {label}
            </Typography>
            {hint ? (
              <Typography variant="caption" color="text.disabled">
                {hint}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function RowAction({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" onClick={onClick}>
        {children}
      </IconButton>
    </Tooltip>
  )
}
