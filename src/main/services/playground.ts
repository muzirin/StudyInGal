import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getSettings, updateSettings } from './settings'
import { versionOf, which } from './terminal'
import { playgroundDir, tempDir } from '../lib/paths'
import type { RunCodeRequest, RunCodeResult, RuntimeInfo } from '@shared/types'

const PLAYGROUND_REPO = 'https://github.com/muzirin/StudyInGal-playground'

interface RuntimeSpec {
  id: string
  name: string
  command: string
  versionArgs: string[]
  extension: string
  compile?: { command: string; args: (file: string) => string[] }
  run: { command: string; args: (file: string) => string[] }
}

const SPECS: RuntimeSpec[] = [
  {
    id: 'c',
    name: 'C (gcc)',
    command: 'gcc',
    versionArgs: ['--version'],
    extension: 'main.c',
    compile: { command: 'gcc', args: (file) => [file, '-o', 'main.exe'] },
    run: { command: join('.', 'main.exe'), args: () => [] }
  },
  {
    id: 'cpp',
    name: 'C++ (g++)',
    command: 'g++',
    versionArgs: ['--version'],
    extension: 'main.cpp',
    compile: { command: 'g++', args: (file) => [file, '-std=c++17', '-o', 'main.exe'] },
    run: { command: join('.', 'main.exe'), args: () => [] }
  },
  {
    id: 'python',
    name: 'Python',
    command: 'python',
    versionArgs: ['--version'],
    extension: 'main.py',
    run: { command: 'python', args: (file) => [file] }
  },
  {
    id: 'javascript',
    name: 'Node.js',
    command: 'node',
    versionArgs: ['--version'],
    extension: 'main.js',
    run: { command: 'node', args: (file) => [file] }
  },
  {
    id: 'java',
    name: 'Java',
    command: 'java',
    versionArgs: ['-version'],
    extension: 'Main.java',
    compile: { command: 'javac', args: () => ['Main.java'] },
    run: { command: 'java', args: () => ['Main'] }
  },
  {
    id: 'csharp',
    name: 'C# (.NET)',
    command: 'dotnet',
    versionArgs: ['--version'],
    extension: 'Program.cs',
    run: { command: 'dotnet', args: () => ['run', '--nologo'] }
  }
]

interface RuntimeInfoSpec {
  id: string
  name: string
  command: string
  versionArgs: string[]
  extension: string
}

const MSVC_SPEC: RuntimeInfoSpec & Partial<RuntimeSpec> = {
  id: 'msvc',
  name: 'MSVC (cl.exe)',
  command: 'cl',
  versionArgs: ['/?'],
  extension: 'main.c'
}

export function listRuntimes(): RuntimeInfo[] {
  const specs: RuntimeInfoSpec[] = [...SPECS, MSVC_SPEC]
  return specs.map((spec) => {
    const path = which(spec.command)
    return {
      id: spec.id,
      name: spec.name,
      command: spec.command,
      version: path ? versionOf(spec.command, spec.versionArgs) : null,
      available: Boolean(path),
      path
    }
  })
}

function execCapture(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  stdin?: string
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true, env: process.env })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    child.stdout.on('data', (data: Buffer) => (stdout += data.toString('utf8')))
    child.stderr.on('data', (data: Buffer) => (stderr += data.toString('utf8')))
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: `${stderr}${error.message}`, timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
    if (stdin !== undefined) child.stdin.end(stdin)
    else child.stdin.end()
  })
}

export async function runCode(request: RunCodeRequest): Promise<RunCodeResult> {
  const spec = SPECS.find((item) => item.id === request.language)
  if (!spec) {
    if (request.language === 'msvc') {
      throw new Error('MSVC 仅用于环境检测：cl.exe 需要在 "Developer Command Prompt" 中运行，请改用 gcc/g++ 或从该终端启动 StudyInGal')
    }
    throw new Error(`暂不支持的语言：${request.language}`)
  }
  const needed = [spec.run.command, spec.compile?.command].filter(Boolean) as string[]
  const missing = needed.filter((command) => !which(command))
  if (missing.length > 0) {
    throw new Error(`未检测到可执行环境：${[...new Set(missing)].join(', ')}。请先安装对应运行时，或在「代码练习场」顶部查看检测结果。`)
  }

  const workdir = join(tempDir(), 'playground', `${Date.now()}`)
  await mkdir(workdir, { recursive: true })

  const started = Date.now()
  try {
    await writeFile(join(workdir, spec.extension), request.code, 'utf8')

    if (spec.id === 'csharp') {
      await writeFile(
        join(workdir, 'playground.csproj'),
        '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>',
        'utf8'
      )
    }

    let stdout = ''
    let stderr = ''

    if (spec.compile) {
      const compiled = await execCapture(spec.compile.command, spec.compile.args(spec.extension), workdir, 30000)
      stdout += compiled.stdout
      stderr += compiled.stderr
      if (compiled.code !== 0) {
        return {
          language: spec.id,
          command: `${spec.compile.command} ${spec.compile.args(spec.extension).join(' ')}`,
          exitCode: compiled.code,
          stdout,
          stderr,
          durationMs: Date.now() - started,
          timedOut: compiled.timedOut
        }
      }
    }

    const runArgs = spec.run.args(spec.extension)
    const result = await execCapture(spec.run.command, runArgs, workdir, 20000, request.stdin)
    return {
      language: spec.id,
      command: `${spec.run.command} ${runArgs.join(' ')}`.trim(),
      exitCode: result.code,
      stdout: stdout + result.stdout,
      stderr: stderr + result.stderr,
      durationMs: Date.now() - started,
      timedOut: result.timedOut
    }
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export function playgroundStatus(): { installed: boolean; installPath: string } {
  const settings = getSettings().playground
  return { installed: settings.installed, installPath: settings.installPath }
}

export async function installPlayground(): Promise<{ ok: boolean; message: string; path: string }> {
  const target = getSettings().playground.installPath || join(playgroundDir(), 'toolchain')
  await mkdir(target, { recursive: true })
  const git = which('git')
  if (!git) return { ok: false, message: '未检测到 git，无法从 GitHub 拉取代码练习环境', path: target }
  const result = await execCapture('git', ['clone', '--depth', '1', PLAYGROUND_REPO, target], tempDir(), 120000)
  if (result.code !== 0) {
    return { ok: false, message: result.stderr || '克隆失败（仓库可能尚未发布）', path: target }
  }
  updateSettings({ playground: { installed: true, installPath: target } })
  return { ok: true, message: '代码练习环境已安装', path: target }
}
