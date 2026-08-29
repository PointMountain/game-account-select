---
name: game-account-preflight
description: 游戏账号 skill 执行前准备和环境校验。检查 Node、git、gh、opencli 与配套 skills，并把所有动态网页访问冻结到唯一的 ego-browser 路由；首次真实浏览器操作验证运行时，避免重复探针和多传输竞争。
argument-hint: "[--json|--strict|--browser|--unattended|--opencli-adapters]"
---

# Game Account Preflight Skill

## 作用

在 `game-account-select`、游戏估值 skill、社区更新 skill 或生成器执行前运行。它负责确认配套 skill、本地工具、联网能力和安全边界，避免执行到一半才发现缺依赖。

## 必须读取

- `references/preflight-checklist.md`
- `../game-account-toolkit/references/dependency-state-machine.md`
- `../game-account-toolkit/references/ego-browser-workflow.md`（需要浏览器时）
- `../game-account-toolkit/references/platform-access-policy.md`
- `../game-account-toolkit/references/skill-io-contract.md`

需要访问网页时，还必须完整读取当前可用的 `ego-browser/SKILL.md`。浏览器操作以该 skill 的 task-space、观察、交互、接管和清理规则为最终准则。

## 执行

运行：

```bash
node skills/game-account-preflight/scripts/preflight.mjs --json
```

如需要动态或登录态页面，追加 `--browser`。预检直接冻结 `browser_route.selected_transport: ego_browser`，但不运行 `which`、版本或连接探针；首次 `ego-browser nodejs` 操作同时完成运行时验证，减少无效启动和重复等待。

用户不在电脑前、后台执行或明确要求无人值守时使用 `--unattended`（它隐含 `--browser`）。ego-browser 使用隔离 task space，正常情况下可继续无人值守；一旦返回“user is controlling”、inactive 或未分配状态，整个浏览器路径立即暂停，等待用户明确确认后才能继续，不能切换其它传输绕过接管。

如需要确认仓库托管的 Pxb7/PZDS OpenCLI adapter 是否已同步到本机，追加 `--opencli-adapters`。Adapter 是结构化字段交叉验证能力，不是第二条浏览器传输。

## 输出

必须先把 `<preflight_report>` 显示给用户，再继续后续 skill 输出：

```xml
<preflight_report>
  <ok>true|false</ok>
  <browser_route format="json">{}</browser_route>
  <checks format="json">[]</checks>
  <missing_optional format="json">[]</missing_optional>
  <missing_required format="json">[]</missing_required>
  <manual_actions format="json">[]</manual_actions>
  <safe_auto_actions format="json">[]</safe_auto_actions>
</preflight_report>
```

## 安全边界

- 不静默安装全局工具或修改 Codex skills。
- 不绕过登录、验证码、平台风控或付费墙。
- 浏览器路由只有 `ego_browser`；运行中不初始化其它浏览器自动化栈。
- 每轮只创建或复用一个与本轮目标对应的 task space，并优先保存返回的数字 id。
- 用户接管、inactive 或未分配状态是硬停止；只有用户明确确认后才能 `takeOverTaskSpace` 或 `claimTaskSpace`。
- 完成后用独立最终 heredoc 调 `completeTaskSpace(id, { keep: false })`；只有明确需要留给用户操作或查看时使用 `keep: true`。
- 对缺失的运行时只在首次真实操作失败后按 ego-browser 的安装指南处理，不预先堆叠探针。
- 对缺失或版本不一致的仓库托管 OpenCLI adapter，只输出安装脚本指引；不静默写入 `~/.opencli`。
