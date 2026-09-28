import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Box } from '@mui/material'
import { useLocation } from 'react-router-dom'

type Phase = 'idle' | 'in' | 'out'

const ORIGINS = [
  ['82%', '14%'],
  ['18%', '18%'],
  ['78%', '82%'],
  ['24%', '84%']
] as const

function originFor(key: string): readonly [string, string] {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) % 997
  return ORIGINS[hash % ORIGINS.length]
}

/**
 * 快速遮罩转场：切页时用一层从主题色生成的圆形遮罩扫过（约 380ms 完成），
 * 内容同时做一次轻微的淡入上移。整体足够快，不打断操作节奏。
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const routeKey = location.pathname
  const [phase, setPhase] = useState<Phase>('idle')
  const firstRender = useRef(true)
  const timers = useRef<number[]>([])

  const [enter, exit] = useMemo(() => {
    const [ax, ay] = originFor(routeKey)
    const [bx, by] = originFor(`${routeKey}:exit`)
    return [`${ax} ${ay}`, `${bx} ${by}`]
  }, [routeKey])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
    setPhase('in')
    timers.current.push(window.setTimeout(() => setPhase('out'), 160))
    timers.current.push(window.setTimeout(() => setPhase('idle'), 390))
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer))
      timers.current = []
    }
  }, [routeKey])

  return (
    <>
      <Box key={routeKey} className="sig-page-enter sig-scroll-thin" sx={{ minHeight: '100%' }}>
        {children}
      </Box>
      {phase !== 'idle' ? (
        <div
          className="sig-transition-mask"
          data-phase={phase}
          style={
            {
              '--sig-mask-origin': enter,
              '--sig-mask-exit': exit
            } as React.CSSProperties
          }
        />
      ) : null}
    </>
  )
}
