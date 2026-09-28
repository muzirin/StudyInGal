/**
 * 把本机绝对路径转换成渲染进程可加载的 URL。
 *
 * 主进程注册了 `sigasset://` 协议（见 main/index.ts），
 * 形如 `C:\assets\bg.png` 的路径会被映射为 `sigasset://local/C%3A%5Cassets%5Cbg.png`。
 * 已经是 http / data / blob / sigasset / file 的地址原样返回。
 */
export function toAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^(https?:|data:|blob:|sigasset:|file:)/i.test(path)) return path
  return `sigasset://local/${encodeURIComponent(path)}`
}
