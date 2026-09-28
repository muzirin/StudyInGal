import { describe, expect, it } from 'vitest'
import { parseDialogueJson } from './jsonLines'

const EMOTIONS = ['neutral', 'happy', 'thinking', 'serious']

describe('parseDialogueJson', () => {
  it('解析标准 {"lines": []} 结构', () => {
    const result = parseDialogueJson(
      '{"lines":[{"speaker":"character","text":"你好","emotion":"happy"},{"speaker":"user","text":"嗯"}]}',
      EMOTIONS
    )
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]).toEqual({ speaker: 'character', text: '你好', emotion: 'happy' })
    expect(result.lines[1].emotion).toBe('neutral')
    expect(result.salvaged).toBe(false)
  })

  it('解析被 ```json 包裹的内容', () => {
    const result = parseDialogueJson('```json\n{"lines":[{"speaker":"character","text":"好的"}]}\n```', EMOTIONS)
    expect(result.lines).toHaveLength(1)
    expect(result.salvaged).toBe(false)
  })

  it('解析顶层数组', () => {
    const result = parseDialogueJson('[{"speaker":"narration","text":"（旁白）"}]', EMOTIONS)
    expect(result.lines[0].speaker).toBe('narration')
  })

  it('截断的数组：保留完整对象并标记 truncated', () => {
    // 第三个对象被截断
    const truncated = '{"lines":[{"speaker":"character","text":"第一句"},{"speaker":"character","text":"第二句"},{"speaker":"character","text":"第三'
    const result = parseDialogueJson(truncated, EMOTIONS)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[1].text).toBe('第二句')
    expect(result.truncated).toBe(true)
    expect(result.salvaged).toBe(true)
  })

  it('对象内有未转义换行时用正则兜底', () => {
    const messy = '{"lines":[{"speaker":"character","text":"第一行\n第二行","emotion":"happy"}]}'
    const result = parseDialogueJson(messy, EMOTIONS)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].text).toContain('第二行')
  })

  it('忽略无法识别的情绪与说话人', () => {
    const result = parseDialogueJson('{"lines":[{"speaker":"narrator","text":"嘿","emotion":"angry"}]}', EMOTIONS)
    expect(result.lines[0].speaker).toBe('character')
    expect(result.lines[0].emotion).toBe('neutral')
  })

  it('丢弃空文本行', () => {
    const result = parseDialogueJson('{"lines":[{"speaker":"character","text":"   "},{"speaker":"character","text":"ok"}]}', EMOTIONS)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].text).toBe('ok')
  })

  it('完全无法解析时返回空数组而不是抛错', () => {
    const result = parseDialogueJson('抱歉，我无法完成这个请求。', EMOTIONS)
    expect(result.lines).toHaveLength(0)
    expect(result.salvaged).toBe(true)
  })

  it('处理转义引号与换行', () => {
    const result = parseDialogueJson(
      '{"lines":[{"speaker":"character","text":"他说\\"你好\\"\\n然后离开"}]}',
      EMOTIONS
    )
    expect(result.lines[0].text).toBe('他说"你好"\n然后离开')
  })
})
