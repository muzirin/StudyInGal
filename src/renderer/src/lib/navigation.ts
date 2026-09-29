import { MODULES } from '../modules/registry'

/** 路由是否属于「二级页面」：不在左侧导航模块里的一级路径（如阅读器、编辑器、游玩页） */
export function isSecondaryRoute(pathname: string): boolean {
  if (pathname === '/') return false
  return !MODULES.some((module) => module.path === pathname)
}

/**
 * 没有可回退的历史时，二级页面退到哪个一级页面。
 * 阅读/编辑某篇论文就回论文库，教材回教材库，游玩剧本回 Gal 工坊。
 */
export function fallbackPath(pathname: string): string {
  if (pathname.startsWith('/reader/') || pathname.startsWith('/editor/')) {
    return pathname.split('/')[2] === 'textbook' ? '/library/textbook' : '/library/paper'
  }
  if (pathname.startsWith('/galgame/')) return '/galgame'
  return '/'
}
