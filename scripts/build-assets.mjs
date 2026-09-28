// 将下载到本地的开源素材整理进 resources/assets/：
//   - backgrounds/*.jpg  场景背景（统一转 JPEG、限制尺寸）
//   - sprites/*.png      立绘（把开源分层素材合成为完整立绘）
//   - manifest.json      运行时可读的清单
//   - CREDITS.md         授权与署名
//
// 用法：node scripts/build-assets.mjs [源目录]
// 源目录约定：
//   <src>/backgrounds/*.(jpg|jpeg|png|bmp)     直接作为背景
//   <src>/sprites-set1/*.png                   madameberry 的 CC0 分层立绘素材
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import Jimp from 'jimp'

const SOURCE = resolve(process.argv[2] ?? 'C:/Users/Rin/AppData/Local/Temp/kilo/assets')
const OUT = resolve('resources/assets')
const BG_MAX_WIDTH = 1600
const BG_QUALITY = 80
const SPRITE_HEIGHT = 1100

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset'

/** 文件名 → 中文/可读名称（没有映射时用去扩展名的原名）。 */
const BG_NAMES = {
  entrance: '玄关',
  dining: '餐厅',
  'dining-kitchen': '厨房 · 餐厅',
  kitchen: '厨房',
  lounge: '客厅',
  bathroom: '浴室',
  'master-bedroom': '主卧',
  'single-bedroom': '次卧',
  hall: '走廊',
  hallway: '走廊',
  outside1: '屋外 · 白天',
  outside2: '屋外 · 傍晚',
  'belle-room': '书房 · 白天'
}

const SPRITE_DEFS = [
  {
    id: 'sakura',
    name: '小樱 · 学姐',
    body: 'Set1_body3_skin2.png',
    outline: 'Set1_body3_outline.png',
    face: 'face3.png',
    hair: 'hair1_color1.png'
  },
  {
    id: 'yuki',
    name: '雪见 · 学妹',
    body: 'Set1_body2_skin4.png',
    outline: 'Set1_body2_outline.png',
    face: 'face7.png',
    hair: 'hair2_color2.png'
  },
  {
    id: 'rin',
    name: '凛 · 同学',
    body: 'Set1_body1_skin1.png',
    outline: 'Set1_body1_outline.png',
    face: 'face5.png',
    hair: 'hair3_color1.png'
  },
  {
    id: 'kaede',
    name: '枫 · 班长',
    body: 'Set1_body4_skin3.png',
    outline: 'Set1_body4_outline.png',
    face: 'face9.png',
    hair: 'hair4_color1.png'
  },
  {
    id: 'aoi',
    name: '葵 · 学妹',
    body: 'Set1_body5_skin2.png',
    outline: 'Set1_body5_outline.png',
    face: 'face2.png',
    hair: 'hair1_color3.png'
  },
  {
    id: 'hinata',
    name: '日向 · 同桌',
    body: 'Set1_body2_skin1.png',
    outline: 'Set1_body2_outline.png',
    face: 'face4.png',
    hair: 'hair2_color1.png'
  },
  {
    id: 'mio',
    name: '澪 · 学姐',
    body: 'Set1_body4_skin5.png',
    outline: 'Set1_body4_outline.png',
    face: 'face6.png',
    hair: 'hair3_color1.png'
  },
  {
    id: 'sora',
    name: '空 · 同学',
    body: 'Set1_body1_skin3.png',
    outline: 'Set1_body1_outline.png',
    face: 'face8.png',
    hair: 'hair4_color1.png'
  }
]

async function listImages(dir) {
  try {
    const entries = await readdir(dir)
    return entries.filter((name) => /\.(jpe?g|png|bmp)$/i.test(name))
  } catch {
    return []
  }
}

async function buildBackgrounds() {
  const sourceDir = join(SOURCE, 'backgrounds')
  const files = await listImages(sourceDir)
  const results = []
  for (const file of files) {
    const id = slug(file)
    const out = join(OUT, 'backgrounds', `${id}.jpg`)
    const image = await Jimp.read(join(sourceDir, file))
    if (image.bitmap.width > BG_MAX_WIDTH) {
      image.resize(BG_MAX_WIDTH, Jimp.AUTO)
    }
    await image.quality(BG_QUALITY).writeAsync(out)
    const name = BG_NAMES[id] ?? basename(file, extname(file))
    results.push({ id, name, file: `backgrounds/${id}.jpg` })
    console.log(`  bg  ${id} ← ${file}`)
  }
  return results
}

