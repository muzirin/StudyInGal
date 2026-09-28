// 从 Wikimedia Commons 抓取「允许商用、无 SA 传染」的校园/学习场景照片作为背景。
// 只接受 CC0 / 公有领域 / CC-BY，跳过 CC-BY-SA 与未知授权。
//
// 用法：node scripts/fetch-commons-backgrounds.mjs [输出目录]
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const OUT = resolve(process.argv[2] ?? 'C:/Users/Rin/AppData/Local/Temp/kilo/assets/backgrounds')
const UA = 'StudyInGal-AssetFetcher/1.0 (https://github.com/muzirin/StudyInGal)'
const WIDTH = 1600

const ACCEPT = [
  { test: /^cc0/i, label: 'CC0 1.0' },
  { test: /public domain|^pd/i, label: 'Public Domain' },
  { test: /^cc by 4\.0/i, label: 'CC-BY 4.0' },
  { test: /^cc by 3\.0/i, label: 'CC-BY 3.0' },
  { test: /^cc by 2\.0/i, label: 'CC-BY 2.0' }
]

const REJECT = /sa\b|share[- ]alike|nc\b|non[- ]commercial|nd\b|no[- ]deriv/i

const QUERIES = [
  { slug: 'classroom', name: '教室', query: 'classroom interior desks school' },
  { slug: 'library', name: '图书馆', query: 'library reading room bookshelves' },
  { slug: 'lecture-hall', name: '阶梯教室', query: 'university lecture hall auditorium seats' },
  { slug: 'laboratory', name: '实验室', query: 'chemistry laboratory bench equipment' },
  { slug: 'campus-evening', name: '校园黄昏', query: 'university campus building sunset' },
  { slug: 'night-sky', name: '星空', query: 'night sky stars milky way' },
  { slug: 'desk-books', name: '书桌', query: 'study desk books lamp' },
  { slug: 'cafe', name: '咖啡厅', query: 'coffee shop interior table window' },
  { slug: 'rooftop-night', name: '天台夜景', query: 'rooftop night city view' },
  { slug: 'sakura-path', name: '樱花道', query: 'cherry blossom path trees spring' }
]

const api = 'https://commons.wikimedia.org/w/api.php'

async function search(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: String(WIDTH)
  })
  const response = await fetch(`${api}?${params}`, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`API ${response.status}`)
  const data = await response.json()
  const pages = Object.values(data?.query?.pages ?? {})
  const candidates = []
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    if (!info) continue
    const meta = info.extmetadata ?? {}
    const license = String(meta.LicenseShortName?.value ?? '').trim()
    const accepted = ACCEPT.find((item) => item.test.test(license))
    if (!accepted || REJECT.test(license)) continue
    if ((info.width ?? 0) < 1280) continue
    candidates.push({
      title: page.title,
      url: info.thumburl || info.url,
      credit: {
        artist: String(meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'Wikimedia Commons',
        license: accepted.label,
        page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
      }
    })
  }
  return candidates
}

async function download(url, target) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`download ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(target, buffer)
  return buffer.byteLength
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const credits = []
  for (const item of QUERIES) {
    try {
      const candidates = await search(item.query)
      if (candidates.length === 0) {
        console.warn(`skip ${item.slug}（没有符合授权的图片）`)
        continue
      }
      const picked = candidates[0]
      const file = join(OUT, `${item.slug}.jpg`)
      const bytes = await download(picked.url, file)
      credits.push({ slug: item.slug, name: item.name, ...picked.credit })
      console.log(`ok  ${item.slug}.jpg  ${Math.round(bytes / 1024)}KB  ${picked.credit.license}  ${picked.title}`)
    } catch (error) {
      console.warn(`fail ${item.slug}: ${error.message}`)
    }
  }
  await writeFile(join(OUT, '..', 'commons-credits.json'), JSON.stringify(credits, null, 2), 'utf8')
  console.log(`\n完成 ${credits.length}/${QUERIES.length} 张，署名信息写入 commons-credits.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
