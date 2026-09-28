import { describe, expect, it } from 'vitest'
import {
  ABSOLUTE_MAX_TOKENS,
  SAFE_FALLBACK_TOKENS,
  clampMaxTokens,
  estimateScriptTokens,
  isMaxTokenError,
  parseAllowedMaxTokens,
  tokenCandidates
} from './aiTokens'

describe('clampMaxTokens', () => {
  it('非法值回退到默认', () => {
    expect(clampMaxTokens(0)).toBe(SAFE_FALLBACK_TOKENS)
    expect(clampMaxTokens(-5)).toBe(SAFE_FALLBACK_TOKENS)
    expect(clampMaxTokens(Number.NaN)).toBe(SAFE_FALLBACK_TOKENS)
  })

  it('收敛到 [1, ABSOLUTE_MAX_TOKENS]', () => {
    expect(clampMaxTokens(1234)).toBe(1234)
    expect(clampMaxTokens(0.9)).toBe(1)
    expect(clampMaxTokens(393216)).toBe(ABSOLUTE_MAX_TOKENS)
  })
})

describe('estimateScriptTokens', () => {
  it('按行数线性增长并封顶', () => {
    expect(estimateScriptTokens(10)).toBe(2400)
    expect(estimateScriptTokens(1000)).toBeLessThanOrEqual(16384)
    expect(estimateScriptTokens(0)).toBe(estimateScriptTokens(40))
  })
})

describe('isMaxTokenError', () => {
  it('识别常见表述', () => {
    expect(isMaxTokenError('Invalid max_tokens value, the valid range of max_tokens is [1, 393216]')).toBe(true)
    expect(isMaxTokenError('max_tokens must be less than or equal to 8192')).toBe(true)
    expect(isMaxTokenError('This model maximum context length is 8192 tokens')).toBe(true)
    expect(isMaxTokenError('Unauthorized')).toBe(false)
  })
})

describe('parseAllowedMaxTokens', () => {
  it('解析区间写法', () => {
    expect(parseAllowedMaxTokens('Invalid max_tokens value, the valid range of max_tokens is [1, 393216]')).toBe(393216)
  })

  it('解析“小于等于”写法', () => {
    expect(parseAllowedMaxTokens('max_tokens must be less than or equal to 8192')).toBe(8192)
  })

  it('无法解析时返回 null', () => {
    expect(parseAllowedMaxTokens('Unauthorized')).toBeNull()
  })
})

describe('tokenCandidates', () => {
  it('去重并过滤非法值，主候选排在最前', () => {
    expect(tokenCandidates(8192, [8192, null, 0, 4096])).toEqual([8192, 4096])
  })

  it('超上限的候选会被收敛', () => {
    expect(tokenCandidates(999999, [])).toEqual([ABSOLUTE_MAX_TOKENS])
  })
})
