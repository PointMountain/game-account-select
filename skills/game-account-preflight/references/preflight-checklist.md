# 执行前准备检查清单

updated_at: 2026-05-16

## 必需检查

- Node.js 22+：运行本仓库 ESM 脚本。
- git：分支、diff 和提交工作流。
- gh：远端 PR、CI 和仓库配置。

## 条件检查

- opencli：中文平台和 AI/社区搜索路由。
- web-access skill：真实 Chrome/CDP、登录态页面、动态网页。
- Chrome remote debugging：`web-access` 浏览器模式需要。
- OCR：只有当账号资产只在图片中时需要。

## 自动安装策略

当前仓库没有 package manager，也不引入本地依赖，因此 preflight 默认不执行自动安装。

允许未来扩展的自动动作：

- 安装仓库内声明的本地 npm 依赖。
- 创建临时输出目录。

禁止静默自动动作：

- 全局安装 `opencli` 或系统包。
- 修改 Chrome 设置。
- 安装或删除 Codex skills。
- 写入用户 shell profile。

## 降级策略

- 缺 `opencli`：可以让用户提供网页链接、截图或复制文本。
- 缺 `web-access`：只能使用静态网页、搜索结果或用户输入，必须降低社区覆盖置信度。
- 缺 OCR：让用户复制文本或手动转写关键资产。
