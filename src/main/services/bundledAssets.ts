import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BundledAssets, BundledBackground, BundledSprite } from '@shared/types'

interface AssetsManifest {
  version?: number
  defaultSprite?: string | null
  backgrounds?: { id: string; name: string; file: string }[]
  sprites?: { id: string; name: string; file: string }[]
}

/**
 * 内置开源素材目录：
 * - 开发时：<项目根>/resources/assets
 * - 打包后：<process.resourcesPath>/assets（见 electron-builder.yml 的 extraResources）
 */
export function assetsRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'assets')
    : join(app.getAppPath(), 'resources', 'assets')
}

const EMPTY: BundledAssets = { backgrounds: [], sprites: [], defaultSprite: null }

export function listBundledAssets(): BundledAssets {
  const root = assetsRoot()
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath)) return EMPTY

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetsManifest
    const backgrounds: BundledBackground[] = (manifest.backgrounds ?? []).map((item) => ({
      ...item,
      path: join(root, item.file)
    }))
    const sprites: BundledSprite[] = (manifest.sprites ?? []).map((item) => ({
      ...item,
      path: join(root, item.file)
    }))
    return { backgrounds, sprites, defaultSprite: manifest.defaultSprite ?? sprites[0]?.id ?? null }
  } catch (error) {
    console.warn('[StudyInGal] 读取内置素材清单失败：', (error as Error).message)
    return EMPTY
  }
}

export function defaultSpritePath(): string | null {
  const assets = listBundledAssets()
  return assets.sprites.find((sprite) => sprite.id === assets.defaultSprite)?.path ?? assets.sprites[0]?.path ?? null
}
