import { nativeImage, type NativeImage } from 'electron'
import { flowerPng } from './png'

export function createAppIcon(size = 32): NativeImage {
  return nativeImage.createFromBuffer(flowerPng(size))
}
