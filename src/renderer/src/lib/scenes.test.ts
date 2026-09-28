import { describe, expect, it } from 'vitest'
import { buildScenes } from './scenes'
import type { DialogueLine } from '@shared/types'

const line = (speaker: DialogueLine['speaker'], text: string): DialogueLine => ({
  id: `l${Math.random().toString(36).slice(2, 8)}`,
  speaker,
  text,
  emotion: 'neutral'
})

describe('buildScenes', () => {
  it('空剧本返回空数组', () => {
    expect(buildScenes([])).toEqual([])
  })

  it('短剧本只有一幕，且标题取自第一句角色台词', () => {
    const scenes = buildScenes([line('character', '欢迎来到第一章'), line('user', '你好')])
    expect(scenes).toHaveLength(1)
    expect(scenes[0].start).toBe(0)
    expect(scenes[0].end).toBe(1)
    expect(scenes[0].title).toBe('欢迎来到第一章')
  })

  it('在旁白处切幕', () => {
    const scenes = buildScenes([
      line('character', '第一幕开场'),
      line('user', '嗯'),
      line('character', '继续'),
      line('narration', '（镜头切换）'),
      line('character', '第二幕开场')
    ])
    expect(scenes).toHaveLength(2)
    expect(scenes[0].start).toBe(0)
    expect(scenes[0].end).toBe(2)
    expect(scenes[1].start).toBe(3)
    expect(scenes[1].end).toBe(4)
  })

  it('超过 14 行时强制切幕', () => {
    const lines = Array.from({ length: 30 }, (_value, index) => line('character', `第 ${index} 句`))
    const scenes = buildScenes(lines)
    expect(scenes.length).toBeGreaterThan(1)
    for (const scene of scenes) {
      expect(scene.end - scene.start + 1).toBeLessThanOrEqual(15)
    }
    // 覆盖完整且连续
    expect(scenes[0].start).toBe(0)
    expect(scenes[scenes.length - 1].end).toBe(lines.length - 1)
    scenes.forEach((scene, index) => {
      if (index > 0) expect(scene.start).toBe(scenes[index - 1].end + 1)
    })
  })

  it('索引从 0 连续递增', () => {
    const lines = Array.from({ length: 40 }, () => line('character', '内容'))
    const scenes = buildScenes(lines)
    scenes.forEach((scene, index) => expect(scene.index).toBe(index))
  })
})
