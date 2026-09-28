# 第三方依赖与许可证

本文件由 `scripts/gen-third-party.mjs` 自动生成，请勿手工编辑。

StudyInGal 以 **GPL-3.0-or-later** 发布。下表列出直接运行时/开发依赖及其许可证；
完整的传递依赖树可通过 `npm ls --all` 查看。分发本应用时请同时满足这些许可证的要求。

## 运行时依赖

| 包 | 版本 | 许可证 |
|----|------|--------|
| `@electron-toolkit/preload` | 3.0.2 | MIT |
| `@electron-toolkit/utils` | 4.0.0 | MIT |
| `@emotion/react` | 11.14.0 | MIT |
| `@emotion/styled` | 11.14.1 | MIT |
| `@marsaud/smb2` | 0.18.0 | MIT |
| `@mui/icons-material` | 7.3.11 | MIT |
| `@mui/material` | 7.3.11 | MIT |
| `@xterm/addon-fit` | 0.11.0 | MIT |
| `@xterm/xterm` | 6.0.0 | MIT |
| `dayjs` | 1.11.23 | MIT |
| `katex` | 0.18.9 | MIT |
| `mammoth` | 1.13.0 | BSD-2-Clause |
| `mathjs` | 15.2.0 | Apache-2.0 |
| `pdf-parse` | 2.4.5 | Apache-2.0 |
| `react` | 19.3.0 | MIT |
| `react-dom` | 19.3.0 | MIT |
| `react-markdown` | 10.1.0 | MIT |
| `react-router-dom` | 7.18.4 | MIT |
| `rehype-katex` | 7.0.1 | MIT |
| `remark-gfm` | 4.0.1 | MIT |
| `remark-math` | 6.0.0 | MIT |
| `tesseract.js` | 7.0.0 | Apache-2.0 |
| `zustand` | 5.0.15 | MIT |

## 开发依赖

| 包 | 版本 | 许可证 |
|----|------|--------|
| `@types/katex` | 0.16.8 | MIT |
| `@types/node` | 26.6.3 | MIT |
| `@types/pdf-parse` | 1.1.5 | MIT |
| `@types/react` | 19.3.0 | MIT |
| `@types/react-dom` | 19.3.0 | MIT |
| `@vitejs/plugin-react` | 5.2.0 | MIT |
| `electron` | 44.4.5 | MIT |
| `electron-builder` | 26.15.3 | MIT |
| `electron-vite` | 5.0.0 | MIT |
| `typescript` | 5.9.3 | Apache-2.0 |
| `vite` | 7.3.6 | MIT |
| `vitest` | 5.0.2 | MIT |

## 特别说明

- **Live2D**：Cubism Core / `pixi-live2d-display` 不随本项目分发，需用户自行获取并遵守其许可（Live2D Inc. 专有许可）。
- **夸克网盘**：适配器使用网页端接口，未包含任何官方 SDK；请遵守夸克网盘服务条款。
- **Fanxing**：学习通托管能力由独立子系统提供，本项目仅通过本地 HTTP 与其通信。
