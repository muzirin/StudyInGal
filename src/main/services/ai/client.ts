import { getSettings, updateSettings } from '../settings'
import type {
  AICapability,
  AIProviderConfig,
  ChatMessage,
  ChatRequest,
  ChatResponse
} from '@shared/types'

export function listProviders(): AIProviderConfig[] {
  return getSettings().ai.providers
}

export function saveProvider(provider: AIProviderConfig): AIProviderConfig[] {
  const providers = getSettings().ai.providers.filter((item) => item.id !== provider.id)
  updateSettings({ ai: { ...getSettings().ai, providers: [...providers, provider] } })
  return getSettings().ai.providers
}

export function removeProvider(id: string): AIProviderConfig[] {
  const providers = getSettings().ai.providers.filter((item) => item.id !== id)
  const routing = { ...getSettings().ai.routing }
  for (const key of Object.keys(routing) as AICapability[]) {
    if (routing[key] === id) routing[key] = null
  }
  updateSettings({ ai: { ...getSettings().ai, providers, routing } })
  return getSettings().ai.providers
}

export function setRouting(routing: Record<string, string | null>): AIProviderConfig[] {
  const merged = { ...getSettings().ai.routing, ...routing }
  updateSettings({ ai: { ...getSettings().ai, routing: merged } })
  return getSettings().ai.providers
}

export function resolveProvider(capability: AICapability = 'chat', explicitId?: string | null): AIProviderConfig {
  const config = getSettings().ai.providers
  const providerId = explicitId ?? getSettings().ai.routing[capability]
  if (providerId) {
    const provider = config.find((item) => item.id === providerId)
    if (provider) return provider
  }
  const fallback = config.find((item) => item.enabled)
  if (fallback) return fallback
  throw new Error('尚未配置可用的 API 提供商，请前往「设置 → API 提供商」添加')
}

const normalizeBase = (baseUrl: string): string => baseUrl.replace(/\/+$/, '')

async function callOpenAICompatible(provider: AIProviderConfig, request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${normalizeBase(provider.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      ...provider.headers
    },
    body: JSON.stringify({
      model: provider.model,
      messages: request.messages,
      temperature: request.temperature ?? provider.temperature,
      max_tokens: provider.maxTokens,
      ...(request.json ? { response_format: { type: 'json_object' } } : {})
    })
  })
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text().catch(() => '')}`)
  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
    usage?: { prompt_tokens: number; completion_tokens: number }
  }
  return {
    providerId: provider.id,
    model: provider.model,
    content: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage
      ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
      : undefined
  }
}

async function callGemini(provider: AIProviderConfig, request: ChatRequest): Promise<ChatResponse> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n')
  const contents = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }))
  const response = await fetch(
    `${normalizeBase(provider.baseUrl)}/models/${provider.model}:generateContent?key=${provider.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...provider.headers },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: request.temperature ?? provider.temperature,
          maxOutputTokens: provider.maxTokens,
          ...(request.json ? { responseMimeType: 'application/json' } : {})
        }
      })
    }
  )
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text().catch(() => '')}`)
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return {
    providerId: provider.id,
    model: provider.model,
    content: data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
  }
}

async function callAnthropic(provider: AIProviderConfig, request: ChatRequest): Promise<ChatResponse> {
  const system = request.messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n')
  const messages = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }))
  const response = await fetch(`${normalizeBase(provider.baseUrl)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      ...provider.headers
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: provider.maxTokens,
      temperature: request.temperature ?? provider.temperature,
      ...(system ? { system } : {}),
      messages
    })
  })
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text().catch(() => '')}`)
  const data = (await response.json()) as { content?: { text?: string }[] }
  return {
    providerId: provider.id,
    model: provider.model,
    content: data.content?.map((part) => part.text ?? '').join('') ?? ''
  }
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const provider = resolveProvider(request.capability ?? 'chat', request.providerId)
  switch (provider.kind) {
    case 'gemini':
      return callGemini(provider, request)
    case 'anthropic':
      return callAnthropic(provider, request)
    default:
      return callOpenAICompatible(provider, request)
  }
}

export async function testProvider(id: string): Promise<{ ok: boolean; message: string; model?: string }> {
  const provider = getSettings().ai.providers.find((item) => item.id === id)
  if (!provider) return { ok: false, message: '提供商不存在' }
  try {
    const response = await chat({
      providerId: id,
      messages: [{ role: 'user', content: 'ping，请只回复 pong' } as ChatMessage],
      temperature: 0
    })
    return { ok: true, message: response.content.slice(0, 120) || '连接成功', model: response.model }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}
