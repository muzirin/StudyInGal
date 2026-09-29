import { describe, expect, it } from 'vitest'
import { completeBranches, normalizeBranches, pickBranch } from './quizBranches'

describe('normalizeBranches', () => {
  it('过滤越界下标、空文本与重复下标', () => {
    const branches = normalizeBranches(
      [
        { choiceIndex: 0, text: '答对了！', emotion: 'happy' },
        { choiceIndex: 4, text: '越界' },
        { choiceIndex: 1, text: '   ' },
        { choiceIndex: 1, text: '第一次的纠正', emotion: 'serious' },
        { choiceIndex: '2', text: '字符串下标也算' }
      ],
      3
    )
    expect(branches.map((branch) => branch.choiceIndex)).toEqual([0, 1, 2])
    expect(branches[0].emotion).toBe('happy')
    expect(branches[1].text).toBe('第一次的纠正')
  })

  it('未知情绪回落到 neutral', () => {
    const [branch] = normalizeBranches([{ choiceIndex: 0, text: '嗯', emotion: 'weird' }], 2)
    expect(branch.emotion).toBe('neutral')
  })

  it('非数组输入返回空', () => {
    expect(normalizeBranches(undefined, 3)).toEqual([])
    expect(normalizeBranches('nope', 3)).toEqual([])
  })
})

describe('completeBranches', () => {
  const question = {
    options: ['最陡上坡方向', '最陡下坡方向', '随机方向'],
    answerIndex: 0,
    explanation: '梯度指向函数增长最快的方向。',
    branches: [{ choiceIndex: 1, text: '下坡是负梯度，别搞混啦。', emotion: 'serious' }]
  }

  it('保留模型给的分支，并按 explanation 补齐缺失项', () => {
    const branches = completeBranches(question)
    expect(branches).toHaveLength(3)
    expect(branches[1].text).toBe('下坡是负梯度，别搞混啦。')
    expect(branches[0].text).toContain('答对了')
    expect(branches[0].emotion).toBe('happy')
    expect(branches[2].text).toContain('最陡上坡方向')
    expect(branches[2].emotion).toBe('serious')
  })

  it('没有 explanation 时也能给出兜底台词', () => {
    const branches = completeBranches({ ...question, explanation: '', branches: [] })
    expect(branches[0].text).toContain('答对了')
    expect(branches[2].text).toContain('正确答案')
  })
})

describe('pickBranch', () => {
  it('按选项下标取分支，取不到返回 null', () => {
    const branches = completeBranches({
      options: ['A', 'B'],
      answerIndex: 1,
      explanation: '解析',
      branches: []
    })
    expect(pickBranch({ branches }, 1)?.emotion).toBe('happy')
    expect(pickBranch({ branches }, 9)).toBeNull()
    expect(pickBranch({ branches: null }, 0)).toBeNull()
  })
})
