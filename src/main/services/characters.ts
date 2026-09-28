import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { CHARACTERS_FILE } from '@shared/constants'
import type { Character } from '@shared/types'

const store = new JsonStore<Character[]>(join(dataDir(), CHARACTERS_FILE), [])

const DEFAULT_CHARACTER: Character = {
  id: 'char_sakura',
  name: '小樱',
  avatar: '🌸',
  personality: '温柔耐心、逻辑清晰，偶尔有点小傲娇的学霸学姐。喜欢把枯燥的知识讲成故事。',
  speakingStyle: '亲切自然，偶尔用「呢」「哦」「～」，讲解时先给结论再展开，遇到难点会放慢语速。',
  greeting: '欢迎回来～今天想学点什么呀？',
  systemPrompt: [
    '你是 StudyInGal 的伴学娘「小樱」。',
    '你的职责是陪伴用户学习、讲解论文与教材、出题与答疑，并在用户分心时温和提醒。',
    '保持角色一致性：温柔、耐心、条理清晰，偶尔俏皮但绝不敷衍。',
    '讲解时使用结构化表达，必要时用小标题与要点。不要编造不存在的内容，不确定时明确说明。'
  ].join('\n'),
  sprites: [],
  voice: { providerId: null, voiceId: '', rate: 1, pitch: 1 },
  live2d: null,
  tags: ['默认', '学姐'],
  isCompanion: true,
  createdAt: Date.now(),
  updatedAt: Date.now()
}

function ensureSeed(): Character[] {
  const current = store.read()
  if (current.length > 0) return current
  const seeded = [DEFAULT_CHARACTER]
  store.write(seeded)
  return seeded
}

export function listCharacters(): Character[] {
  return ensureSeed()
}

export function upsertCharacter(input: Partial<Character>): Character {
  const list = ensureSeed()
  const now = Date.now()
  if (input.id) {
    const index = list.findIndex((item) => item.id === input.id)
    if (index >= 0) {
      const merged: Character = { ...list[index], ...input, id: list[index].id, updatedAt: now }
      list[index] = merged
      store.write(list)
      return merged
    }
  }
  const created: Character = {
    ...DEFAULT_CHARACTER,
    ...input,
    id: input.id ?? newId('char'),
    createdAt: now,
    updatedAt: now,
    isCompanion: input.isCompanion ?? false
  }
  store.write([...list, created])
  return created
}

export function removeCharacter(id: string): void {
  const list = ensureSeed().filter((item) => item.id !== id)
  store.write(list)
}
