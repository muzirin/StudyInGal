import type { Character } from '@shared/types'

/**
 * 旧版本会内置一个默认角色「小樱」并写入用户数据。
 * 现在不再自动创建角色，这里保留她的特征指纹，用于识别并清理历史数据：
 * 只有「完全没被改动过」的内置角色会被删掉，用户改过的角色一律保留。
 */
const LEGACY_DEFAULT_ID = 'char_sakura'
const LEGACY_DEFAULT_NAME = '小樱'
/** 桌面端旧版内置角色的 systemPrompt */
const LEGACY_PROMPT_DESKTOP = [
  '你是 StudyInGal 的伴学娘「小樱」。',
  '你的职责是陪伴用户学习、讲解论文与教材、出题与答疑，并在用户分心时温和提醒。',
  '保持角色一致性：温柔、耐心、条理清晰，偶尔俏皮但绝不敷衍。',
  '讲解时使用结构化表达，必要时用小标题与要点。不要编造不存在的内容，不确定时明确说明。'
].join('\n')
/** 移动端旧版内置角色的 systemPrompt（少一句，两个端都要能清理） */
const LEGACY_PROMPT_MOBILE = [
  '你是 StudyInGal 的伴学娘「小樱」。',
  '你的职责是陪伴用户学习、讲解论文与教材、出题与答疑，并在用户分心时温和提醒。',
  '保持角色一致性：温柔、耐心、条理清晰，偶尔俏皮但绝不敷衍。'
].join('\n')

const LEGACY_PROMPTS = [LEGACY_PROMPT_DESKTOP, LEGACY_PROMPT_MOBILE]

export const isPristineLegacyDefault = (
  character: Pick<Character, 'id' | 'name' | 'systemPrompt'>
): boolean =>
  character.id === LEGACY_DEFAULT_ID &&
  character.name === LEGACY_DEFAULT_NAME &&
  LEGACY_PROMPTS.includes(character.systemPrompt)
