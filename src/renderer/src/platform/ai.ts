/**
 * 移动端的 AI 能力（浏览器 fetch 直连提供商）。
 * 容错解析与 token 策略直接复用主进程里的纯函数模块（@mainlib/*）。
 */
import { parseDialogueJson } from '@mainlib/jsonLines'
import { parseQuizQuestions } from '@mainlib/quizParse'
import { SAFE_FALLBACK_TOKENS, clampMaxTokens, estimateScriptTokens, isMaxTokenError, parseAllowedMaxTokens, tokenCandidates } from '@mainlib/aiTokens'
import { getSettings, findNodeIn, readLibrary, saveScript, getScript, listCharacters, listAttempts, writeAttempts } from './store'
import { newId } from './util'
import type {
  AIProviderConfig,
  ChatRequest,
  ChatResponse,
  DialogueLine,
  GalGenerateOptions,
  GalScript,
  QuizQuestion,
  QuizResult,
  QuizStats
} from '@shared/types'

const EMOTIONS = ['neutral', 'happy', 'thinking', 'surprised', 'serious', 'shy', 'excited', 'sad', 'angry']

const normalizeBase = (baseUrl: string): string => baseUrl.replace(/\/+$/, '')

const supportsJsonMode = (provider: AIProviderConfig): boolean => {
  if (/reasoner|r1/i.test(provider.model)) return false
  return provider.kind !== 'ollama'
}

