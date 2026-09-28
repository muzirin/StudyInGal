// 生成 THIRD_PARTY.md：从依赖树收集运行时依赖的名称、版本与许可证。
// 用法：node scripts/gen-third-party.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const runtimeDeps = Object.keys(pkg.dependencies ?? {}).sort()
const devDeps = Object.keys(pkg.devDependencies ?? {}).sort()

function resolvePackageDir(name) {
  // 优先直接读 node_modules（部分包的 exports 未导出 package.json）
  const direct = join(root, 'node_modules', ...name.split('/'))
  if (existsSync(join(direct, 'package.json'))) return direct
  try {
    return dirname(require.resolve(`${name}/package.json`, { paths: [root] }))
  } catch {
    return null
  }
}

function readMeta(name) {
  const dir = resolvePackageDir(name)
  if (!dir) return { name, version: '?', license: '?' }
  try {
    const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    let license = meta.license
    if (!license && Array.isArray(meta.licenses)) license = meta.licenses.map((item) => item.type).join(' / ')
    if (!license) license = existsSync(join(dir, 'LICENSE')) ? '见包内 LICENSE' : '未声明'
    return { name, version: meta.version ?? '?', license }
  } catch {
    return { name, version: '?', license: '?' }
  }
}

const rows = (list) => list.map(readMeta).map((meta) => `| \`${meta.name}\` | ${meta.version} | ${meta.license} |`).join('\n')

const content = `# 第三方依赖与许可证

本文件由 \`scripts/gen-third-party.mjs\` 自动生成，请勿手工编辑。

StudyInGal 以 **GPL-3.0-or-later** 发布。下表列出直接运行时/开发依赖及其许可证；
完整的传递依赖树可通过 \`npm ls --all\` 查看。分发本应用时请同时满足这些许可证的要求。

## 运行时依赖

| 包 | 版本 | 许可证 |
|----|------|--------|
${rows(runtimeDeps)}

## 开发依赖

| 包 | 版本 | 许可证 |
|----|------|--------|
${rows(devDeps)}

## 特别说明

- **Live2D**：Cubism Core / \`pixi-live2d-display\` 不随本项目分发，需用户自行获取并遵守其许可（Live2D Inc. 专有许可）。
- **夸克网盘**：适配器使用网页端接口，未包含任何官方 SDK；请遵守夸克网盘服务条款。
- **Fanxing**：学习通托管能力由独立子系统提供，本项目仅通过本地 HTTP 与其通信。
`

writeFileSync(join(root, 'THIRD_PARTY.md'), content, 'utf8')
console.log(`THIRD_PARTY.md 已生成：运行时 ${runtimeDeps.length} 项，开发 ${devDeps.length} 项`)
