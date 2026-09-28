import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { newId } from '../lib/util'
import type { Conversation, ConversationMessage } from '@shared/types'

const store = new JsonStore<Conversation[]>(join(dataDir(), 'conversations.json'), [])
const MAX_CONVERSATIONS = 200

export function listConversations(characterId?: string): Conversation[] {
  const list = store.read().sort((a, b) => b.updatedAt - a.updatedAt)
  return characterId ? list.filter((item) => item.characterId === characterId) : list
}

export function appendMessage(input: {
  conversationId?: string
  characterId: string
  sourceId?: string
  message: Omit<ConversationMessage, 'id' | 'at'> & { at?: number }
}): Conversation {
  const list = store.read()
  const now = Date.now()
  const message: ConversationMessage = {
    id: newId('msg'),
    role: input.message.role,
    content: input.message.content,
    emotion: input.message.emotion ?? 'neutral',
    at: input.message.at ?? now
  }

  let conversation = input.conversationId ? list.find((item) => item.id === input.conversationId) : undefined
  if (!conversation) {
    conversation = {
      id: input.conversationId ?? newId('conv'),
      characterId: input.characterId,
      title: input.message.role === 'user' ? input.message.content.slice(0, 24) : '新的对话',
      sourceId: input.sourceId ?? '',
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    list.unshift(conversation)
  }

  conversation.messages = [...conversation.messages, message]
  conversation.updatedAt = now
  if (conversation.title === '新的对话' && input.message.role === 'assistant') {
    conversation.title = input.message.content.replace(/[#*>\n]/g, ' ').trim().slice(0, 24) || '新的对话'
  }

  const trimmed = list.slice(0, MAX_CONVERSATIONS)
  store.write(trimmed)
  return conversation
}

export function renameConversation(id: string, title: string): Conversation[] {
  const list = store.read().map((item) => (item.id === id ? { ...item, title, updatedAt: Date.now() } : item))
  store.write(list)
  return list
}

export function removeConversation(id: string): Conversation[] {
  const list = store.read().filter((item) => item.id !== id)
  store.write(list)
  return list
}
