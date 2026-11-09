# Game Account Select — 开发入口

仓库只有一个 skill：[game-account-select](skills/game-account-select/SKILL.md)。经验按「交易网站 × 游戏」两个维度积累在它的 `references/` 下；新增游戏或网站是加数据目录，不是加 skill。先读 [CONTEXT.md](CONTEXT.md)，单次运行数据留在 `.harness/`。

## 每次改动

1. `npm run dev:context -- --files <repo-relative-path> ...` 获取必读文档和验证范围；省略文件时读取当前 Git 改动。
2. 按 [开发流程](docs/development/workflow.md) 写下目标、责任文件和验收条件；关键决策写 ADR。
3. 实现后运行 `npm run dev:check`；交付前运行 `npm run verify:skills`。`live_required: true` 的改动还需真实 ego-browser 运行，离线通过不代表 live 通过。
4. 运行中得到的可复用经验，按 [OPS 模型](skills/game-account-select/references/ops-model.md) 写回唯一归属（站点 operation 或游戏目录）；完成后写 `changelogs/`。

## 按需上下文

| 触发 | 读取 |
| --- | --- |
| 新功能、重构 | [开发流程](docs/development/workflow.md)、[架构边界](docs/development/architecture.md) |
| 改测试、CI | [验证边界](docs/development/verification.md) |
| 改 skill 入口、目录、新增游戏/站点 | [Skill 结构](docs/development/skill-structure.md)、[knowledge-schema](skills/game-account-select/references/knowledge-schema.md) |
| 站点查询经验（列表/详情/字段/风控） | [sites](skills/game-account-select/references/sites/index.md) |
| 游戏资产判断经验（看什么/坑/证据） | [games](skills/game-account-select/references/games/index.md) |
| 跟踪 Issue / 规格 | [Issue tracker](docs/agents/issue-tracker.md)、[五态标签](docs/agents/triage-labels.md) |
| 领域术语或架构决策改变 | [Domain](docs/agents/domain.md)、相关 `docs/adr/` |

## 不变量

- 动态页面仅经 ego-ops / ego-browser；`status` 非 verified 的 operation fail closed；清理只处理本轮 task space。
- 用户原话和 run-only 画像（预算、偏好、区服、风险）只用于本轮，绝不写进经验文件。
- `last_verified` 只记录真实成功；经验里不存凭据、cookie、签名 URL、完整响应或个人信息。
- 强度/版本判断需要证据门槛（≥2 个独立作者、7 天内），缺字段只报告不加分。
- 按现有授权继续本地实现；只有缺少必要信息、真实 HITL 或外部操作授权时暂停。
- 需要 worktree 时创建仓库同级 `../game-account-select--<topic>`，复用主仓库 node_modules；合并后清理。
