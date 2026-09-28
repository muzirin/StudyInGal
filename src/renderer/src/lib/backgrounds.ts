import { useMemo } from 'react'
import { useAppStore } from '../state/appStore'
import { useBundledAssets } from './bundledAssets'
import { toAssetUrl } from './assets'

export interface SceneOption {
  id: string
  name: string
  url: string
  custom: boolean
}

/**
 * 场景背景列表 = 内置开源背景（随包分发） + 用户导入的本地背景。
 * 主页与 Galgame 播放器共用同一份列表。
 */
export function useBackgrounds(): SceneOption[] {
  const bundled = useBundledAssets()
  const customScenes = useAppStore((state) => state.settings?.home?.customScenes) ?? []
  return useMemo(() => {
    const builtin: SceneOption[] = bundled.backgrounds.map((item) => ({
      id: item.id,
      name: item.name,
      url: toAssetUrl(item.path) ?? item.path,
      custom: false
    }))
    const custom: SceneOption[] = customScenes.map((item) => ({
      id: item.id,
      name: item.name,
      url: toAssetUrl(item.path) ?? item.path,
      custom: true
    }))
    return [...builtin, ...custom]
  }, [bundled.backgrounds, customScenes])
}

/** 按当前时段在列表中轮换（同一天内稳定，不随机）。 */
export function pickBackgroundByTime(scenes: SceneOption[]): SceneOption | null {
  if (scenes.length === 0) return null
  return scenes[Math.floor(new Date().getHours() / 4) % scenes.length]
}

/** 优先使用指定背景；找不到时按时段挑一个。 */
export function resolveBackground(scenes: SceneOption[], preferredId?: string | null): SceneOption | null {
  if (preferredId) {
    const match = scenes.find((scene) => scene.id === preferredId)
    if (match) return match
  }
  return pickBackgroundByTime(scenes)
}
