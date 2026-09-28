<div align="center">

# StudyInGal

**学习 × Galgame 的一体化桌面学习系统**

把论文和教材变成能陪你聊、陪你玩、陪你学的 Galgame。

[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-pink.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-44-47848F.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Material Design 3](https://img.shields.io/badge/Material%20Design-3-E85C97.svg)](https://m3.material.io/)

</div>

---

## 这是什么

[paper2galgame](https://github.com/Nova42x/paper2galgame) 证明了「让二次元角色讲解论文」是一件有趣且有效的事。
StudyInGal 把这个点子扩展成一个完整的桌面学习系统：**论文库 + 教材库 + 学习通托管 + 伴学娘 + 学习工具 + 云盘同步 + 创意工坊**。

所有数据默认保存在本机，AI 能力通过你自己配置的 API 提供商接入，不绑定任何厂商。

## 功能总览

| # | 模块 | 说明 |
|---|------|------|
| 1 | **论文库托管** | LaTeX / Markdown / PDF / Doc / Docx；文件夹、系列、分类、标签等文件管理；支持挂载 SMB / WebDAV / 夸克网盘 |
| 2 | **教材库托管** | 多格式教材；分章节文件夹自动只读合并展示（不改原文件）；本地优先 OCR（Tesseract）；支持分册生成 Gal；**逐章精读 + 黑板笔记** |
| 3 | **学习通托管** | 通过独立子系统 [Fanxing](https://github.com/muzirin/Fanxing) 完成非编程作业；代码练习场可一键提交 |
| 4 | **学习小工具** | 待办日程（ICS）、**周视图课表**、番茄钟、白噪音、高数计算器 |
| 5 | **伴学娘对话** | 多轮对话、情绪立绘、语音朗读、主动搭话 |
| 6 | **代码练习场（可选）** | 自动检测 gcc / g++ / msvc / python / csharp / java / js，默认不安装，可从 GitHub 拉取扩展环境 |
| 7 | **自定义 API 提供商** | 剧本生产 / 对话 / 语音等能力可分别路由到不同提供商（OpenAI 兼容 / Gemini / Anthropic / Ollama / 自建） |
| 8 | **Live2D** | 角色级模型配置，运行时按需加载 |
| 9 | **LaTeX / Markdown 编辑器** | 内联论文库，KaTeX 公式预览，自动保存 |
| 10 | **定时任务与主动搭话** | 按间隔结合你的学习数据主动问候 |
| 11 | **触屏优化** | 大按钮模式、导航位置可切换，为多平台做准备 |
| 12 | **多端同步** | 基于 WebDAV / SMB 的增量同步，支持按间隔**自动同步** |
| 13 | **创意工坊** | 定义的资源包数据结构 + SHA-256 校验 + 自部署 CDN，**一键导出配置（脱敏）** |
| 14 | **多角色管理** | 多角色、立绘（按情绪）、Live2D、语音，角色卡导入导出；**会话持久化** |
| 15 | **开发者模式** | 内嵌 CLI 终端（含 typecheck / test / build 自检预设），方便构建与调试 |
| 16 | **错误采集与一键汇报** | 自动附带环境信息生成 GitHub Issue 草稿，内置视觉回归截图脚本 |
| 17 | **全局一键询问** | 任意库、任意页面选中文字即可询问；支持系统托盘与全局快捷键唤出 |
| 18 | **存档管理** | Gal 存档的进度、标签、收藏、云盘位置；笔记中心按文献归类检索 |
| 19 | **导航默认居左** | 设置中可切换左 / 右 / 顶 / 底 |
| 20 | **全局自适应 UI** | Material Design 3，响应式布局与多配色 |

> **VS Code 插件**（负责代码相关能力）是后续子系统，本仓库暂不包含。

## 使用技巧

- **命令面板**：`Ctrl + K` 搜索并跳转到任意模块，或直接执行「切换主题 / 立即同步 / 清空历史」。
- **一键询问**：`Ctrl + Shift + K`，或在阅读器选中文字后点击浮动条上的「询问」。
- **精读 + 黑板笔记**：阅读器右上角「精读本章」会生成结构化笔记（主旨 / 要点 / 公式直觉 / 常见误区 / 自测），
  与你的随手笔记、原文引用一起显示在右侧黑板面板，保存在本机 `notes.json`。
- **课表视图**：学习工具 → 课表视图，点击空白格可直接创建课程；当前时间有一条红色指示线。
- **Galgame 分幕**：剧本会按叙述断点自动分幕，右侧可跳幕；播放中可逐句编辑台词或把台词引用到黑板笔记。
- **随堂问答**：生成剧本时**同时产出单选题**（无需读取时再联网），读完一幕自动弹题；
  客观题本地判分、不消耗额度；没有题目的旧剧本可在 Gal 工坊点「出题」补上。
  题目结构按 [EIPF](https://github.com/muzirin/EIPF) 的 `scene-entry` 约定对齐，见
  [docs/eipf-mapping.md](./docs/eipf-mapping.md)。阅读器里也有「出题」入口。
- **快捷键总览**：标题栏的键盘图标可查看全部快捷键；`Alt+1…9` 可在模块间快速切换。
- **系统托盘与全局唤出**：设置 → 桌面集成可开启托盘常驻、「关闭即最小化到托盘」，以及全局快捷键
  （默认 `Ctrl+Shift+Space`）在任意应用中唤出并打开一键询问。
- **无边框窗口**：标题栏为自绘，支持拖动、双击最大化；macOS 使用原生红绿灯按钮。

## 开发辅助

```bash
# 批量截取各页面截图（用于视觉检查 / 视觉回归）
pwsh scripts/capture-screens.ps1 -OutDir .screens

# 单页截图：设置环境变量后启动
$env:SIG_CAPTURE_PATH="$PWD\home.png"; $env:SIG_CAPTURE_ROUTE="/"; npx electron .
```

## 技术栈

- **桌面框架**：Electron 44 + electron-vite
- **界面**：React 19 + Material Design 3（MUI v7 主题定制）+ Emotion
- **状态**：Zustand
- **渲染**：react-markdown + remark-gfm/math + KaTeX
- **存储**：JSON 文档存储（`app.getPath('userData')/data`），设计上可替换为 SQLite
- **AI**：原生 `fetch` 调用 OpenAI 兼容 / Gemini / Anthropic 接口，无厂商锁定
- **云盘**：原生 `fetch` 实现 WebDAV（PROPFIND/PUT/GET/MKCOL），`@marsaud/smb2` 实现 SMB

## 开发

```bash
npm install
npm run dev          # 启动开发模式
npm run typecheck    # 类型检查（主进程 + 渲染进程）
npm test             # 单元测试（vitest）
npm run build        # 构建到 out/
npm run build:win    # 打包 Windows 安装包
npm run build:mac    # 打包 macOS dmg
npm run build:linux  # 打包 Linux AppImage / deb
```

> **Windows 提示**：若环境中设置了 `ELECTRON_RUN_AS_NODE=1`（部分终端或 CI 默认开启），
> Electron 会退化为纯 Node 运行。首次启动前请清除该变量：
>
> ```powershell
> $env:ELECTRON_RUN_AS_NODE = $null
> npm run dev
> ```
## 目录结构

```text
src/
├── main/                 # Electron 主进程
│   ├── ipc/              # IPC 路由（88 个通道）
│   ├── lib/              # JSON 存储、路径、事件总线
│   └── services/         # 业务服务
│       ├── ai/           # 提供商客户端、剧本生成
│       ├── cloud/        # local / webdav / smb / quark 适配器
│       ├── documents.ts  # PDF / Docx / 分册合并 / OCR
│       ├── library.ts    # 论文库与教材库
│       └── ...           # 角色、剧本、存档、日程、工坊、错误、终端等
├── preload/              # 上下文隔离桥（通道白名单）
├── renderer/src/
│   ├── components/       # 通用组件（含一键询问、Live2D 舞台）
│   ├── layout/           # MD3 自适应 AppShell
│   ├── modules/          # 模块注册表
│   ├── pages/            # 各功能页面
│   ├── state/            # Zustand 全局状态
│   └── theme/            # MD3 配色与主题构建
└── shared/               # 主进程 / 渲染进程共享的类型与 IPC 契约
```

更多设计细节见 [docs/architecture.md](./docs/architecture.md)。

主页是**全窗口 Galgame 场景**：背景来自**随包分发的开源素材**（CC0 / CC-BY，见
[resources/assets/CREDITS.md](./resources/assets/CREDITS.md)），按时段自动轮换；立绘居于场景中央，
底部是对话框与提问输入；右侧浮层常驻「最近」与「导航」。

想换背景：主页 → 左上角场景名 → **「导入场景」**（选择本地图片即可，支持多选）；
想换立绘：角色管理 → 编辑角色 → **「内置素材」**页签一键套用，或「立绘」页签添加自己的图片。

素材从哪来、如何替换？见 **[docs/assets.md](./docs/assets.md)**：整理了 CC0 / CC-BY 的背景与立绘来源，
以及 Live2D 官方示例模型的授权说明（含商用条件与署名要求）。

## 数据与隐私

- 所有设置、索引、剧本、存档都在本机用户数据目录中，**默认不上传任何数据**。
- API Key 保存在本地设置文件中；请勿共享该文件。
- 错误日志仅本机记录，只有你点击「一键汇报」时才会把内容填进 GitHub Issue 草稿。
- OCR 使用本地 Tesseract，首次运行会下载语言包。

## 云盘说明

| 类型 | 状态 | 备注 |
|------|------|------|
| 本地目录 | ✅ 完整 | 用于把某个磁盘目录当作同步目标 |
| WebDAV | ✅ 完整 | 坚果云、Nextcloud、Alist 等 |
| SMB | ✅ 完整 | `\\server\share` |
| 夸克网盘 | ⚠️ 实验性 | 基于网页端接口，需自备 Cookie；支持浏览与下载，**上传未实现**，详见 [docs/cloud-quark.md](./docs/cloud-quark.md) |

## 创意工坊数据格式

资源包为 gzip 压缩的 `.sigpkg`，内部结构：

```jsonc
{
  "manifest": {
    "schemaVersion": 1,
    "id": "my-character-pack",
    "name": "示例角色包",
    "version": "1.0.0",
    "author": "you",
    "license": "GPL-3.0-or-later",
    "type": "character",            // character | gal-script | theme | textbook-pack | tool | bundle
    "entry": null,
    "baseUrl": "https://cdn.example.com/pkgs",  // 上传者自己的分发地址
    "assets": [{ "path": "a.json", "sha256": "…", "sizeBytes": 123 }],
    "dependencies": [],
    "tags": [],
    "createdAt": 0
  },
  "files": { "a.json": "<base64>" }
}
```

安装时会逐项校验 SHA-256 与文件大小，避免损坏或篡改的资源包。

## 许可证

本项目以 [GPL-3.0-or-later](./LICENSE) 发布。
「论文转 Galgame」的产品灵感来自 [Nova42x/paper2galgame](https://github.com/Nova42x/paper2galgame)。
第三方依赖及其许可证见 [THIRD_PARTY.md](./THIRD_PARTY.md)（`npm run licenses` 可重新生成）。

## 贡献

请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。
