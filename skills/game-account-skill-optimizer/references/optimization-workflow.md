# Skill 优化工作流

updated_at: 2026-05-17

## 目标

把真实执行过程中的问题变成可复查、可执行、可验证的 skill 改进建议。优化器关注“下次如何少走弯路”，而不是在当次运行里重新做完整筛选。

仓库采用自我进化 harness 的设计：执行记录是观测，优化器是故障诊断和改进建议层，评估器是质量门禁。任何优化都必须能回到运行证据、目标文件和验证命令。

## 输入来源

- 主筛选 skill 的执行记录。
- 生成器、评估器、社区更新、预检查、工具层或优化器自身的执行记录。
- 平台访问尝试记录：查询词、平台、耗时、状态、错误文本、是否返回候选。
- 社区证据尝试记录：来源、工具、查询词、等待预算、耗时、状态、正文/字幕/评论是否可读、降级路径。
- 推荐结果：入选、排除、缺失字段、规则更新建议。
- 备选结果：价格浮动备选、风险备选、商品链接、降级原因。
- 最终回复文本：是否暴露机器标签、是否解释清楚风险。
- 用户反馈：平台漏掉、估值误判、输出格式不适、风险判断不足。
- 质量门禁结果：`score`、`passed`、`redo_required`、阻塞问题和建议修复。

## 分析步骤

1. 读取运行记录，保留原始错误文本、平台路径和评估结果。
2. 先做 Troubleshooting：判断问题发生在平台访问、主筛选编排、游戏估值、工具层、生成器、评估器、证据刷新还是优化器自身。
3. 对每个问题按 `issue-taxonomy.md` 分类。
4. 合并同类问题，避免把同一个平台超时拆成多个噪声建议。
5. 输出建议修改的文件，但不默认写入。
6. 给每条建议标注是否适合自动补丁：
   - 文档/流程补充通常可自动补丁。
   - 游戏估值权重、社区 meta、平台解析逻辑默认需要人工确认。
7. 若本次运行已有用户明确要求实现优化，可由执行者按建议修改目标文件，并运行对应验证脚本和 `game-account-skill-evaluator`。

## 自我进化闭环

1. Observe：记录输入、平台尝试、失败文本、输出和用户反馈。
2. Diagnose：用优化器归因，不把慢、空、低分、误判混成一个笼统问题。
3. Patch：只在用户明确要求实现时修改目标 skill 或共享规则。
4. Evaluate：用目标验证脚本和 `game-account-skill-evaluator` 评分。
5. Redo：评分低于门槛、存在阻塞问题或 `redo_required: true` 时，回到 Diagnose/Patch，不允许把产物用于真实推荐。

## Troubleshooting 清单

- 慢：检查 `duration_ms`、重复查询、等待预算和降级路径。
- 空：检查 `empty_result`、登录提示、验证码、详情页 503、公开列表是否可读。
- 漏平台：对照 `platform-priority.json`，确认螃蟹、盼之、交易猫、淘手游是否按顺序尝试或明确降级。
- 缺 adapter：对照 `opencli list -f yaml` 和 `opencli <site> -h`，确认目标平台是否有现成命令；没有时判断是否适合按 OpenCLI adapter 流程固化。
- 已验证 adapter：若记录里有 `adapter_available: true`、`adapter_verified: true`、`adapter_command` 或 `verify_command`，下次同平台详情读取应先复用该命令，并定期跑 `opencli browser <session> verify <site>/<command> --strict-memory`。
- 列表/详情能力差异：若只有详情 adapter 可用而列表仍靠浏览器 DOM，记录 `list_adapter_available: false` 和 `detail_adapter_available: true`。优化器应只对缺失的列表能力报 adapter 缺口，同时继续对详情输出 adapter 复用建议。
- 社区证据缺口：检查是否有成功的 `community_attempts`；若只有标题、metadata 或列表卡片，应限制置信度并要求人工确认。
- 工具不可读：检查 B站字幕、小红书正文、评论等失败后是否切换到浏览器 DOM、页面 metadata、Jina/WebFetch/curl、官方公告、Wiki/攻略站或用户截图/文本。
- 文案怪：检查最终用户回复是否把 `<game_account_evaluation>`、`<recommendations>`、`<skill_quality_report>` 等标签当主文案暴露。
- 链接缺失：检查主推荐、价格浮动备选、风险备选和排除账号是否都保留商品 URL。
- 预算浮动：用户允许上下 200-300 元或 20%-30% 浮动时，检查是否单独输出 `flex_budget` 备选，且没有混入主推荐。
- 硬条件预算：用户预算内没有满足硬条件的账号时，检查是否扩大到 `flex_budget` 并返回最低满足价，而不是推荐预算内不合格账号。
- 估值窄：检查是否只看命座/高稀有度数量，而缺少队伍、主 C、专武/音擎/弧盘/模组/专精、资源和风险。
- 多队完整性：检查是否把同一个辅助/装备重复分配给多个核心；如果用户要求三队、双队或多核心队伍，必须有独立成队验证和反例 fixture。
- 质量低：读取 evaluator 报告，优先修复阻塞问题；如果是优化器产出的 skill，则生成 `quality_gate` finding 并打回重做。

