import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

export class JsonStore<T> {
  constructor(
    private readonly file: string,
    private readonly fallback: T
  ) {}

  private clone(): T {
    return JSON.parse(JSON.stringify(this.fallback)) as T
  }

  read(): T {
    try {
      if (!existsSync(this.file)) return this.clone()
      const raw = readFileSync(this.file, 'utf8').trim()
      if (!raw) return this.clone()
      return JSON.parse(raw) as T
    } catch {
      return this.clone()
    }
  }

  write(value: T): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  update(mutator: (current: T) => T | void): T {
    const current = this.read()
    const next = mutator(current) ?? current
    this.write(next)
    return next
  }
}
