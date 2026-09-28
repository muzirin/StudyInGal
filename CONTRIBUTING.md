# 贡献指南

感谢你愿意为 StudyInGal 做出贡献！

## 开发环境

- Node.js >= 20.11（推荐 22 LTS）
- npm >= 10
- Windows / macOS / Linux

```bash
npm install
npm run dev
```

> 若启动时报 `Cannot read properties of undefined (reading 'isPackaged')`，
> 说明当前 shell 设置了 `ELECTRON_RUN_AS_NODE=1`，请先执行 `$env:ELECTRON_RUN_AS_NODE = $null`（PowerShell）
> 或 `unset ELECTRON_RUN_AS_NODE`（bash）再启动。

## 代码约定

- **TypeScript strict**，提交前必须通过：
  ```bash
  npm run typecheck
  npm test
  npm run build
  ```
- 主进程与渲染进程之间**只能**通过 `src/shared/channels.ts` 中登记的 IPC 通道通信；
  新增能力时请同时更新：`shared/channels.ts` → `shared/api.ts` → `main/ipc/index.ts` → `renderer/src/api.ts`。
- 不要在主进程渲染进程之间传递不可序列化的对象。
- 界面统一使用 Material Design 3 主题变量（`theme.palette.*` / `--sig-surface-variant`），避免硬编码颜色。
- 不要在代码中硬编码 API Key、Cookie、令牌。

## 提交信息

使用 Conventional Commits 风格：

```
feat(library): 支持导入文件夹分册教材
fix(cloud): WebDAV PROPFIND 解析兼容 Alist
docs(quark): 补充 Cookie 获取步骤
```

## 分支与发布

- `main` 为稳定分支，通过 PR 合入。
- 发布由 `.github/workflows/release.yml` 负责：打上 `v*` 标签即触发三平台构建并发布到 GitHub Releases。

## 报告问题

请使用仓库的 Issue 模板。应用内的「开发者模式 → 错误与反馈」可以一键生成包含环境信息的草稿。

## 许可证

贡献即表示你同意以 GPL-3.0-or-later 授权你的代码。
