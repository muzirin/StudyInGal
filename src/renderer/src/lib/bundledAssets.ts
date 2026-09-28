import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { BundledAssets, Character } from '@shared/types'

const EMPTY: BundledAssets = { backgrounds: [], sprites: [], defaultSprite: null }

let cache: BundledAssets | null = null
let pending: Promise<BundledAssets> | null = null

/** 读取随包分发的开源素材（带模块级缓存，只请求一次）。 */
export function loadBundledAssets(): Promise<BundledAssets> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = api.assets
      .list()
      .then((assets) => {
        cache = assets
        return assets
      })
      .catch(() => {
        cache = EMPTY
        return EMPTY
      })
  }
  return pending
}

export function useBundledAssets(): BundledAssets {
  const [assets, setAssets] = useState<BundledAssets>(cache ?? EMPTY)
  useEffect(() => {
    let alive = true
    void loadBundledAssets().then((next) => {
      if (alive) setAssets(next)
    })
    return () => {
      alive = false
    }
  }, [])
  return assets
}

/**
 * 角色立绘：优先使用角色自己的立绘（按情绪），否则回退到内置开源立绘。
 * 这样即使还没有配置立绘，主页/对话/Galgame 里也能看到角色形象。
 */
export function useCharacterSprite(character: Character | null | undefined, emotion = 'neutral'): string | null {
  const assets = useBundledAssets()
  return useMemo(() => {
    const own =
      character?.sprites?.find((item) => item.emotion === emotion)?.path ?? character?.sprites?.[0]?.path ?? null
    if (own) return own
    return assets.sprites.find((item) => item.id === assets.defaultSprite)?.path ?? assets.sprites[0]?.path ?? null
  }, [character, emotion, assets])
}
