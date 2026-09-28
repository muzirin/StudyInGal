import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

/**
 * 移动端（Capacitor）构建：把渲染进程打包成纯静态站点，
 * 平台能力由 src/renderer/src/platform/bridge.ts 在浏览器里实现。
 */
export default defineConfig({
  root: resolve('src/renderer'),
  base: './',
  publicDir: resolve('src/renderer/public'),
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
      '@mainlib': resolve('src/main/lib')
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve('dist-mobile'),
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 8000
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}'
  }
})
