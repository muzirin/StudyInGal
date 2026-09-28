import { Capacitor } from '@capacitor/core'

const PROTOCOL = /^(https?:|data:|blob:|sigasset:|file:|capacitor:|content:)/i

const isMobile = (): boolean => {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * 把本机绝对路径 / 应用内相对路径转换成渲染进程可加载的 URL。
 *
 * - 桌面端：主进程注册了 `sigasset://` 协议（见 main/index.ts）
 * - 移动端：随包素材用相对路径（assets-bundled/…），应用私有目录用 Capacitor 文件协议
 */
export function toAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (PROTOCOL.test(path)) return path
  if (path.startsWith('assets-bundled/') || path.startsWith('/assets-bundled/')) return path
  if (isMobile()) {
    try {
      return Capacitor.convertFileSrc(path)
    } catch {
      return path
    }
  }
  return `sigasset://local/${encodeURIComponent(path)}`
}

export const runningOnMobile = isMobile
