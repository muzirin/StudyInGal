import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import { api } from '../api'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorId: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void api.errors
      .capture({ message: error.message, stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`, context: 'renderer:ErrorBoundary' })
      .then((captured) => this.setState({ errorId: captured.id }))
      .catch(() => undefined)
  }

  render(): ReactNode {
    const { error, errorId } = this.state
    if (!error) return this.props.children
    return (
      <Box sx={{ p: 4, height: '100%', overflow: 'auto' }}>
        <Paper sx={{ p: 4, maxWidth: 720, mx: 'auto' }} elevation={0}>
          <Alert severity="error" sx={{ mb: 2 }}>
            界面渲染出现异常，已自动记录错误。
          </Alert>
          <Typography variant="h6" gutterBottom>
            {error.message}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mb: 3 }}>
            {(error.stack ?? '').split('\n').slice(0, 6).join('\n')}
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => {
                this.setState({ error: null, errorId: null })
              }}
            >
              尝试恢复
            </Button>
            <Button
              variant="outlined"
              startIcon={<BugReportRoundedIcon />}
              onClick={() => void api.errors.openIssue(errorId ?? undefined)}
            >
              一键汇报 Issue
            </Button>
          </Stack>
        </Paper>
      </Box>
    )
  }
}
