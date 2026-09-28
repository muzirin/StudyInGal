import type { AppSettings, AIProviderConfig } from './types'

export const APP_NAME = 'StudyInGal'
export const APP_ID = 'com.muzirin.studyingal'
export const GITHUB_OWNER = 'muzirin'
export const GITHUB_REPO = 'StudyInGal'
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues/new`
export const LICENSE = 'GPL-3.0-or-later'

export const SETTINGS_FILE = 'settings.json'
export const LIBRARY_FILE = 'library.json'
export const ARCHIVE_FILE = 'archive.json'
export const SCHEDULE_FILE = 'schedule.json'
export const CHARACTERS_FILE = 'characters.json'
export const MOUNTS_FILE = 'mounts.json'
export const SCRIPTS_FILE = 'scripts.json'
export const SECRETS_FILE = 'secrets.json'

export function defaultProvider(
  kind: AIProviderConfig['kind'],
  overrides: Partial<AIProviderConfig> = {}
): AIProviderConfig {
  const presets: Record<AIProviderConfig['kind'], Partial<AIProviderConfig>> = {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    gemini: {
      name: 'Google Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-2.0-flash'
    },
    anthropic: { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest' },
    ollama: { name: 'Ollama (本地)', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' },
    'openai-compatible': { name: '自定义 OpenAI 兼容', baseUrl: 'http://127.0.0.1:8000/v1', model: 'local-model' }
  }
  const preset = presets[kind]
  return {
    id: `prov_${kind}_${Math.random().toString(36).slice(2, 8)}`,
    name: preset.name ?? kind,
    kind,
    baseUrl: preset.baseUrl ?? '',
    apiKey: '',
    model: preset.model ?? '',
    enabled: false,
    temperature: 0.8,
    maxTokens: 8192,
    headers: {},
    ...overrides
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 2,
  theme: {
    palette: 'sakura',
    mode: 'system',
    navPosition: 'left',
    density: 'comfortable',
    touchOptimized: false,
    radius: 6
  },
  locale: 'zh-CN',
  library: {
    roots: { paper: '', textbook: '' },
    autoOcr: false,
    ocrLanguage: 'chi_sim+eng'
  },
  ai: {
    providers: [],
    routing: { script: null, chat: null, tts: null, stt: null, vision: null, embedding: null },
    tts: {
      engine: 'webspeech',
      providerId: null,
      voice: '',
      rate: 1,
      pitch: 1
    }
  },
  companion: {
    activeCharacterId: null,
    proactive: false,
    proactiveIntervalMinutes: 45,
    proactivePrompt: '请根据我最近的学习进度，主动和我聊一句，鼓励或提醒我。',
    showBubbles: true
  },
  home: {
    sceneId: 'classroom-dusk',
    autoScene: true,
    customScenes: []
  },
  quiz: {
    autoAtSceneEnd: true,
    count: 3
  },
  live2d: {
    enabled: false,
    modelPath: null,
    coreUrl: '',
    scale: 1,
    x: 0.5,
    y: 0,
    opacity: 1
  },
  editor: {
    fontFamily: 'JetBrains Mono, Consolas, monospace',
    fontSize: 15,
    autosave: true,
    autosaveMs: 1500
  },
  developer: {
    enabled: false,
    terminalShell: '',
    openDevToolsOnStart: false
  },
  telemetry: {
    crashReporting: true,
    autoIssueDraft: true
  },
  sync: {
    autoSync: false,
    intervalMinutes: 15,
    mountId: null
  },
  playground: {
    installed: false,
    installPath: ''
  },
  xuexitong: {
    enabled: false,
    baseUrl: ''
  },
  desktop: {
    trayEnabled: true,
    closeToTray: false,
    globalAskShortcut: 'CommandOrControl+Shift+Space'
  },
  workshop: {
    registryUrl: ''
  },
  nav: {
    pinned: ['dashboard', 'library-paper', 'companion'],
    hidden: []
  }
}

export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.md',
  '.markdown',
  '.tex',
  '.latex',
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.html',
  '.htm',
  '.epub'
]

export const EDITABLE_EXTENSIONS = ['.md', '.markdown', '.tex', '.latex', '.txt']
