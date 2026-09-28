import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { deepMerge } from '../lib/util'
import { DEFAULT_SETTINGS, SETTINGS_FILE } from '@shared/constants'
import type { AppSettings } from '@shared/types'

const store = new JsonStore<AppSettings>(join(dataDir(), SETTINGS_FILE), DEFAULT_SETTINGS)

/** 当前设置结构版本；用于把旧版本里偏大的圆角等默认值迁移到新语义。 */
const SETTINGS_SCHEMA_VERSION = 2

function migrate(settings: AppSettings): AppSettings {
  const version = settings.schemaVersion ?? 1
  if (version >= SETTINGS_SCHEMA_VERSION) return settings

  const migrated: AppSettings = { ...settings, schemaVersion: SETTINGS_SCHEMA_VERSION }
  // v1 的默认圆角是 16（在 MUI 中会被放大成很大的圆角），v2 起整体收小
  if (!migrated.theme || migrated.theme.radius === undefined || migrated.theme.radius >= 14) {
    migrated.theme = { ...DEFAULT_SETTINGS.theme, ...(migrated.theme ?? {}), radius: DEFAULT_SETTINGS.theme.radius }
  }
  return migrated
}

const loaded = migrate(store.read())
let cache: AppSettings = deepMerge(DEFAULT_SETTINGS, loaded)
store.write(cache)

export function getSettings(): AppSettings {
  return cache
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  cache = deepMerge(cache, patch)
  store.write(cache)
  return cache
}

export function resetSettings(): AppSettings {
  cache = deepMerge(DEFAULT_SETTINGS, {})
  store.write(cache)
  return cache
}
