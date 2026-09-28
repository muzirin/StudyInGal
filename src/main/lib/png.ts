import { deflateSync } from 'node:zlib'

const crcTable: number[] = (() => {
  const table: number[] = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

export interface Rgba {
  data: Buffer
  size: number
}

/** 生成樱花色小花图标（5 片花瓣 + 浅色花心），无需随包携带图片资源。 */
export function renderFlower(size: number): Rgba {
  const rgba = Buffer.alloc(size * size * 4)
  const center = (size - 1) / 2
  const petalDistance = size * 0.21
  const petalRadius = size * 0.19
  const coreRadius = size * 0.115

  const petals: [number, number][] = []
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2 - Math.PI / 2
    petals.push([center + Math.cos(angle) * petalDistance, center + Math.sin(angle) * petalDistance])
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      let alpha = 0
      let r = 232
      let g = 92
      let b = 151

      for (const [px, py] of petals) {
        const distance = Math.hypot(x - px, y - py)
        if (distance <= petalRadius) {
          alpha = Math.max(alpha, Math.min(1, (petalRadius - distance) / 1.6 + 0.35))
        }
      }
      if (Math.hypot(x - center, y - center) <= coreRadius) {
        alpha = 1
        r = 255
        g = 216
        b = 233
      }

      rgba[offset] = r
      rgba[offset + 1] = g
      rgba[offset + 2] = b
      rgba[offset + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    }
  }

  return { data: rgba, size }
}

export function encodePng({ data, size }: Rgba): Buffer {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0
    data.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

export function flowerPng(size: number): Buffer {
  return encodePng(renderFlower(size))
}
