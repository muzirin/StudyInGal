import { useState } from 'react'
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material'
import { derivative, evaluate, simplify } from 'mathjs'
import { Section } from '../../components/Section'

interface HistoryEntry {
  expression: string
  result: string
  label: string
}

export function CalculatorPanel() {
  const [expression, setExpression] = useState('')
  const [variable, setVariable] = useState('x')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const push = (label: string, result: string): void => {
    setHistory((prev) => [{ expression, result, label }, ...prev].slice(0, 20))
  }

  const run = (mode: 'eval' | 'derivative' | 'simplify' | 'integral'): void => {
    if (!expression.trim()) return
    setError(null)
    try {
      if (mode === 'eval') {
        const value = evaluate(expression)
        push('求值', typeof value === 'object' ? JSON.stringify(value) : String(value))
      } else if (mode === 'derivative') {
        push(`d/d${variable}`, simplify(derivative(expression, variable)).toString())
      } else if (mode === 'simplify') {
        push('化简', simplify(expression).toString())
      } else {
        const parsed = expression.replace(/\bintegrate\s*\(/g, '(')
        push('积分（数值）', String(evaluate(parsed)).slice(0, 200))
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Section title="高数计算器" subtitle="基于 mathjs：求值、求导、化简、数值积分">
      <Stack spacing={2} sx={{ p: 1 }}>
        <TextField
          label="表达式"
          placeholder="例如：derivative(x^3 + sin(x), x) 或 integrate(x^2, x, 0, 1)"
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') run('eval')
          }}
          fullWidth
          multiline
          minRows={2}
        />
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField size="small" label="变量" value={variable} onChange={(event) => setVariable(event.target.value)} sx={{ width: 110 }} />
          <Button variant="contained" onClick={() => run('eval')}>
            求值
          </Button>
          <Button variant="outlined" onClick={() => run('derivative')}>
            求导
          </Button>
          <Button variant="outlined" onClick={() => run('simplify')}>
            化简
          </Button>
          <Button variant="outlined" onClick={() => run('integral')}>
            数值积分
          </Button>
          <Button
            color="inherit"
            onClick={() => {
              setExpression('')
              setError(null)
            }}
          >
            清空
          </Button>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            支持常见函数：sin / cos / tan / log / sqrt / abs，以及矩阵、单位与符号运算。
          </Typography>
        ) : (
          <Stack spacing={1}>
            {history.map((entry, index) => (
              <Box key={index} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'var(--sig-surface-variant)' }}>
                <Chip size="small" label={entry.label} sx={{ mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontFamily: 'monospace' }}>
                  {entry.expression}
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  = {entry.result}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Section>
  )
}
