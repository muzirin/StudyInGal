// 把内置开源素材复制到移动端 web 目录，随 APK 一起打包。
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve('resources/assets')
const target = resolve('src/renderer/public/assets-bundled')

async function main() {
  try {
    await stat(source)
  } catch {
    console.warn('未找到 resources/assets，跳过（可执行 npm run assets:build 生成）')
    return
  }
  await rm(target, { recursive: true, force: true })
  await mkdir(target, { recursive: true })
  await cp(source, target, { recursive: true })
  console.log(`已复制内置素材 → ${target}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
