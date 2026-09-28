import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

export interface WalkedFile {
  relative: string
  absolute: string
  sizeBytes: number
  modifiedAt: number
}

export async function walkFiles(root: string, depth = 0): Promise<WalkedFile[]> {
  if (depth > 8) return []
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const files: WalkedFile[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const absolute = join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute, depth + 1)))
    } else {
      const info = await stat(absolute).catch(() => null)
      if (!info) continue
      files.push({
        relative: relative(root, absolute).replace(/\\/g, '/'),
        absolute,
        sizeBytes: info.size,
        modifiedAt: info.mtimeMs
      })
    }
  }
  return files
}

export async function fileStat(target: string): Promise<{ sizeBytes: number; modifiedAt: number } | null> {
  try {
    const info = await stat(target)
    return { sizeBytes: info.size, modifiedAt: info.mtimeMs }
  } catch {
    return null
  }
}
