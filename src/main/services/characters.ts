import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import { isPristineLegacyDefault } from '../lib/legacyCharacter'
import { CHARACTERS_FILE } from '@shared/constants'
import type { Character } from '@shared/types'

const store = new JsonStore<Character[]>(join(dataDir(), CHARACTERS_FILE), [])

function load(): Character[] {
  const current = store.read()
  const cleaned = current.filter((item) => !isPristineLegacyDefault(item))
  if (cleaned.length !== current.length) store.write(cleaned)
  return cleaned
}

export function listCharacters(): Character[] {
  return load()
}

export function upsertCharacter(input: Partial<Character>): Character {
  const list = load()
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
    id: input.id ?? newId('char'),
    name: input.name ?? '新角色',
    avatar: input.avatar ?? '🙂',
    personality: input.personality ?? '',
    speakingStyle: input.speakingStyle ?? '',
    greeting: input.greeting ?? '',
    systemPrompt: input.systemPrompt ?? '',
    sprites: input.sprites ?? [],
    voice: input.voice ?? { providerId: null, voiceId: '', rate: 1, pitch: 1 },
    live2d: input.live2d ?? null,
    tags: input.tags ?? [],
    isCompanion: input.isCompanion ?? false,
    createdAt: now,
    updatedAt: now
  }
  store.write([...list, created])
  return created
}

export function removeCharacter(id: string): void {
  const list = load().filter((item) => item.id !== id)
  store.write(list)
}
