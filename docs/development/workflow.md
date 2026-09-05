# 开发流程

## 从目标到交付

人负责产品方向、判断标准和真实授权边界；Agent 负责把目标变为可验证结果。现有授权覆盖的本地开发继续执行，不重复要求确认。

1. **定位**：读 CONTEXT、相关 ADR 和 `dev:context` 指向的文件。写明当前问题和希望改变的行为；修 bug 时先留失败样本。
2. **计划**：小改动在当前任务记下文件与验收即可。跨层改动生成任务卡：

   ```bash
   npm run dev:plan -- --task fix-evidence --goal '缺证据不计已应用' --acceptance '虚假 applied 被门禁拒绝，合法凭据通过' --files skills/game-account-skill-optimizer/scripts/analyze-run.mjs
   ```

   `.harness/tasks/` 是本地执行记录。已关联 Issue 的工作在卡片填写编号；共享规格继续使用 GitHub Issues。新的外部发布遵循本轮授权。需要版本管理的设计决策放 `docs/adr/`，实施记录放 `changelogs/`。
3. **实现**：先跑受影响边界的基线，再做最小完整切片：输入 → 行为 → 验证。变更范围改变时更新任务卡和验证范围。
4. **验证**：`npm run dev:check` 按实际 Git 改动运行离线门禁。交付前 `npm run verify:skills`。平台操作变更再完成 live smoke 和精确清理；遇阻塞保留未验证范围。
5. **回流**：复发故障在改动前 `learn:collect`；保留通用正反例，修复后 `learn:verify`、`learn:apply`。无有效改进时如实记录 pending/verified_existing。
6. **交付**：任务卡更新完成状态和证据；changelog 记录问题、行为、验证及限制。报告实际本地/远端状态。

## 多 Agent 协作

只有用户明确要求时并行。任务卡分别写入 owner、责任文件、输入/输出和验收标准。共享接口先由主执行者固定；实现者不能撤销他人的改动。集成者检查交叉依赖，合并所有结果后重新运行统一门禁。

需要隔离时使用 sibling worktree：`git worktree add ../game-account-select--<topic> -b <topic>`；有 node_modules 时以 symlink 复用主仓库依赖。工作区结束不代表已合并，合并后才移除目录和分支。

## 控制上下文成本

AGENTS.md 是索引，SKILL.md 是调用入口，references 是按场景细节；脚本/fixture 是可执行事实。新增规则先找现有所有者，避免在每个 skill 复制一遍。修复文档矛盾时删除过期副本，并让验证器覆盖可机器检查的约束。
