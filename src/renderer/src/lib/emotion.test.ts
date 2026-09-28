import { describe, expect, it } from 'vitest'
import { guessEmotion } from './emotion'

describe('guessEmotion', () => {
  it('识别常见情绪关键词', () => {
    expect(guessEmotion('哈哈，这个问题太棒了')).toBe('happy')
    expect(guessEmotion('哇，居然是这样')).toBe('surprised')
    expect(guessEmotion('抱歉，我记错了')).toBe('sad')
    expect(guessEmotion('注意，这里务必小心')).toBe('serious')
    expect(guessEmotion('让我想一想这个问题？')).toBe('thinking')
    expect(guessEmotion('不好意思，我有点害羞')).toBe('shy')
  })

  it('无法判断时回退 neutral', () => {
    expect(guessEmotion('这是一段普通的陈述。')).toBe('neutral')
    expect(guessEmotion('')).toBe('neutral')
  })
})