async function pickProvider(capability: string, explicitId?: string | null): Promise<AIProviderConfig> {
  const settings = await getSettings()
  const providers = settings.ai.providers
  const id = explicitId ?? (settings.ai.routing as Record<string, string | null>)[capability]
  const found = (id ? providers.find((item) => item.id === id) : undefined) ?? providers.find((item) => item.enabled)
  if (!found) throw new Error('尚未配置可用的 API 提供商，请前往「设置 → API 与语音」添加')
  return found
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const provider = await pickProvider(request.capability ?? 'chat', request.providerId)
  const maxTokens = clampMaxTokens(request.maxTokens ?? provider.maxTokens)

  if (provider.kind === 'gemini') {
    const system = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    const response = await fetch(`${normalizeBase(provider.baseUrl)}/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...provider.headers },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature: request.temperature ?? provider.temperature,
          maxOutputTokens: maxTokens,
          ...(request.json ? { responseMimeType: 'application/json' } : {})
        }
      })
    })
    if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text().catch(() => '')}`)
    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] }
    return {
      providerId: provider.id,
      model: provider.model,
      content: data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '',
      finishReason: data.candidates?.[0]?.finishReason ?? null
    }
  }

  if (provider.kind === 'anthropic') {
    const system = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
    const messages = request.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))
    const response = await fetch(`${normalizeBase(provider.baseUrl)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        ...provider.headers
      },
      body: JSON.stringify({ model: provider.model, max_tokens: maxTokens, temperature: request.temperature ?? provider.temperature, ...(system ? { system } : {}), messages })
    })
    if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text().catch(() => '')}`)
    const data = (await response.json()) as { content?: { text?: string }[]; stop_reason?: string }
    return {
      providerId: provider.id,
      model: provider.model,
      content: data.content?.map((part) => part.text ?? '').join('') ?? '',
      finishReason: data.stop_reason ?? null
    }
  }

  const useJsonMode = Boolean(request.json) && supportsJsonMode(provider)
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
      max_tokens: maxTokens,
      ...(useJsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  })
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text().catch(() => '')}`)
  const data = (await response.json()) as {
    choices: { message: { content: string }; finish_reason?: string }[]
    usage?: { prompt_tokens: number; completion_tokens: number }
  }
  return {
    providerId: provider.id,
    model: provider.model,
    content: data.choices?.[0]?.message?.content ?? '',
    finishReason: data.choices?.[0]?.finish_reason ?? null,
    usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens } : undefined
  }
}

export async function testProvider(id: string): Promise<{ ok: boolean; message: string; model?: string }> {
  try {
    const response = await chat({ providerId: id, messages: [{ role: 'user', content: 'ping，请只回复 pong' }], temperature: 0, maxTokens: 64 })
    return { ok: true, message: response.content.slice(0, 80) || '连接成功', model: response.model }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

/** 依次尝试一组 token 预算，直到成功。 */
async function chatWithLadder(request: Omit<ChatRequest, 'maxTokens'>, candidates: number[]): Promise<ChatResponse> {
  let lastError: unknown = null
  for (const tokens of candidates) {
    try {
      return await chat({ ...request, maxTokens: tokens })
    } catch (error) {
      lastError = error
      if (!isMaxTokenError((error as Error).message)) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('模型拒绝了当前的 max_tokens 设置')
}

async function runWithLadder(request: Omit<ChatRequest, 'maxTokens'>, target: number, providerMax: number): Promise<ChatResponse> {
  try {
    return await chatWithLadder(request, [target])
  } catch (error) {
    const message = (error as Error).message
    if (!isMaxTokenError(message)) throw error
    return chatWithLadder(
      request,
      tokenCandidates(parseAllowedMaxTokens(message) ?? Math.min(providerMax, SAFE_FALLBACK_TOKENS), [SAFE_FALLBACK_TOKENS, 4096, 2048])
    )
  }
}

/* ------------------------------- 剧本生成 ------------------------------- */

const DEPTH: Record<GalGenerateOptions['depth'], { chars: number; instruction: string }> = {
  summary: { chars: 8000, instruction: '用少量对话概括核心结论与动机，不要展开推导细节。' },
  standard: { chars: 20000, instruction: '覆盖研究问题、方法、结论与关键实验，适度展开讲解。' },
  deep: { chars: 40000, instruction: '逐节深入讲解，包含方法细节、公式直觉、实验设计权衡与可能的局限。' }
}

export async function generateScript(options: GalGenerateOptions, contextText: string): Promise<GalScript> {
  const library = await readLibrary()
  const found = findNodeIn(library, options.sourceId)
  if (!found) throw new Error('找不到源文献，请刷新论文/教材库')

  const characters = await listCharacters()
  const character = characters.find((item) => item.id === options.characterId) ?? characters.find((item) => item.isCompanion) ?? characters[0]
  if (!character) throw new Error('请先创建至少一个角色')

  const provider = await pickProvider('script')
  const budget = DEPTH[options.depth] ?? DEPTH.standard
  const questionCount = options.questionCount && options.questionCount > 0 ? options.questionCount : Math.max(3, Math.min(10, Math.round(options.maxLines / 6)))
  const excerpt = contextText.slice(0, budget.chars)

  const user = [
    `源文献标题：${found.node.title}`,
    `语言：${options.language === 'zh' ? '中文' : 'English'}`,
    `讲解深度指令：${budget.instruction}`,
    `剧本：最多 ${options.maxLines} 行对话。`,
    options.focus ? `重点聚焦：${options.focus}` : '',
    '剧本要求：角色是你（speaker=character），用户是「我」（speaker=user），旁白用 narration。',
    `emotion 只能取以下之一：${EMOTIONS.join(', ')}。`,
    '每行台词尽量控制在 60 字以内。',
    `题目：${questionCount} 道单选题，考察对内容的理解。每题 4 个选项，只有一个正确。`,
    '只输出 JSON：{"lines":[{"speaker":"character","text":"...","emotion":"neutral"}],"questions":[{"question":"题干","options":["A","B","C","D"],"answerIndex":0,"explanation":"解析"}]}',
    '--- 文献内容开始 ---',
    excerpt,
    '--- 文献内容结束 ---'
  ]
    .filter(Boolean)
    .join('\n')

  const request: Omit<ChatRequest, 'maxTokens'> = {
    providerId: provider.id,
    capability: 'script',
    json: true,
    messages: [
      { role: 'system', content: `${character.systemPrompt}\n${character.personality}\n${character.speakingStyle}` },
      { role: 'user', content: user }
    ]
  }
  const providerMax = provider.maxTokens > 0 ? provider.maxTokens : SAFE_FALLBACK_TOKENS
  const response = await runWithLadder(request, estimateScriptTokens(options.maxLines) + questionCount * 260, providerMax)

  const parsedLines = parseDialogueJson(response.content, EMOTIONS)
  if (parsedLines.lines.length === 0) throw new Error('模型没有返回可解析的剧本，请重试或换一个模型。')

  const scriptId = newId('script')
  const lines: DialogueLine[] = parsedLines.lines.slice(0, options.maxLines).map((line) => ({
    id: newId('line'),
    speaker: line.speaker as DialogueLine['speaker'],
    text: line.text,
    emotion: line.emotion
  }))
  const questions: QuizQuestion[] = parseQuizQuestions(response.content).questions.map((item, offset) => ({
    id: newId('quiz'),
    index: offset,
    question: item.question,
    options: item.options,
    answerIndex: item.answerIndex,
    explanation: item.explanation,
    sourceId: found.node.id,
    scriptId,
    createdAt: Date.now()
  }))

  return saveScript({
    id: scriptId,
    sourceId: found.node.id,
    sourceKind: found.kind,
    title: `${found.node.title} · ${character.name}`,
    characterId: character.id,
    lines,
    questions,
    providerId: provider.id,
    model: response.model
  })
}

/* --------------------------------- 问答 --------------------------------- */

export async function generateQuestions(
  input: { sourceId?: string; scriptId?: string | null; contextText?: string; title?: string; count?: number },
  fallbackText = ''
): Promise<{ questions: QuizQuestion[]; truncated: boolean }> {
  const count = Math.min(Math.max(input.count ?? 3, 1), 8)
  const provider = await pickProvider('chat')
  const text = (input.contextText ?? fallbackText ?? '').slice(0, 12000)
  if (!text.trim()) throw new Error('缺少出题所需的正文')

  const response = await runWithLadder(
    {
      providerId: provider.id,
      capability: 'chat',
      json: true,
      messages: [
        { role: 'system', content: '你是一位善于设计理解型单选题的老师。' },
        {
          role: 'user',
          content: [
            `请根据下面的内容出 ${count} 道单选题，考察理解而不是背诵原文。`,
            '每题 4 个选项，只有一个正确；不要出现「以上都对」这类选项。',
            '只输出 JSON：{"questions":[{"question":"题干","options":["A","B","C","D"],"answerIndex":0,"explanation":"解析"}]}',
            '--- 内容开始 ---',
            text,
            '--- 内容结束 ---'
          ].join('\n')
        }
      ]
    },
    estimateScriptTokens(count * 4),
    provider.maxTokens > 0 ? provider.maxTokens : SAFE_FALLBACK_TOKENS
  )

  const parsed = parseQuizQuestions(response.content)
  if (parsed.questions.length === 0) throw new Error('模型没有返回可解析的单选题。')
  return {
    questions: parsed.questions.slice(0, count).map((item, offset) => ({
      id: newId('quiz'),
      index: offset,
      question: item.question,
      options: item.options,
      answerIndex: item.answerIndex,
      explanation: item.explanation,
      sourceId: input.sourceId ?? '',
      scriptId: input.scriptId ?? null,
      createdAt: Date.now()
    })),
    truncated: parsed.truncated
  }
}

export async function generateForScript(scriptId: string, count = 6): Promise<{ questions: QuizQuestion[]; truncated: boolean }> {
  const script = await getScript(scriptId)
  if (!script) throw new Error('剧本不存在')
  const text = script.lines.map((item) => `${item.speaker === 'character' ? '角色' : item.speaker === 'user' ? '我' : '旁白'}：${item.text}`).join('\n')
  const result = await generateQuestions({ sourceId: script.sourceId, scriptId, contextText: text, title: script.title, count }, text)
  await saveScript({ id: script.id, questions: result.questions })
  return result
}

export async function evaluateAnswer(question: QuizQuestion, answer: string): Promise<QuizResult> {
  const picked = Number(answer.trim())
  const answered = Number.isInteger(picked) && picked >= 0
  const correct = answered && picked === question.answerIndex
  const result: QuizResult = {
    correct,
    score: correct ? 1 : 0,
    feedback: correct ? '回答正确！' : answered ? `正确答案是：${question.options[question.answerIndex] ?? ''}` : '还没有作答哦。',
    explanation: question.explanation,
    reference: question.options[question.answerIndex] ?? ''
  }
  const existing = await listAttempts()
  await writeAttempts(
    [
      {
        id: newId('attempt'),
        questionId: question.id,
        sourceId: question.sourceId,
        scriptId: question.scriptId,
        question: question.question,
        answer: answered ? String(picked) : '',
        correct,
        at: Date.now()
      },
      ...existing
    ].slice(0, 2000)
  )
  return result
}

export async function stats(filter: { sourceId?: string; scriptId?: string } = {}): Promise<QuizStats> {
  const attempts = (await listAttempts())
    .filter((item) => (filter.sourceId ? item.sourceId === filter.sourceId : true))
    .filter((item) => (filter.scriptId ? item.scriptId === filter.scriptId : true))
  const correct = attempts.filter((item) => item.correct).length
  return { total: attempts.length, correct, accuracy: attempts.length > 0 ? correct / attempts.length : 0 }
}