async function buildSprites() {
  const sourceDir = join(SOURCE, 'sprites-set1')
  const available = new Set(await listImages(sourceDir))
  const results = []
  for (const def of SPRITE_DEFS) {
    const layers = [def.body, def.outline, def.face, def.hair].filter((layer) => available.has(layer))
    if (layers.length < 3 || !available.has(def.outline)) {
      console.warn(`  skip ${def.id}（素材不完整）`)
      continue
    }
    const images = []
    for (const layer of layers) images.push(await Jimp.read(join(sourceDir, layer)))
    const base = images[0].clone()
    for (const layer of images.slice(1)) base.composite(layer, 0, 0)
    if (base.bitmap.height > SPRITE_HEIGHT) base.resize(Jimp.AUTO, SPRITE_HEIGHT)
    const out = join(OUT, 'sprites', `${def.id}.png`)
    await base.writeAsync(out)
    results.push({ id: def.id, name: def.name, file: `sprites/${def.id}.png` })
    console.log(`  sprite ${def.id} ← ${layers.join(' + ')}`)
  }
  return results
}

function creditsMarkdown(backgrounds, sprites, hasBelle) {
  return `# 内置素材来源与授权

本目录下的素材来自 OpenGameArt.org 的开源 / 公有领域作品。分发本项目时请一并保留本文件。

## 立绘（sprites/）

| 文件 | 名称 | 作者 | 授权 |
|------|------|------|------|
${sprites.map((item) => `| \`${item.file}\` | ${item.name} | madameberry | CC0 1.0（公有领域） |`).join('\n')}

- 来源：https://opengameart.org/content/visual-novel-style-characters
- 由分层素材（身体 / 线稿 / 表情 / 发型）用 \`scripts/build-assets.mjs\` 合成。
- 作者说明：无需署名；如愿意可署名 Madameberry [madameberry.com]。

## 场景背景（backgrounds/）

| 文件 | 名称 | 作者 | 授权 |
|------|------|------|------|
${backgrounds
  .map(
    (item) =>
      `| \`${item.file}\` | ${item.name} | spiral atlas | CC-BY 3.0（需署名） |`
  )
  .join('\n')}
${hasBelle ? `\n- 另含 \`belle-room.jpg\`：Belle Tutorial（CC0 1.0），来源 https://opengameart.org/content/belle-tutorial\n` : ''}
- 来源：https://opengameart.org/content/visual-novel-house-backgrounds
- **CC-BY 3.0 要求署名**：请在衍生作品中保留「Backgrounds by spiral atlas (CC-BY 3.0)」字样。

## 其它

- 运行时：pixi.js（MIT）、pixi-live2d-display（MIT）
- Live2D Cubism Core 与 Live2D 官方示例模型**不随本项目分发**，需自行获取并遵守其许可。
- 更多可替换的开源素材见仓库 \`docs/assets.md\`。
`
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`源目录不存在：${SOURCE}`)
    process.exit(1)
  }
  await rm(OUT, { recursive: true, force: true })
  await mkdir(join(OUT, 'backgrounds'), { recursive: true })
  await mkdir(join(OUT, 'sprites'), { recursive: true })

  console.log('整理背景…')
  const backgrounds = await buildBackgrounds()
  console.log('合成立绘…')
  const sprites = await buildSprites()

  if (backgrounds.length === 0) {
    console.warn('⚠ 没有背景素材（源目录 backgrounds/ 为空）')
  }
  if (sprites.length === 0) {
    console.error('没有可用立绘，请检查源目录 sprites-set1/')
    process.exit(1)
  }

  const manifest = {
    version: 1,
    defaultSprite: sprites[0].id,
    backgrounds,
    sprites
  }
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  const belleSrc = join(SOURCE, 'bell-room.jpg')
  let hasBelle = false
  if (existsSync(belleSrc)) {
    await copyFile(belleSrc, join(OUT, 'backgrounds', 'belle-room.jpg'))
    hasBelle = true
  }

  const credits = creditsMarkdown(backgrounds, sprites, hasBelle)
  await writeFile(join(OUT, 'CREDITS.md'), credits, 'utf8')
  await copyFile(join(OUT, 'CREDITS.md'), join(OUT, '..', '..', 'docs', 'assets-credits.md')).catch(() => undefined)

  console.log(`\n完成：${backgrounds.length} 张背景，${sprites.length} 个立绘 → ${OUT}`)
  console.log('记得同步更新 docs/assets.md 与 README。')
  void readFile
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
