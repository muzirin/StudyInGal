/**
 * 从模型回复中粗略推断情绪，用于切换立绘 / 表情。
 * 这是轻量启发式，不追求准确，只求稳定且不打扰。
 */
export function guessEmotion(text: string): string {
  if (/(哈哈|嘿嘿|太好|太棒|开心|😄|😊)/.test(text)) return 'happy'
  if (/(哇|竟然|居然|没想到|😮)/.test(text)) return 'surprised'
  if (/(抱歉|遗憾|可惜|难过|😢)/.test(text)) return 'sad'
  if (/(注意|务必|小心|警告|重要)/.test(text)) return 'serious'
  if (/(\?|？|想一想|思考|也许)/.test(text)) return 'thinking'
  if (/(害羞|不好意思|😳)/.test(text)) return 'shy'
  return 'neutral'
}
