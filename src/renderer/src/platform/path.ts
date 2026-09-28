/** 浏览器里没有 node:path，这里提供移动端需要的那几个纯函数。 */

export const basename = (value: string, ext?: string): string => {
  const base = value.split(/[\\/]/).pop() ?? value
  if (ext && base.endsWith(ext)) return base.slice(0, -ext.length)
  return base
}

export const extname = (value: string): string => {
  const base = value.split(/[\\/]/).pop() ?? ''
  const index = base.lastIndexOf('.')
  return index > 0 ? base.slice(index).toLowerCase() : ''
}

export const dirname = (value: string): string => {
  const parts = value.split(/[\\/]/)
  parts.pop()
  return parts.join('/') || '/'
}

export const joinPath = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/')

export const stripExtension = (value: string): string => value.replace(/\.[^./\\]+$/, '')
