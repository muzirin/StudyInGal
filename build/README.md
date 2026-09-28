# 打包资源目录

electron-builder 从这里读取应用图标与安装程序资源。

| 文件名 | 用途 | 规格 |
|--------|------|------|
| `icon.png` | Windows / macOS / Linux（electron-builder 会自动转换为 `.ico` / `.icns`） | 1024×1024 |

`icon.png` 使用与运行时托盘图标相同的算法生成（樱花色五瓣花，主色 `#E85C97`），
生成逻辑见 `src/main/lib/png.ts`，因此改配色时请同步更新图标。
