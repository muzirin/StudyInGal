# AGENTS.md

本文件给自动化编码代理（以及未来的我）提供本仓库的约定与注意事项。

## 快速命令

```bash
npm run dev          # 开发（Electron + Vite）
npm run typecheck    # 类型检查（必须通过）
npm test             # 单元测试（vitest，必须通过）
npm run build        # 构建 out/（必须通过）
npm run build:win    # 打包 Windows
```

## 环境陷阱

- 本机/CI 可能设置 `ELECTRON_RUN_AS_NODE=1`，会让 Electron 以纯 Node 运行，
  表现为 `require('electron')` 返回字符串、`electron.app` 为 undefined。
  **运行或调试应用前必须清除该变量。**
- 主进程 / 预加载脚本使用 **CommonJS** 输出（package.json 没有 `"type": "module"`）。
  不要在主进程引入 ESM-only 依赖（会 `require` 失败）；如需使用，请自行用原生 fetch/fs 实现或改写为 CJS 兼容。
- 渲染进程用 Vite 打包，可以使用任意 ESM 依赖。
- **不要用 PowerShell 的 `Get-Content` / `Set-Content` 改写源码文件**：Windows PowerShell 5.1 默认按 ANSI 读写，
  会把中文变成 `?` / `\uFFFD`（本项目已经踩过一次坑）。需要脚本化改写时，使用 Node 脚本或 .NET 的
  `[System.IO.File]::ReadAllText/WriteAllText` 并显式指定 UTF-8。
- 提交前可快速自检乱码：`node -e "..."` 扫描 `\uFFFD` 与连续 `???`。

## 架构约定

- IPC 契约集中在 `src/shared/`：
  - `channels.ts`：通道名（`ALL_CHANNELS` 为白名单，preload 会校验）
  - `types.ts`：领域类型
  - `api.ts`：`StudyApi` 接口（渲染进程 `api.ts` 与之对应）
- 新增一个功能的标准流程：
  1. `shared/types.ts` 加类型
  2. `shared/channels.ts` 加通道
  3. `main/services/<x>.ts` 实现业务
  4. `main/ipc/index.ts` 注册 handler
  5. `shared/api.ts` + `renderer/src/api.ts` 暴露方法
  6. `renderer/src/pages/<X>Page.tsx` 做界面，并在 `modules/registry.tsx` 注册
- 数据持久化使用 `main/lib/jsonStore.ts`，位于 `app.getPath('userData')/data`。

## 内置开源素材

- 素材放在 `resources/assets/`（`backgrounds/`、`sprites/`、`manifest.json`、`CREDITS.md`），
  打包时通过 electron-builder 的 `extraResources` 复制到 `process.resourcesPath/assets`。
- 主进程 `services/bundledAssets.ts` 负责解析路径并暴露 `assets:list`；
  渲染进程用 `lib/bundledAssets.ts` 的 `useBundledAssets/useCharacterSprite`（带缓存与回退）。
- 本机绝对路径**不能**直接当 `<img src>` 用，必须经 `lib/assets.ts` 的 `toAssetUrl()` 转成 `sigasset://` 协议地址
  （主进程 `protocol.handle('sigasset', ...)` 负责读文件）。
- 重新生成素材：`node scripts/build-assets.mjs <源目录>`（源目录需含 `sprites-set1/` 与 `backgrounds/`）。
  需要联网抓 CC0 背景时用 `node scripts/fetch-commons-backgrounds.mjs`。


## 调试

- 渲染进程错误会通过 `ErrorBoundary` 与 `errors:capture` 记录，可在「开发者模式 → 错误与反馈」查看。
- 主进程未捕获异常会写入 `data/errors.json`。

## 提交规范

Conventional Commits；不要提交 `node_modules`、`out`、`release`、密钥或个人 Cookie。
