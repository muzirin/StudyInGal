import { describe, expect, it } from 'vitest'
import { parseQuizQuestions } from './quizParse'

describe('parseQuizQuestions', () => {
  it('解析标准 {"questions": []} 结构', () => {
    const content =
      '{"questions":[{"question":"梯度下降的方向是什么？","options":["最陡上坡方向","最陡下坡方向","随机方向","水平方向"],"answerIndex":1,"explanation":"梯度是最陡上坡，反方向才是下坡。"}]}'
    const { questions, truncated } = parseQuizQuestions(content)
    expect(questions).toHaveLength(1)
    expect(questions[0].answerIndex).toBe(1)
    expect(questions[0].options[1]).toBe('最陡下坡方向')
    expect(truncated).toBe(false)
  })

  it('解析 ```json 代码块包裹', () => {
    const content = '```json\n{"questions":[{"question":"什么是学习率？","options":["步长","层数","批大小","轮数"],"answerIndex":0}]}\n```'
    const { questions } = parseQuizQuestions(content)
    expect(questions[0].options).toHaveLength(4)
    expect(questions[0].answerIndex).toBe(0)
  })

  it('截断时保留完整题目并标记 truncated', () => {
    const content =
      '{"questions":[{"question":"第一题","options":["A","B","C","D"],"answerIndex":2},{"question":"第二题","options":["A","B","C","D"],"answerIndex":0},{"question":"第三'
    const { questions, truncated } = parseQuizQuestions(content)
    expect(questions).toHaveLength(2)
    expect(questions[1].question).toBe('第二题')
    expect(truncated).toBe(true)
  })

  it('丢弃缺少选项或答案的条目（只收单选题）', () => {
    const content =
      '{"questions":[{"question":"无选项题"},{"question":"有选项但无答案","options":["A","B"]},{"question":"有效题","options":["A","B","C","D"],"answerIndex":3}]}'
    const { questions } = parseQuizQuestions(content)
    expect(questions).toHaveLength(1)
    expect(questions[0].question).toBe('有效题')
  })

  it('answerIndex 越界时收敛到最后一个选项', () => {
    const { questions } = parseQuizQuestions('{"questions":[{"question":"题","options":["A","B"],"answerIndex":9}]}')
    expect(questions[0].answerIndex).toBe(1)
  })

  it('无法解析时返回空数组而不抛错', () => {
    const { questions } = parseQuizQuestions('抱歉，我无法出题。')
    expect(questions).toHaveLength(0)
  })
})
