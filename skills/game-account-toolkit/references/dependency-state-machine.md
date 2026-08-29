# 依赖检查状态机

## 目标

让筛选 skill 在执行前冻结唯一浏览器路线，在第一次真实操作验证运行时，并把控制权和清理状态纳入可审计结果。

## 状态

```text
START
  -> CHECK_NODE
  -> FREEZE_BROWSER_ROUTE
  -> LOAD_EGO_OPS_TASK_CARD
  -> CHECK_OPTIONAL_TOOLS
  -> READY
  -> FIRST_BROWSER_OPERATION
  -> RUNNING | NEED_USER_ACTION | DEGRADED_MODE
  -> COMPLETE_TASK_SPACE
```

## CHECK_NODE

运行 `node --version`。Node.js >= 22 时继续；版本过低或不存在时进入 `NEED_USER_ACTION`。不要自动安装 Node.js。

## FREEZE_BROWSER_ROUTE

任务需要动态、交互式或登录态网页时，把 `browser_route.selected_transport` 冻结为 `ego_browser`。这是单一路由选择，不进行多个浏览器工具的并行体检。

显式使用 ego-browser 时，不提前执行 `which`、版本、package metadata 或连接探针。预检只记录：

```yaml
browser_route:
  selected_transport: ego_browser
  query_governance: ego_ops
  operation_knowledge: progressive_read
  knowledge_writeback: success_only
  runtime_validation: first_browser_operation
  task_space_required: true
  cleanup_policy: complete_task_space
  control_handoff_policy: pause_until_explicit_user_confirmation
```

## CHECK_OPTIONAL_TOOLS

- OCR：识别平台验号图中的角色、资源和绑定状态。
- 本地样本库：保存脱敏且人工确认过的挂牌字段。

缺失时不阻塞核心浏览器读取；在 `capabilities` 和 `coverage_gaps` 中标记降级。任何安装都必须说明命令、写入位置和影响范围，并等待用户确认。

## FIRST_BROWSER_OPERATION

先加载 `ego-ops/SKILL.md`、本机经验、目标站点 index 与 operation，建立只读任务卡；再加载 `ego-browser/SKILL.md`，然后通过仓库 runner 运行首个已验证 operation：

```bash
npm run query:ego -- --operation <platform>/<game>-list --input '<json>' --task-space <goal-name> --json
```

runner 负责 `useOrCreateTaskSpace`、目标 URL、页面身份与 expected signals 校验，并输出 task space id 和结构化结果。缺失 verified matrix cell 时不启动浏览器，直接进入 `DEGRADED_MODE`。

判定：

- 成功：保存数字 task space id，进入 `RUNNING`。
- 命令或环境缺失：读取 ego-browser 的 `references/install.md`，完成安装后恢复原任务。
- 用户控制、inactive 或未分配：进入 `NEED_USER_ACTION`，不重试、不新建替代空间、不自动夺回。
- 页面登录墙、验证码、风控或付费墙：进入 `DEGRADED_MODE`，不绕过限制。

## READY / RUNNING

```yaml
capabilities:
  ego_ops: true
  ego_browser: true
  semantic_snapshot: true
  browser_context_fetch: true
  visual_interaction: true
  operation_knowledge: verified_operation_available|exploration_required
  ocr: true|false
  sample_store: true|false
task_space:
  id: number|null
  name: string|null
  ownership: agent|agentDelegatedToUser|user|null
limitations:
  - string
```

## NEED_USER_ACTION

告诉用户具体 task space 和需要完成的动作。只有用户明确回复继续后，才能按 ego-browser 规则调用 `takeOverTaskSpace`；对已有 user-owned/inactive 空间，先列出空间并在确认后 `claimTaskSpace(id)`，再选择确切标签页。

## DEGRADED_MODE

- 语义树不完整：切换到一次 `js()` IIFE 或视觉工作流。
- 页内请求失败：保留已加载可见行并标记 `partial`；正常筛选只允许重验同一个 verified operation 或改用用户材料，不启动探索路径。
- 无 OCR：只分析文本字段，图片资产列人工确认。
- 动态页面被阻断：记录 coverage gap，使用已有本地证据或用户提供链接/截图/文本，并降低置信度。

## COMPLETE_TASK_SPACE

确认任务完成后，用独立最终 heredoc 检查 task space ownership；只有 ownership 仍是 `agent` 时才调用 `completeTaskSpace(id, { keep: false })`。清理报告记录 `done`、关闭的 task space id/name、剩余空间和进程审计。用户明确要求保留页面时才使用 `keep: true`。

## 自我安装规则

允许在用户确认后安装项目本地依赖、创建项目本地缓存目录或按 ego-browser 安装指南恢复缺失运行时。禁止静默全局安装、修改系统配置、绕过浏览器安全设置、跳过验证码或因安装失败而绕过安全检查。
