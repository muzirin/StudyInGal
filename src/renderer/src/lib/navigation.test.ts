import { describe, expect, it } from 'vitest'
import { fallbackPath, isSecondaryRoute } from './navigation'

describe('isSecondaryRoute', () => {
  it('一级导航页面不算二级页面', () => {
    expect(isSecondaryRoute('/')).toBe(false)
    expect(isSecondaryRoute('/library/paper')).toBe(false)
    expect(isSecondaryRoute('/library/textbook')).toBe(false)
    expect(isSecondaryRoute('/galgame')).toBe(false)
    expect(isSecondaryRoute('/settings')).toBe(false)
  })

  it('阅读器 / 编辑器 / 游玩页算二级页面', () => {
    expect(isSecondaryRoute('/reader/paper/node_1')).toBe(true)
    expect(isSecondaryRoute('/editor/textbook/node_2')).toBe(true)
    expect(isSecondaryRoute('/galgame/script_3')).toBe(true)
  })
})

describe('fallbackPath', () => {
  it('阅读论文回到论文库，教材回到教材库', () => {
    expect(fallbackPath('/reader/paper/node_1')).toBe('/library/paper')
    expect(fallbackPath('/reader/textbook/node_1')).toBe('/library/textbook')
    expect(fallbackPath('/editor/textbook/node_1')).toBe('/library/textbook')
  })

  it('游玩剧本回到 Gal 工坊', () => {
    expect(fallbackPath('/galgame/script_3')).toBe('/galgame')
  })

  it('兜底回总览', () => {
    expect(fallbackPath('/whatever')).toBe('/')
  })
})
