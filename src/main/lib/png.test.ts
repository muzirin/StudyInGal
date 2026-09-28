import { describe, expect, it } from 'vitest'
import { encodePng, flowerPng, renderFlower } from './png'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('flowerPng', () => {
  it('生成合法的 PNG 结构（签名 + IHDR + IEND）', () => {
    const png = flowerPng(32)
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR')
    // 宽高写在第 16-24 字节
    expect(png.readUInt32BE(16)).toBe(32)
    expect(png.readUInt32BE(20)).toBe(32)
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe('IEND')
  })

  it('尺寸变化时输出长度随之变化', () => {
    expect(flowerPng(16).length).toBeGreaterThan(0)
    expect(flowerPng(64).length).toBeGreaterThan(flowerPng(16).length)
  })
})

describe('renderFlower', () => {
  it('中心像素为浅色花心且不透明', () => {
    const { data, size } = renderFlower(32)
    const center = (Math.floor(size / 2) * size + Math.floor(size / 2)) * 4
    expect(data[center + 3]).toBe(255)
    expect(data[center]).toBe(255)
  })

  it('角落像素完全透明', () => {
    const { data } = renderFlower(32)
    expect(data[3]).toBe(0)
  })

  it('每个像素都有 4 个通道', () => {
    const { data, size } = renderFlower(24)
    expect(data.length).toBe(size * size * 4)
  })
})

describe('encodePng', () => {
  it('空画布也能编码', () => {
    const size = 8
    const buffer = encodePng({ data: Buffer.alloc(size * size * 4), size })
    expect(buffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
  })
})
