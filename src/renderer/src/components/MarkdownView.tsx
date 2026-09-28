import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Box } from '@mui/material'
import 'katex/dist/katex.min.css'

interface Props {
  children: string
  compact?: boolean
  fontSize?: number
}

export function MarkdownView({ children, compact = false, fontSize }: Props) {
  return (
    <Box
      sx={{
        fontSize: fontSize ?? (compact ? 14 : 15),
        lineHeight: 1.75,
        wordBreak: 'break-word',
        '& h1': { fontSize: '1.6em', mt: 2, mb: 1 },
        '& h2': { fontSize: '1.35em', mt: 2.4, mb: 0.8 },
        '& h3': { fontSize: '1.15em', mt: 2, mb: 0.6 },
        '& p': { my: 1 },
        '& pre': {
          bgcolor: 'var(--sig-surface-variant)',
          p: 1.5,
          borderRadius: 1.5,
          overflowX: 'auto',
          fontSize: '0.88em'
        },
        '& code': { fontFamily: 'JetBrains Mono, Consolas, monospace' },
        '& :not(pre) > code': {
          bgcolor: 'var(--sig-surface-variant)',
          px: 0.6,
          py: 0.2,
          borderRadius: 1,
          fontSize: '0.88em'
        },
        '& table': { borderCollapse: 'collapse', width: '100%', my: 1.5 },
        '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1.2, py: 0.7 },
        '& blockquote': {
          my: 1.2,
          px: 1.5,
          borderLeft: '4px solid',
          borderColor: 'primary.main',
          bgcolor: 'var(--sig-surface-variant)',
          borderRadius: 1
        },
        '& img': { maxWidth: '100%', borderRadius: 1.5 },
        '& a': { color: 'primary.main' }
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </Box>
  )
}
