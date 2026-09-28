import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { api } from '../api'
import { useAppStore } from '../state/appStore'
import { toAssetUrl } from '../lib/assets'
import { useCharacterSprite } from '../lib/bundledAssets'
import type { Character } from '@shared/types'

interface Props {
  character: Character | null
  height?: number
  showControls?: boolean
  bare?: boolean
  emotion?: string
}

/**
 * Live2D 舞台。
 *
 * Cubism Core 与运行库受各自许可约束，因此不随安装包分发：
 * - 运行库（pixi.js / pixi-live2d-display）作为 optionalDependencies，可用 `npm i pixi.js@^7 pixi-live2d-display@^0.4` 安装；
 * - Cubism Core 需要在「设置 → Live2D」填写脚本地址（例如你自己托管的 live2dcubismcore.min.js）。
 *
 * 任一环节缺失时回退到角色立绘 / Emoji，并给出明确提示，不会让界面崩掉。
 */
export function Live2DStage({ character, height = 320, showControls = true, bare = false, emotion = 'neutral' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [message, setMessage] = useState('')
  const live2dEnabled = useAppStore((state) => state.settings?.live2d.enabled ?? false)
  const coreUrl = useAppStore((state) => state.settings?.live2d.coreUrl ?? '')
  const stageScale = useAppStore((state) => state.settings?.live2d.scale ?? 1)
  const stageX = useAppStore((state) => state.settings?.live2d.x ?? 0.5)
  const stageY = useAppStore((state) => state.settings?.live2d.y ?? 0)
  const stageOpacity = useAppStore((state) => state.settings?.live2d.opacity ?? 1)
  const modelPath = character?.live2d?.modelPath ?? null

  useEffect(() => {
    if (!modelPath || !containerRef.current || !live2dEnabled) {
      setStatus('idle')
      return
    }
    let disposed = false
    let app: { destroy: (removeView?: boolean, options?: unknown) => void; stage?: unknown } | null = null

    const run = async (): Promise<void> => {
      setStatus('loading')
      try {
        const globalScope = window as unknown as { Live2DCubismCore?: unknown }
        if (!globalScope.Live2DCubismCore && coreUrl) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = coreUrl
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Cubism Core 脚本加载失败'))
            document.head.appendChild(script)
          })
        }
        if (!globalScope.Live2DCubismCore) {
          throw new Error('未加载 Cubism Core，请在「设置 → Live2D」填写 live2dcubismcore.min.js 地址')
        }

        const PIXI = (await import('pixi.js')) as unknown as {
          Application: new (options: Record<string, unknown>) => {
            view: HTMLCanvasElement
            stage: { addChild: (child: unknown) => void }
            destroy: (removeView?: boolean, options?: unknown) => void
            renderer: { resize: (w: number, h: number) => void }
            ticker: { add: (fn: () => void) => void }
          }
          Ticker: unknown
        }
        const live2d = (await import('pixi-live2d-display/cubism4')) as unknown as {
          Live2DModel: {
            registerTicker: (ticker: unknown) => void
            from: (path: string, options?: Record<string, unknown>) => Promise<{
              width: number
              height: number
              scale: { set: (value: number) => void }
              x: number
              y: number
              anchor: { set: (x: number, y: number) => void }
            }>
          }
        }

        if (PIXI.Ticker) live2d.Live2DModel.registerTicker(PIXI.Ticker)

        const container = containerRef.current
        if (!container) return
        const width = container.clientWidth || 320
        const localHeight = height

        const application = new PIXI.Application({
          width,
          height: localHeight,
          backgroundAlpha: 0,
          antialias: true,
          autoStart: true
        })
        app = application
        application.view.style.width = '100%'
        application.view.style.height = '100%'
        container.appendChild(application.view)

        const model = await live2d.Live2DModel.from(toAssetUrl(modelPath) ?? modelPath, { autoInteract: false })
        if (disposed) return
        application.stage.addChild(model)

        const fit = Math.min((width * 0.9) / model.width, (localHeight * 0.92) / model.height) * stageScale
        model.scale.set(fit)
        model.anchor.set(0.5, 1)
        model.x = width * stageX
        model.y = localHeight * (1 - stageY * 0.5)
        application.view.style.opacity = String(stageOpacity)

        setStatus('ready')
        setMessage('')
      } catch (error) {
        if (disposed) return
        setStatus('unavailable')
        setMessage((error as Error).message)
      }
    }

    void run()
    return () => {
      disposed = true
      try {
        app?.destroy(true, { children: true })
      } catch {
        /* ignore */
      }
    }
  }, [modelPath, live2dEnabled, coreUrl, height, stageScale, stageX, stageY, stageOpacity])

  const sprite = useCharacterSprite(character, emotion)
  const showFallback = status !== 'ready'

  return (
    <Box
      sx={{
        height,
        borderRadius: bare ? 0 : 3,
        border: bare ? 'none' : '1px dashed',
        borderColor: 'divider',
        bgcolor: bare ? 'transparent' : 'var(--sig-surface-variant)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />
      {showFallback ? (
        <Stack alignItems="center" spacing={1} sx={{ zIndex: 1, textAlign: 'center', px: 2 }}>
          {sprite ? (
            <Box
              component="img"
              src={toAssetUrl(sprite)}
              alt={character?.name ?? '角色'}
             
              sx={{
                maxHeight: bare ? height : height - 80,
                maxWidth: '100%',
                filter: bare ? 'drop-shadow(0 18px 32px rgba(0,0,0,0.22))' : 'none'
              }}
            />
          ) : (
            <Typography sx={{ fontSize: bare ? height * 0.42 : 72, lineHeight: 1 }}>
              {character?.avatar ?? '🌸'}
            </Typography>
          )}
          {bare ? null : (
            <>
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
            </>
          )}
          {status === 'unavailable' && !bare ? (
            <Alert severity="info" sx={{ maxWidth: 420, textAlign: 'left' }}>
              未能渲染 Live2D：{message || '请安装 pixi.js 与 pixi-live2d-display，并在「设置 → Live2D」填写 Cubism Core 地址。'}
            </Alert>
          ) : null}
          {showControls && !bare ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => void api.app.openExternal('https://github.com/guansss/pixi-live2d-display')}
            >
              查看 Live2D 接入文档
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  )
}
