# 架构说明

本文档描述 StudyInGal 主系统（Electron 桌面应用）的分层结构与扩展方式，供贡献者与后续的 VS Code 插件子系统参考。

## 一、进程模型

```
┌────────────────────────────────────────────────────────────┐
│ main（CommonJS）                                            │
│  window.ts ── 无边框窗口 / 窗口状态广播 / 尺寸记忆           │
│  ipc/index.ts ── 通道白名单路由（所有业务入口）              │
│  services/*  ── 业务实现（文件、AI、云盘、调度……）           │
│  lib/*       ── JSON 存储、路径、事件总线、文件工具           │
└───────────────▲───────────────────────────┬────────────────┘
                │ ipcMain.handle            │ bus event
┌───────────────┴───────────────────────────▼────────────────┐
│ preload（CommonJS，sandbox: false）                          │
│  暴露 window.study = { invoke(channel), on(listener),        │
│                        pathForFile(file), platform }         │
│  通过 ALL_CHANNELS 白名单拦截非法通道                        │
└───────────────▲─────────────────────────────────────────────┘
                │ contextBridge
┌───────────────┴─────────────────────────────────────────────┐
│ renderer（React 19 + MD3，Vite 打包）                        │
│  api.ts        ── 与 shared/api.ts 一一对应的类型化客户端     │
│  state/        ── Zustand：设置、信息、toast、面包屑、询问     │
│  layout/       ── TitleBar（自绘标题栏）/ NavPanel / AppShell │
│  modules/      ── 模块注册表（导航、标题、路由）             │
│  pages/        ── 每个功能一页，复杂页面拆子目录（settings, tools）│
│  components/   ── 命令面板、转场、Markdown、Live2D、笔记等    │
│  lib/          ── 纯函数（格式化、分幕、目录解析、情绪推断）  │
└─────────────────────────────────────────────────────────────┘
```

## 二、契约层（`src/shared`）

新增任何能力都必须同步修改这四处，顺序固定：

| 文件 | 作用 |
|------|------|
| `types.ts` | 领域类型（LibraryNode / GalScript / NoteEntry / Conversation / CloudMount …） |
| `channels.ts` | 通道名常量 `CHANNELS`；`ALL_CHANNELS` 由它自动展开为白名单；`StudyEvent` 定义主→渲染事件 |
| `api.ts` | `StudyApi` 接口：渲染进程可调用的完整能力清单（文档 + 类型约束） |
| `constants.ts` | 应用常量、默认设置 `DEFAULT_SETTINGS`、提供商预设 |

## 三、数据落盘

全部位于 `app.getPath('userData')`：

| 路径 | 内容 |
|------|------|
| `data/settings.json` | `AppSettings`（含 AI 提供商与 API Key） |
| `data/library.json` | 论文库 / 教材库索引（节点、文件夹、系列、分类、标签） |
| `data/characters.json` | 角色卡 |
| `data/conversations.json` | 伴学娘会话 |
| `data/notes.json` | 黑板笔记（AI 精读 / 随手笔记 / 引用） |
| `data/archive.json` | Gal 存档 |
| `data/scripts.json` | Galgame 剧本 |
| `data/schedule.json` | 日程 / 课表 |
| `data/history.json` | 首页历史记录 |
| `data/focus.json` | 番茄钟专注记录 |
| `data/mounts.json` | 云盘挂载配置 |
| `data/syncLog.json` | 同步日志（保留 100 条） |
| `data/errors.json` | 运行错误（保留 200 条） |
| `data/window.json` | 窗口尺寸与位置 |
| `library/` | OCR 文本等派生产物 |
| `archive/` | 导出的存档文件 |
| `workshop/` | 已安装的创意工坊资源包 |

统一通过 `main/lib/jsonStore.ts` 的 `JsonStore` 读写：原子写入（先写 `.tmp` 再 rename）、读取失败回退默认值。
结构上可以平替为 SQLite，只要保持服务层函数签名不变。

## 四、添加一个功能模块

1. `shared/types.ts` 增加领域类型。
2. `shared/channels.ts` 增加通道（放在对应分组下，`ALL_CHANNELS` 会自动收录）。
3. `main/services/<feature>.ts` 实现业务，落到 `JsonStore`。
4. `main/ipc/index.ts` 注册 handler（用 `asString` / `asNumber` 收窄入参）。
5. `shared/api.ts` 与 `renderer/src/api.ts` 暴露类型化方法。
6. `renderer/src/modules/registry.tsx` 注册模块（图标、分组、描述）。
7. `renderer/src/pages/<Feature>Page.tsx` 写界面；若页面较长，拆到同名子目录。
8. `renderer/src/App.tsx` 加路由。
9. 纯逻辑抽到 `renderer/src/lib/` 并补 vitest 用例。

## 五、界面层约定

- **层级化优先**：页面用「左侧子导航 + 右侧面板」或「可折叠分组」组织，避免一次性铺开。
  已有范式可参考 `pages/settings/SettingsPage.tsx`、`pages/ToolsPage.tsx`、`pages/CloudPage.tsx`。
- **MD3 主题变量**：颜色统一用 `theme.palette.*`、`alpha(...)` 与 CSS 变量
  `--sig-surface-variant`、`--sig-mask-a/b` 等，禁止硬编码色值。
- **动画**：页面切换由 `components/RouteTransition.tsx` 统一处理（约 380ms 遮罩 + 淡入），
  局部动画用 `styles/global.css` 中的 `sig-page-enter` / `sig-breathe` 等类。
- **自适应**：断点使用 MUI 默认（`xs/sm/md/lg/xl`）+ `useMediaQuery`；窄屏时子导航降级为 Chip 行。
- **无边框窗口**：拖拽区必须加 `className="drag-region"`，可交互元素加 `no-drag`。

## 六、AI 调用链

```
resolveProvider(capability)  →  根据 settings.ai.routing[capability] 或第一个 enabled 提供商
   ├── openai / deepseek / ollama / openai-compatible → POST {baseUrl}/chat/completions
   ├── gemini                                        → POST {baseUrl}/models/{model}:generateContent
   └── anthropic                                     → POST {baseUrl}/messages
```

- 所有调用都在**主进程**完成，渲染进程永远拿不到 API Key。
- 剧本生成（`services/ai/script.ts`）按深度截断正文、构造 JSON 输出约束、解析后落盘为 `GalScript`。
- 一键询问 / 伴学娘对话 / 精读均复用 `ai.chat`，区别只在 system prompt 与 capability。

## 七、云盘与同步

`services/cloud/adapter.ts` 定义 `CloudAdapter` 接口，四个实现：`local` / `webdav`（原生 fetch 实现
PROPFIND/PUT/GET/MKCOL）/ `smb`（`@marsaud/smb2`）/ `quark`（实验性，网页端接口）。

`cloud/index.ts` 负责挂载 CRUD、状态标记、同步算法（按 `library` / `archive` / `scripts` / `characters`
四类目录做大小比对，远端更新更晚时记为冲突并跳过）与同步日志。
`services/scheduler.ts` 每分钟检查一次，满足间隔就触发同步并广播 toast。

## 八、后续子系统：VS Code 插件

插件负责「代码相关」能力，与主系统通过**同一份创意工坊数据格式**与 **HTTP/IPC 桥**协作：

- 主系统的代码练习场已支持运行与「提交到学习通」，插件可复用 `RunCodeRequest` / `RunCodeResult` 类型约定。
- 若需要双向通信，建议新增一个本地 HTTP 服务（类似 `services/xuexitong.ts` 对 Fanxing 的桥接方式），
  而不是让插件直接读写主系统的 `userData`。
