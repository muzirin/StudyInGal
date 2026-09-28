import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { api } from '../api'
import type { Character } from '@shared/types'

interface Props {
  character: Character | null
  height?: number
  showControls?: boolean
}

/**
 * Live2D 舞台。
 *
 * 出于体积与许可证（Cubism Core 需单独授权）考虑，Live2D 运行时不会随应用打包。
 * 配置模型路径后，这里会尝试动态加载 pixi.js + pixi-live2d-display；
 * 若运行库不存在，则回退到角色立绘/头像并给出安装指引。
 */
export function Live2DStage({ character, height = 320, showControls = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [message, setMessage] = useState('')
  const modelPath = character?.live2d?.modelPath ?? null

  useEffect(() => {
    let disposed = false
    const run = async (): Promise<void> => {
      if (!modelPath || !containerRef.current) {
        setStatus('idle')
        return
      }
      setStatus('loading')
      try {
        const pixiName = 'pixi.js'
        const live2dName = 'pixi-live2d-display/cubism4'
        const PIXI = (await import(/* @vite-ignore */ pixiName)) as Record<string, never>
        const live2d = (await import(/* @vite-ignore */ live2dName)) as { Live2DModel?: unknown }
        void PIXI
        void live2d
        if (disposed) return
        setStatus('unavailable')
        setMessage('检测到 Live2D 运行库但尚未完成渲染桥接，请在预览版中启用。')
      } catch (error) {
        if (disposed) return
        setStatus('unavailable')
        setMessage((error as Error).message)
      }
    }
    void run()
    return () => {
      disposed = true
    }
  }, [modelPath])

  const sprite = character?.sprites?.[0]?.path ?? null

  return (
    <Box
      sx={{
        height,
        borderRadius: 3,
        border: '1px dashed',
        borderColor: 'divider',
        bgcolor: 'var(--sig-surface-variant)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />
      <Stack alignItems="center" spacing={1} sx={{ zIndex: 1, textAlign: 'center', px: 2 }}>
        {sprite ? (
          <Box component="img" src={sprite} alt={character?.name ?? '角色'} sx={{ maxHeight: height - 80, maxWidth: '100%' }} />
        ) : (
          <Typography sx={{ fontSize: 72, lineHeight: 1 }}>{character?.avatar ?? '🌸'}</Typography>
        )}
        <Typography variant="subtitle1">{character?.name ?? '未选择角色'}</Typography>
        {modelPath ? (
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            Live2D：{modelPath}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            尚未配置 Live2D 模型（在「角色管理 → Live2D」中填写 .model3.json 路径）
          </Typography>
        )}
        {status === 'unavailable' ? (
          <Alert severity="info" sx={{ maxWidth: 420, textAlign: 'left' }}>
            未加载 Live2D 运行库：{message || '请安装 pixi.js 与 pixi-live2d-display 并在「设置」中开启。'}
          </Alert>
        ) : null}
        {showControls && status !== 'ready' ? (
          <Button size="small" variant="outlined" onClick={() => void api.app.openExternal('https://github.com/guansss/pixi-live2d-display')}>
            查看 Live2D 接入文档
          </Button>
        ) : null}
      </Stack>
    </Box>
  )
}
