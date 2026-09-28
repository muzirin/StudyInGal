# 夸克网盘适配器调研与实现说明

## 结论速览

| 项目 | 结论 |
|------|------|
| 官方开放平台 | ❌ 夸克网盘目前**没有**面向第三方桌面应用的公开开放平台 / OAuth 应用体系 |
| 可行接入方式 | ⚠️ 使用 PC 网页端接口 + 用户自备登录 Cookie（逆向实现，官方改版即可能失效） |
| 本仓库实现 | 浏览目录、创建目录、下载文件、连接测试 |
| 未实现 | 文件上传（夸克上传需要 3 步预上传 + 分片 + 秒传校验，稳定性与合规性风险较高） |
| 推荐替代 | 多端同步请优先使用 **WebDAV**（坚果云 / Nextcloud / Alist）或 **SMB** |

## 为什么没有直接安装第三方「夸克网盘 Skill」

任务里提到的 `quarkclouddrive-*.zip` 是一个第三方客户端/技能包，需要：

1. 从非官方域名下载可执行内容；
2. 运行安装程序；
3. 登录并授权你的个人网盘账号。

这三步都涉及在你机器上执行不受本仓库控制的第三方二进制、并授予其访问你个人云盘数据的凭据。
在无法审计该压缩包来源与行为的前提下，本仓库**不会**自动下载、安装或代你完成账号授权。

更安全的做法是：如果你确实需要夸克能力，请自行在隔离环境中审查并安装该技能；StudyInGal 这边保持
「可插拔适配器」——你只需要在 `设置 → 云盘与同步 → 新建挂载 → 夸克网盘` 里填入 Cookie，即可使用浏览/下载能力。

## 已实现的接口

基址：`https://drive-pc.quark.cn`（可在挂载配置中覆盖 `baseUrl`）

| 能力 | 方法 | 路径 |
|------|------|------|
| 列目录 | GET | `/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=<fid>&_page=1&_size=200&_sort=file_type:asc,file_name:asc` |
| 新建目录 | POST | `/1/clouddrive/file?pr=ucpro&fr=pc`（body: `{ pdir_fid, file_name, dir_path, dir: true }`） |
| 获取下载地址 | GET | `/1/clouddrive/file/download?pr=ucpro&fr=pc&fid=<fid>` |

请求头需要携带 `Cookie`（浏览器登录夸克网页版后从开发者工具复制）。

## 如何获取 Cookie

1. 浏览器登录 <https://pan.quark.cn/>；
2. 打开开发者工具 → Network；
3. 刷新页面，任选一个 `drive-pc.quark.cn` 请求；
4. 复制请求头里的完整 `Cookie` 值；
5. 粘贴到 StudyInGal 的夸克挂载配置中。

> Cookie 等同账号凭据，请勿分享或提交到仓库。StudyInGal 只把它保存在本机设置文件中。

## 后续可做

- 上传（预上传 → 分片上传 → `/file/upload/auth` 完成）
- 分享链接解析
- 秒传（`/file/upload/check` 哈希校验）

如果你希望贡献其中任何一项，欢迎提 PR，并在 PR 描述中说明所依据的接口文档或抓包结果。
