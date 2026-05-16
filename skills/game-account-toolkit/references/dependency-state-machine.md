# 依赖检查状态机

## 目标

让筛选 skill 在执行前能判断工具是否可用，并在缺失时给出安全、可审计的安装路径。

## 状态

```text
START
  -> CHECK_NODE
  -> CHECK_BROWSER_ACCESS
  -> CHECK_OPTIONAL_TOOLS
  -> READY | NEED_USER_ACTION | DEGRADED_MODE
```

## CHECK_NODE

运行：

```bash
node --version
```

判定：

- Node.js 存在且版本 >= 22：继续。
- Node.js 存在但版本 < 22：可继续部分能力，但 WebSocket/CDP 可能需要 `ws` 包。
- Node.js 不存在：进入 `NEED_USER_ACTION`，提示用户安装 Node.js。

不要自动安装 Node.js。

## CHECK_BROWSER_ACCESS

若任务需要平台页面访问，先加载 `web-access` skill，并执行它的依赖检查。

判定：

- Chrome remote debugging 可用：继续。
- Chrome remote debugging 未开启：提示用户按 `web-access` 指南开启。
- 站点内容通过 WebFetch 足够获取：可不启用 CDP。

## CHECK_OPTIONAL_TOOLS

可选能力：

- OCR：用于截图中的角色、资源、绑定状态识别。
- Jina：用于正文网页转 Markdown。
- 本地样本库：用于保存人工确认过的挂牌样本。

缺失时处理：

- 不阻塞核心筛选。
- 降级为用户粘贴文本或手动提供截图内容。
- 若建议安装，必须说明安装命令和影响范围，并等待用户确认。

## READY

依赖满足，返回工具能力清单：

```yaml
capabilities:
  browser_cdp: true|false
  web_fetch: true|false
  ocr: true|false
  sample_store: true|false
limitations:
  - string
```

## NEED_USER_ACTION

缺少无法安全自动安装的依赖或设置，输出用户需要执行的步骤。建议用户用 `! command` 在当前会话运行需要交互的命令。

## DEGRADED_MODE

依赖不完整但仍可完成部分任务时，明确降级范围。例如：

- 无 OCR：只分析文本字段。
- 无 CDP：只使用 WebFetch 或用户粘贴内容。
- 无样本库：只做当前会话的一次性比较。

## 自我安装规则

允许：

- 在用户确认后安装项目本地 npm 依赖。
- 在用户确认后创建项目本地缓存目录或样本文件。

禁止：

- 静默全局安装工具。
- 修改系统配置。
- 绕过浏览器安全设置。
- 跳过验证码或登录限制。
- 因安装失败而绕过安全检查。