## 输出原则

- 用户首先看到的是简洁的中文摘要和下一步动作。
- XML 标签仅用于内部契约或日志，不作为主推荐文案。
- 所有建议必须带证据，例如“xianyu search 超时 45s 且无输出”“最终回复包含 `<game_account_evaluation>`”。
- 平台覆盖建议必须区分“应该纳入搜索顺序”和“已经有可靠解析器”。
- Adapter 建议必须区分“可做一次性浏览器降级”和“值得生成 OpenCLI adapter”。只有平台会重复使用、数据在浏览器中可见、能找到可验证的 HTTP/JSON/HTML 数据源、且不需要绕过验证码/风控/付费墙时，才建议走 adapter 化。

## OpenCLI adapter 化路径

当执行记录显示目标站点没有现成命令、但平台价值高且会反复用于买号筛选时，优化器应输出 `platform-opencli-adapter-gap` finding，并建议执行下面的闭环：

1. 预检：运行 `opencli list -f yaml`、`opencli <site> -h`，确认没有可用站点命令或命令能力不足。
2. 侦察：运行 `opencli browser analyze <url>`，必要时用 `opencli browser open/state/network` 判断数据模式和反爬风险。
3. 判定：数据必须在浏览器可见，且来自可验证的 HTTP/JSON/HTML；验证码、登录墙、强风控、图片 OCR 或付费内容不做 adapter，直接降级为用户链接/截图/复制文本。
4. 生成：用 `opencli browser init <site>/<command>` 建私有 adapter，按 `opencli-adapter-author` 做 endpoint 验证、字段解码和输出列设计。
5. 验证：运行 `opencli browser verify <site>/<command> --write-fixture`，再用 fixture 收紧核心字段；字段值必须和网页肉眼值抽查一致。
6. 记忆：把 endpoint、field-map、notes 和 verify fixture 写入 `~/.opencli/sites/<site>/`；下次运行优先复用 adapter，并继续记录失败文本和降级路径。

Adapter 代码实现默认不是自动补丁。只有用户明确要求“实现/生成 adapter”并且验证通过后，才把它纳入当前推荐的数据来源。

## OpenCLI adapter 复用路径

当执行记录显示某个平台已有 verified adapter 时，优化器应输出 `platform-opencli-adapter-reuse` finding，而不是继续报缺口：

1. 运行记录必须保留 `adapter_available: true`、`adapter_verified: true`、`adapter_command`、`verify_command` 和页面样本 URL/商品编号；如果只覆盖详情页，也必须显式记录 `detail_adapter_available: true` 与 `list_adapter_available: false`。
2. 推荐前先执行 adapter 命令读取结构化字段；只有 adapter 失败、fixture mismatch 或字段缺失时，才退回 `browser state/eval`、截图或用户文本。
3. `verify_command` 必须能通过 `--strict-memory`，即 `~/.opencli/sites/<site>/endpoints.json` 和 `notes.md` 都存在。
4. 若 adapter 输出和网页肉眼值不一致，应按 `opencli-autofix` 或 adapter-author workflow 修 adapter，不要在游戏估值规则里补偿解析错误。
5. 私有 adapter 不进仓库时，repo 内只记录“如何识别/复用/验证”，实际 adapter 文件和站点记忆保留在 `~/.opencli/`。
6. 绝区零的 `pxb7/detail` / `pzds/detail` 必须保留详情页角色角标 `agentStatuses`。如果推荐记录只有 `voidHunters` 或标题几命，没有 `agentStatuses`，优化器应输出 `platform-agent-status-asset-cards-missing` 并要求回到 adapter 或标准化层修复。

## 手动执行模式

用户可直接粘贴问题描述，例如：

```text
用 game-account-skill-optimizer 分析这次鸣潮筛选为什么慢、为什么漏平台，以及怎么改 skill。
```

如果没有 JSON，优化器应先把用户描述标准化成临时 artifact，再输出低置信度建议。

## 自动执行模式

`game-account-select` 在筛选结束后可把运行摘要交给优化器。自动模式只生成报告；若发现可自动修复的文档问题，也必须由上层流程决定是否应用补丁。

自动应用优化后必须运行：

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs <target-skill> --json
```

若优化器输出报告已落盘，还可以评估报告引用的全部目标 skill：

```bash
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=<optimizer-report.json> --json
```
