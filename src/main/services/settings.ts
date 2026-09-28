import { join } from 'node:path'
import { JsonStore } from '../lib/jsonStore'
import { dataDir } from '../lib/paths'
import { deepMerge } from '../lib/util'
import { DEFAULT_SETTINGS, SETTINGS_FILE } from '@shared/constants'
import type { AppSettings } from '@shared/types'

const store = new JsonStore<AppSettings>(join(dataDir(), SETTINGS_FILE), DEFAULT_SETTINGS)

let cache: AppSettings = deepMerge(DEFAULT_SETTINGS, store.read())

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
