# Game Account Select — 开发入口

先读 [CONTEXT.md](CONTEXT.md)，再按本次改动加载上下文。职责、验证和经验应留在仓库，单次运行数据留在 `.harness/`。

## 每次改动

1. `npm run dev:context -- --files <repo-relative-path> ...` 获取责任 skill、必读文档和验证范围；省略文件时读取当前 Git 改动。
2. 按 [开发流程](docs/development/workflow.md) 写下目标、责任文件和验收条件。跨层改动先生成任务卡，关键决策写 ADR。
3. 实现后运行 `npm run dev:check`；共享契约和交付前运行 `npm run verify:skills`。`live_required: true` 的改动还需真实浏览器验证，离线通过不代表 live 通过。
4. 有可复用故障时，按 [学习闭环](skills/game-account-skill-optimizer/references/learning-loop.md) 先记录、再补丁、回归、沉淀；完成后写 `changelogs/`。

## 按需上下文

| 触发 | 读取 |
| --- | --- |
| 新功能、重构、跨 skill 修改 | [开发流程](docs/development/workflow.md)、[架构边界](docs/development/architecture.md) |
| 改测试、契约、CI 或发布能力 | [验证边界](docs/development/verification.md) |
| 修改 skill 入口、依赖、生成模板 | [Skill 结构](docs/development/skill-structure.md) |
| 修改规则/解析或处理反复失败 | [学习闭环](skills/game-account-skill-optimizer/references/learning-loop.md) |
| 跟踪 Issue / 规格 | [Issue tracker](docs/agents/issue-tracker.md)、[五态标签](docs/agents/triage-labels.md) |
| 领域术语或架构决策改变 | [Domain](docs/agents/domain.md)、相关 `docs/adr/` |

## 不变量

- 动态页面仅经 ego-ops / ego-browser；未验证能力 fail closed，清理只处理本轮 task space。
- 用户原话、run-only 画像、证据来源、coverage 和确定性交付契约必须保留。
- `applied` 需要真实补丁与当前验证凭据；`verified_existing` 只是既有能力复核。
- 按现有授权继续本地实现；只有缺少必要信息、真实 HITL 或外部操作授权时暂停。
- 当前任务默认串行。用户要求并行时分配不重叠责任文件；共享契约由一个执行者维护，集成后统一验证。
- 需要 worktree 时创建仓库同级 `../game-account-select--<topic>`，复用主仓库 node_modules；合并后清理 worktree 和对应分支。
