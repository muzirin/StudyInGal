# 开源素材库（场景背景 / 立绘 / Live2D）

> **本项目已经内置了一套开源素材**，开箱即用：
> - **场景背景**：`resources/assets/backgrounds/`（CC0 / CC-BY，随安装包分发）
> - **角色立绘**：`resources/assets/sprites/`（CC0，由开源分层素材合成）
> - 授权与署名见 [`resources/assets/CREDITS.md`](../resources/assets/CREDITS.md)。
>
> 想换成自己喜欢的素材？见下面各节，或直接在应用里：
> 主页 → 左上角场景名 → **「导入场景」**（多选本地图片，立即生效）；
> 角色管理 → 编辑角色 → **「内置素材」**页签可一键套用内置立绘。
>
> 重新生成内置素材（需要先自行下载素材到源目录）：
> ```bash
> node scripts/fetch-commons-backgrounds.mjs   # 从 Wikimedia 抓 CC0/CC-BY 背景（可选）
> node scripts/build-assets.mjs <源目录>        # 整理/合成为 resources/assets
> ```


> ⚠️ **务必逐个确认授权**：下面标注的是来源站点与常见授权，具体以每个素材页面的 License 声明为准。
> 尤其注意：网盘 / GitHub 上的「Live2D 模型合集」常混入**未授权的动漫角色模型**（如某些动画角色），
> 这类模型不可用于分发。仅使用作者明确声明可用的模型。

---

## 一、场景背景（Backgrounds）

| 来源 | 内容 | 授权 | 备注 |
|------|------|------|------|
| [itch.io · Quark_Yifu「Visual Novel Backgrounds 431 Image BG Set」](https://quarkyifu.itch.io/visual-novel-backgrounds-431-mage-bg-set) | 431 张 1600×900 视觉小说背景 | 作者声明为公有领域 / CC0 | 数量大、风格统一，最省事的一套 |
| [itch.io · Iletora「School Hallway」](https://iletora.itch.io/school-hallway) | 学校走廊（早/晚两张，1920×1080） | CC0 1.0 | 单套体积小，适合先试 |
| [OpenGameArt · CC0 - Image Backgrounds](https://opengameart.org/content/cc0-image-backgrounds) | 各类场景背景合集 | CC0 | 无需署名 |
| [OpenGameArt · Lemmasoft Assets - Backgrounds](https://opengameart.org/content/lemmasoft-assets-backgrounds) | LemmaSoft 论坛 CC 素材汇总（按许可分包） | CC0 / CC-BY / CC-BY-SA | 下 `backgrounds_cc0*.zip` 最省心 |
| [OpenGameArt · Visual Novel House Backgrounds](https://opengameart.org/content/visual-novel-house-backgrounds) | 住宅内部 11 张 1920×1080 | CC-BY 3.0 | 需署名 |
| [itch.io · Free Outdoor Visual Novel Backgrounds](https://itch.io/c/6892816/visualnovel-assets-ccbycc0) | 四季自然风景 | 见页面说明 | 合集页里还有更多 CC 素材 |
| [itch.io 视觉小说背景标签页](https://itch.io/game-assets/free/genre-visual-novel/tag-backgrounds) | 免费背景汇总 | 各不相同 | 逐个确认授权 |
| [Kenney.nl](https://kenney.nl/assets) | 通用 2D 素材 | CC0 | 偏卡通 / 简约风 |

**落地方式**：主页 → 点击左上角场景名 → 「添加本地背景」，选中图片即可立即生效（支持 png / jpg / webp / gif）。

---

## 二、立绘（Character Sprites, 静态）

| 来源 | 内容 | 授权 | 备注 |
|------|------|------|------|
| [itch.io 免费视觉小说素材（角色/立绘标签）](https://itch.io/game-assets/free/genre-visual-novel) | 大量免费立绘包 | 各不相同 | 优先选标 **CC0** 的 |
| [OpenGameArt 2D 角色素材](https://opengameart.org/art-search-advanced?keys=&field_art_type_tid%5B%5D=9) | 角色立绘 / 头像 | CC0 / CC-BY / GPL | 注意 GPL 会传染 |
| [Kenney.nl Characters](https://kenney.nl/assets?q=character) | 卡通角色 | CC0 | 风格偏简洁 |
| 自己用编辑器生成 | Picrew 等捏人工具 | 各站点条款不同 | 导出前看清是否允许商用 |

**落地方式**：角色管理 → 编辑角色 → 「立绘」页签 → 添加立绘，并为每张图指定情绪
（`neutral / happy / thinking / surprised / serious / shy / excited / sad / angry`），
对话与 Galgame 会按模型返回的情绪自动切换。

---

## 三、Live2D 模型

| 来源 | 内容 | 授权 | 备注 |
|------|------|------|------|
| [Live2D 官方示例模型](https://www.live2d.com/en/download/sample-data/) | ひより / 春 / まお / なとり / リース / レン 等 | **Free Material License** | 个人与「小规模事业者」（年营收 < 1000 万日元）可商用；须署名「本内容使用了 Live2D Inc. 拥有著作权的示例数据」；中型以上企业仅限内部/监督用途 |
| [官方示例数据使用条款](https://www.live2d.com/en/learn/sample/model-terms/) | 条款原文 | — | 使用前必须阅读并同意 |
| [Open-LLM-VTuber · live2d-models](https://github.com/Open-LLM-VTuber/live2d-models) | 部分官方示例模型的整理 | 随模型 | 仍是上面的 Free Material License |
| [VTuber Nook · Free Models](https://vtuber-nook.com/category/live2d-3d-pngtuber-models) | 免费 Live2D / VRM / PNGTuber 汇总 | 各不相同 | 逐个看作者条款 |
| [VRoid Studio](https://vroid.com/en/studio) | 自制 3D 模型（可导出 VRM） | 软件免费，模型看作者 | 本项目当前走 Live2D 路径 |

**使用步骤**

1. 从上述来源下载模型包，解压后应包含 `xxx.model3.json`、`xxx.moc3`、纹理与动作文件。
2. 从 Live2D 官方下载页面取得 **Cubism Core**（`live2dcubismcore.min.js`），自行托管到可访问的地址
   （本项目**不分发**它，因为它是 Live2D Inc. 的专有软件）。
3. 设置 → Live2D：填写 Cubism Core 脚本地址，并打开「启用 Live2D 渲染」。
4. 角色管理 → 编辑角色 → 「Live2D」页签：选择 `xxx.model3.json`。
5. 回到主页，立绘区会切换为 Live2D 渲染。

> 本项目使用的运行时是 `pixi.js`（MIT）与 `pixi-live2d-display`（MIT）。
> Cubism Core 与模型素材的授权与它们无关，需分别遵守。

---

## 四、授权速查

- **CC0 / Public Domain**：最安全，可商用、可修改、无需署名。
- **CC-BY**：可商用，**必须署名**（在「关于」或作品说明中列出作者与来源）。
- **CC-BY-SA**：可商用，署名 + **衍生作品需同许可**（对本项目而言可能要求整个作品 GPL 化，谨慎）。
- **GPL**：素材若为 GPL，分发时需遵守 GPL（本项目本身是 GPL-3.0，但引擎代码与素材授权仍要分开确认）。
- **Free Material License（Live2D）**：见上文，个人/小规模可商用，须署名，且禁止部分用途。
- **不明授权**：一律不要用于分发。

如果你发现某个素材被误用，请开 issue，我们会立即移除相关引用。
