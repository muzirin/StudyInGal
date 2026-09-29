import { describe, expect, it } from 'vitest'
import { isPristineLegacyDefault } from './legacyCharacter'

const pristine = {
  id: 'char_sakura',
  name: '小樱',
  systemPrompt: [
    '你是 StudyInGal 的伴学娘「小樱」。',
    '你的职责是陪伴用户学习、讲解论文与教材、出题与答疑，并在用户分心时温和提醒。',
    '保持角色一致性：温柔、耐心、条理清晰，偶尔俏皮但绝不敷衍。',
    '讲解时使用结构化表达，必要时用小标题与要点。不要编造不存在的内容，不确定时明确说明。'
  ].join('\n')
}

describe('isPristineLegacyDefault', () => {
  it('未改动过的内置默认角色会被识别（用于清理）', () => {
    expect(isPristineLegacyDefault(pristine)).toBe(true)
  })

  it('移动端旧版的精简人设也要能识别', () => {
    const mobilePrompt = [
      '你是 StudyInGal 的伴学娘「小樱」。',
      '你的职责是陪伴用户学习、讲解论文与教材、出题与答疑，并在用户分心时温和提醒。',
      '保持角色一致性：温柔、耐心、条理清晰，偶尔俏皮但绝不敷衍。'
    ].join('\n')
    expect(isPristineLegacyDefault({ ...pristine, systemPrompt: mobilePrompt })).toBe(true)
  })

  it('用户改过名字或人设的角色要保留', () => {
    expect(isPristineLegacyDefault({ ...pristine, name: '小樱酱' })).toBe(false)
    expect(isPristineLegacyDefault({ ...pristine, systemPrompt: '自定义人设' })).toBe(false)
  })

  it('其它角色不受影响', () => {
    expect(isPristineLegacyDefault({ id: 'char_1', name: '小樱', systemPrompt: pristine.systemPrompt })).toBe(false)
  })
})
