# Skill 结构与使用

用户主动找号使用 `game-account-select`；单个账号估值使用对应游戏 skill；复盘和实现改进使用 `game-account-skill-optimizer`；新游戏和证据刷新分别使用 generator / updater。

每个 `SKILL.md` 保留职责、输入输出、主要步骤、硬约束和按场景引用。平台流程、评分对象结构和维护操作放 references；复现放 test-fixtures / tests；可执行能力放 scripts。入口以 100 行为维护上限，超过时按真正的条件分支拆分，而不是删掉关键约束。

依赖来自 [dependencies.json](../../skills/dependencies.json)。`required` 与 `game_required` 是可执行闭包；`conditional` 仅在新游戏/过期证据等分支触发。闭包允许 runtime 的 optimizer/evaluator 相互调用；evaluator 的既有递归保护仍负责执行边界。安装组合必须含完整 required 闭包。

```bash
npm run list:skills -- --profile arknights
npm run dev:context -- --files skills/game-account-arknights/scripts/score-listings.mjs
npm run learn:collect -- --input /absolute/path/run.json
npm run learn:status
```

新增游戏继续由 generator 创建，自动继承 `game_required`；生成模板同步使用相同质量与学习契约。root `skills/llms.txt` 仅作发现索引，不能取代 SKILL.md。本地 symlink 安装从当前 checkout 读取；复制安装需要发布后重新安装才能获得改动。
