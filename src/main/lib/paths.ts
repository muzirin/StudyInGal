import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

function ensure(dir: string): string {
  mkdirSync(dir, { recursive: true })
  return dir
}

export const userDataDir = (): string => app.getPath('userData')
export const dataDir = (): string => ensure(join(userDataDir(), 'data'))
export const libraryDir = (): string => ensure(join(userDataDir(), 'library'))
export const cacheDir = (): string => ensure(join(userDataDir(), 'cache'))
export const scriptsDir = (): string => ensure(join(userDataDir(), 'scripts'))
export const archiveDir = (): string => ensure(join(userDataDir(), 'archive'))
export const workshopDir = (): string => ensure(join(userDataDir(), 'workshop'))
export const charactersDir = (): string => ensure(join(userDataDir(), 'characters'))
export const playgroundDir = (): string => ensure(join(userDataDir(), 'playground'))
export const tempDir = (): string => ensure(join(app.getPath('temp'), 'study-in-gal'))

export const dataFile = (name: string): string => join(dataDir(), name)
