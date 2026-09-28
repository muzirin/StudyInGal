# Android / 平板客户端

桌面端是 Electron，**Electron 无法运行在 Android 上**，所以安卓客户端采用
**Capacitor**（原生壳 + WebView）承载同一份 React 渲染层。

## 一句话架构

```
                 ┌─────────────────────────────┐
                 │  src/renderer（同一份 UI）   │
                 └──────────────┬──────────────┘
                                │ window.study.invoke(channel, payload)
        ┌───────────────────────┴────────────────────────┐
        │                                                │
┌───────▼────────────────┐                  ┌────────────▼─────────────────┐
│ 桌面端：Electron preload │                  │ 移动端：platform/bridge.ts   │
│ → main/ipc → services   │                  │ → IndexedDB + Capacitor 插件 │
└─────────────────────────┘                  └──────────────────────────────┘
```

- 通道契约（`src/shared/channels.ts`）两端完全一致，**页面代码零改动**。
- 主进程里那些纯逻辑（JSON 容错解析、题目解析、token 策略、EIPF 映射）
  放在 `src/main/lib/*`，移动端通过别名 `@mainlib/*` 直接复用。

## 目录

| 路径 | 说明 |
|---|---|
| `src/renderer/src/platform/bridge.ts` | 移动端 `window.study` 实现（全部 IPC 通道） |
| `src/renderer/src/platform/store.ts` | 各集合的持久化（IndexedDB） |
| `src/renderer/src/platform/ai.ts` | 浏览器直连 AI 提供商 + 剧本/题目生成 |
| `src/renderer/src/platform/documents.ts` | 文档读写（Capacitor Filesystem）与分册合并 |
| `capacitor.config.ts` | Capacitor 配置（appId / webDir / android） |
| `vite.mobile.config.ts` | 移动端 web 打包（输出 `dist-mobile/`） |
| `android/` | Capacitor 生成的安卓原生工程（已提交，含平板适配清单） |
| `scripts/prepare-mobile-assets.mjs` | 把 `resources/assets` 复制进 web 目录随包分发 |

## 构建

```bash
npm run build:mobile     # 复制素材 + 打包 web 到 dist-mobile/
npm run android:sync     # build:mobile + cap sync android
npm run android:apk      # 上面两步 + gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

CI（`.github/workflows/release.yml` 的 `Build Android (APK)` 任务）会在打 tag 时
自动构建并把 `StudyInGal-<版本>-android.apk` 传到 Releases。

## 平板适配

- `AndroidManifest.xml`：`resizeableActivity="true"`、`supports-screens` 声明大屏、
  `uses-feature touchscreen required=false`（也能装在无触摸的 Chromebook 上）。
- 首次启动默认开启**触屏大按钮模式**（点击区域 ≥48dp）并把圆角调小。
- 布局沿用桌面端断点：窄屏 → 临时抽屉导航；平板横屏 → 常驻左侧导航 + 右侧内容。
- 状态栏由系统提供，自绘窗口按钮在移动端隐藏。

## 移动端能力矩阵

| 能力 | 移动端 | 说明 |
|---|---|---|
| 论文/教材库（md / tex / txt / html） | ✅ | 文件复制进应用私有目录（Documents/StudyInGal/library） |
| 教材分册只读合并、精读、黑板笔记 | ✅ | 与桌面端一致 |
| 随堂问答（单选、本地判分） | ✅ | 题目随剧本生成，离线可答 |
| Galgame 生成 / 播放 / 分幕 / 存档 | ✅ | 生成需要 AI 提供商 |
| 伴学娘对话、角色管理、历史 | ✅ | 数据在 IndexedDB |
| 日程/番茄钟/白噪音/高数计算器 | ✅ | 白噪音用 Web Audio |
| AI 提供商配置（含剧本/对话/语音路由） | ✅ | 浏览器直连各家 API |
| 云盘：WebDAV 挂载 / 浏览 / 上下传 | ✅ | 原生 fetch 实现 |
| 内置场景与立绘（随包素材） | ✅ | `assets-bundled/` |
| **PDF / DOCX 解析** | ⛔ | 移动端暂未接入解析器，会用系统应用打开 |
| **本地 OCR** | ⛔ | 桌面端可用（Tesseract） |
| **SMB / 夸克网盘 / 本地目录挂载** | ⛔ | 移动端仅支持 WebDAV |
| **内嵌终端 / 代码练习场 / 学习通 / 创意工坊打包** | ⛔ | 桌面端专属 |
| **整库增量同步** | ⛔ | 移动端按单个存档上传/下载 |

不支持的能力会返回明确提示（例如「移动端暂不支持：本地 OCR（桌面端可用）」），不会静默失败。

## 已知坑

1. **AI 请求的 CORS**：移动端是从 WebView 直连各家 API。
   OpenAI / DeepSeek / Gemini 等通常允许浏览器直连；若某家拒绝，请改用支持 CORS 的
   兼容网关，或在桌面端生成剧本后再同步过来。
2. **本地构建 Gradle 发行包**：`android/gradlew` 需要下载 `gradle-8.14.3-all.zip`。
   若所在网络对 `services.gradle.org` 有 TLS 拦截/限速，会失败；建议用 CI 构建，
   或把发行包手动放进 `~/.gradle/wrapper/dists/` 对应目录。
3. **JDK**：AGP 8.13 需要 JDK 17+（推荐 21）。本仓库 CI 使用 temurin 21。

## 后续计划

- 签名 release 构建（在 CI 用 keystore 出 `assembleRelease` 的 AAB/APK）。
- Android SAF 授权任意目录（目前只支持把文件复制进应用私有目录）。
- 移动端 PDF 文本解析（pdfjs-dist）与图片 OCR。
- 系统 TTS（`@capacitor-community/text-to-speech`）替代 Web Speech。
