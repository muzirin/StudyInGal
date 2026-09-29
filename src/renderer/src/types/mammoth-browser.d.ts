/**
 * mammoth 的浏览器包（UMD）没有随包提供类型声明，移动端 DOCX 渲染用它做转换。
 * 这里只声明用到的部分。
 */
declare module 'mammoth/mammoth.browser.min.js' {
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: unknown[] }>
}
