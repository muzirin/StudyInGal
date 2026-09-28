/** max_tokens 相关的公共逻辑（纯函数，便于单测）。 */

/** 所有主流网关都能接受的硬上限，超过会被 400 拒绝。 */
export const ABSOLUTE_MAX_TOKENS = 131072

/** 剧本生成的保守上限；具体上限由「被拒绝后按错误信息回退」处理。 */
export const SCRIPT_HARD_CAP = 16384
export const SAFE_FALLBACK_TOKENS = 8192

/** 把任意输入收进一个合法区间，避免用户填了离谱值直接 400。 */
export function clampMaxTokens(value: number, fallback = SAFE_FALLBACK_TOKENS): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.max(1, Math.floor(value)), ABSOLUTE_MAX_TOKENS)
}

/** 中文对话 + JSON 结构约每行 100~150 tokens，按 150 估算并留固定开销。 */
export function estimateScriptTokens(maxLines: number): number {
  const lines = Number.isFinite(maxLines) && maxLines > 0 ? maxLines : 40
  return Math.min(SCRIPT_HARD_CAP, 900 + Math.floor(lines) * 150)
}

/** 判断错误是否与 max_tokens 有关（需要降级重试）。 */
export function isMaxTokenError(message: string): boolean {
  return /max_?tokens|maximum context|too large/i.test(message)
}

/**
 * 从错误信息里解析出允许的上限，例如：
 *   "the valid range of max_tokens is [1, 393216]"
 *   "max_tokens must be less than or equal to 8192"
 */
export function parseAllowedMaxTokens(message: string): number | null {
  const range = message.match(/max_?tokens[^[[]*\[(\d+)\s*,\s*(\d+)\]/i)
  if (range) return Number(range[2])
  const simple = message.match(/max_?tokens[^0-9]{0,40}(\d{3,})/i)
  return simple ? Number(simple[1]) : null
}

/** 依次尝试一组 token 预算，返回去重后的候选列表（调用方负责真正发请求）。 */
export function tokenCandidates(primary: number, extra: (number | null)[]): number[] {
  const all = [primary, ...extra]
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .map((value) => clampMaxTokens(value))
  return [...new Set(all)]
}
