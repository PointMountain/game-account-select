# 执行前准备检查清单

updated_at: 2026-08-02

## 必需检查

- Node.js 22+：运行本仓库 ESM 脚本。
- git：分支、diff 和提交工作流。
- gh：远端 PR、CI 和仓库配置。

## 条件检查

- opencli：中文平台和 AI/社区搜索路由。
- repo-managed OpenCLI adapters：Pxb7/PZDS 游戏专用详情 adapter 是否已从本仓库同步到本机 `~/.opencli`。当前绝区零使用 `pxb7/zzz-detail` 和 `pzds/zzz-detail`；只有用户请求平台详情抽取或使用 `--opencli-adapters` 时检查。
- chrome-use extension relay：浏览器主路径，复用真实 Chrome 的登录态和用户可见页面，不依赖 remote-debugging-port。连接成功后跳过全部 web-access/CDP 检查。
- web-access skill + Chrome remote debugging：仅在交互模式且 `chrome-use` 不可用时检查的浏览器兜底；无人值守模式禁用。
- OCR：只有当账号资产只在图片中时需要。

## 自动安装策略

当前仓库没有 package manager，也不引入本地依赖，因此 preflight 默认不执行自动安装。

允许未来扩展的自动动作：

- 安装仓库内声明的本地 npm 依赖。
- 创建临时输出目录。

禁止静默自动动作：

- 全局安装 `opencli` 或系统包。
- 静默写入或覆盖 `~/.opencli` adapter。
- 修改 Chrome 设置。
- 安装或删除 Codex skills。
- 写入用户 shell profile。

## 降级策略

- 缺 `opencli`：可以让用户提供网页链接、截图或复制文本。
- 缺 repo-managed OpenCLI adapter：运行 `node skills/game-account-toolkit/scripts/install-opencli-adapters.mjs --install`；若本机已有不同 adapter，先检查差异，确认后再加 `--force`。
- 缺 `chrome-use` 但 `web-access` + CDP 可用：仅在用户在场的交互模式使用 CDP 兜底，并提示授权可能在浏览器/代理重启后再次出现。
- 无人值守且缺 `chrome-use` relay：不探测、不启动 web-access/CDP；记录浏览器覆盖缺口并等待扩展恢复连接。
- 两条浏览器通道都缺失：只能使用静态网页、搜索结果或用户输入，必须降低社区覆盖置信度。
- 缺 OCR：让用户复制文本或手动转写关键资产。
