import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { newId } from '../lib/util'
import { emitEvent } from '../lib/events'
import { tempDir } from '../lib/paths'
import type { TerminalSpawnOptions } from '@shared/types'

interface Session {
  id: string
  child: ChildProcessWithoutNullStreams
  shell: string
}

const sessions = new Map<string, Session>()

function defaultShell(): string {
  if (process.platform === 'win32') return process.env.SHELL || 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
}

export function createTerminal(options: TerminalSpawnOptions = {}): { sessionId: string } {
  const shell = options.shell || defaultShell()
  const id = newId('term')
  const child = spawn(shell, shell.endsWith('powershell.exe') || shell.endsWith('pwsh.exe') ? ['-NoLogo', '-NoProfile'] : ['-i'], {
    cwd: options.cwd || tempDir(),
    env: { ...process.env, TERM: 'xterm-256color' },
    windowsHide: true
  }) as ChildProcessWithoutNullStreams

  child.stdout.on('data', (data: Buffer) =>
    emitEvent({ type: 'terminal-data', payload: { sessionId: id, type: 'stdout', data: data.toString('utf8') } })
  )
  child.stderr.on('data', (data: Buffer) =>
    emitEvent({ type: 'terminal-data', payload: { sessionId: id, type: 'stderr', data: data.toString('utf8') } })
  )
  child.on('exit', (code) => {
    emitEvent({ type: 'terminal-data', payload: { sessionId: id, type: 'exit', data: '', code: code ?? 0 } })
    sessions.delete(id)
  })
  child.on('error', (error) => {
    emitEvent({
      type: 'terminal-data',
      payload: { sessionId: id, type: 'stderr', data: `\n[启动失败] ${error.message}\n` }
    })
  })

  sessions.set(id, { id, child, shell })
  return { sessionId: id }
}

export function writeTerminal(sessionId: string, data: string): void {
  sessions.get(sessionId)?.child.stdin.write(data)
}

export function resizeTerminal(sessionId: string, _cols: number, _rows: number): void {
  void sessionId
  void _cols
  void _rows
}

export function killTerminal(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.child.kill()
  sessions.delete(sessionId)
}

export function listTerminals(): string[] {
  return [...sessions.keys()]
}

export function killAllTerminals(): void {
  for (const id of [...sessions.keys()]) killTerminal(id)
}

export function which(command: string): string | null {
  const locator = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(locator, [command], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) return null
  const first = (result.stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0]
  return first ?? null
}

export function versionOf(command: string, args: string[] = ['--version']): string | null {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 8000 })
  if (result.status !== 0 && !result.stdout) return null
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  return output.split(/\r?\n/)[0]?.trim() || null
}
