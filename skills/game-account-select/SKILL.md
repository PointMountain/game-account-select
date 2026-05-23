---
name: game-account-select
description: 根据用户预算、游戏目标、平台偏好和风险偏好，查询并筛选中国游戏账号平台的候选账号，调用游戏专属 skill 进行估值和解释。
argument-hint: "[游戏] [预算] [偏好]"
---

# Game Account Select Skill

## 作用

这是游戏账号智能筛选体系的主编排 skill。它负责把用户需求转成查询条件，先调用 `game-account-preflight` 做执行前准备，再调用 `game-account-toolkit` 做工具和平台访问策略，最后调用对应游戏 skill 做资产估值。

## 依赖

必须引用：

- `game-account-preflight`
- `game-account-toolkit`
- `game-account-skill-generator`（当游戏未支持时）
- `game-account-skill-evaluator`（当生成、更新 skill 后，以及每次筛选的收尾质量门禁）
- `game-account-community-updater`（当社区证据过期或用户要求刷新时）
- `game-account-skill-optimizer`（筛选结束后分析慢路径、空结果、平台覆盖、输出格式、估值误判和质量门禁问题）

按游戏引用：

- Wuthering Waves（鸣潮） → `game-account-wuthering-waves`
- 明日方舟 → `game-account-arknights`
- Neverness to Everness（异环） → `game-account-neverness-to-everness`
- Zenless Zone Zero（绝区零 / ZZZ） → `game-account-zenless-zone-zero`

## 执行流程

第一步必须运行 `game-account-preflight`，并先显示 `<preflight_report>`。若缺少必需依赖，停止筛选并给出补齐步骤；若只缺少可选能力，继续但在推荐中标注降级范围。

读取 `references/selection-state-machine.md`，按状态机执行。不要把流程写成泛泛建议；每一步都要有明确输入、输出和降级路径。每次真实查询都必须执行状态机里的 `POST_RUN_OPTIMIZE` 收尾阶段：先生成 raw run artifact，运行 `game-account-skill-optimizer`，再运行 `game-account-skill-evaluator --from-report=<run-artifact>`，根据门禁结果补查、降级、改写推荐或打回重做。

## 标准输入输出

读取 `../game-account-toolkit/references/skill-io-contract.md`。优先接受 `<game_account_request>`，最终输出 `<recommendations>`。如果需要评价单个账号，游戏 skill 必须输出 `<game_account_evaluation>`。

## 默认筛选目标

优先解决用户“大海捞针”的问题：主动找到符合条件的候选账号，而不是只分析用户粘贴的单个链接。

默认支持条件：

- 游戏
- 预算
- 平台范围
- 官服/B服/渠道服
- 绑定要求
- 找回包赔/官方验号
- 强度开荒
- 抽卡资源
- 收藏/皮肤
- 性价比
- 低风险

## 平台优先级

平台顺序以 `game-account-toolkit/references/platform-priority.json` 为准。用户没有指定平台时，优先把中国账号交易平台按低频、可解释方式纳入候选来源：

1. 用户提供的链接、截图或指定平台。
2. 螃蟹账号代售 `https://www.pxb7.com/`。
3. 盼之代售 `https://www.pzds.com/`。
4. 交易猫。
5. 淘手游。
6. 闲鱼仅作为补充来源；若出现登录推荐页、验证码、空卡片或长时间无输出，立即降级，不反复重试。

不应声称已覆盖没有实际读取的平台。平台不可读时，把它列入“数据来源与限制”，并建议用户提供链接、截图或复制文本。

## 输出格式

```text
1. 查询条件
2. 数据来源与限制
3. 入选账号 Top N
4. 每个账号的推荐理由
5. 每个账号的风险/缺失字段
6. 被排除账号与排除理由
7. 需要用户人工确认的问题
8. 本次规则是否需要更新
```

面向用户的最终答复必须先输出自然语言推荐结论、Top N、风险和人工确认项。`<game_account_evaluation>`、`<recommendations>` 等标签只用于内部契约、调试或用户明确要求结构化输出时展示，不要把原始标签作为主文案直接暴露。

## 自我优化

每次执行结束，如果用户反馈推荐错误，先判断错误类型：

- 平台解析错误
- 游戏估值权重错误
- 当前版本强度知识过期
- 用户偏好理解错误
- 风险判断不足
- 生成或优化后的 skill 未通过质量门禁

只有在用户确认后，才能修改对应 skill 的规则文件。修改后写入该 skill 的 changelog。

每次筛选完成后，应把本次运行摘要交给 `game-account-skill-optimizer`，至少包括：

- 平台尝试、查询词、耗时、等待预算、结果数、失败文本、列表/详情 adapter 可用性、降级路径。
- 社区证据尝试、工具、等待预算、失败文本、正文/字幕/评论是否可读、降级路径。
- 主推荐、价格浮动备选、风险备选和排除账号，全部保留 URL、价格、分层、降级原因。
- 最终回复草稿是否用了结构化标签、是否包含自然语言结论、风险和人工确认项。
- 用户反馈、规则更新建议和残留问题。
- 目标 skill 的 evaluator 报告；若已有优化产物，还要包含 `score`、`passed`、`redo_required`、`mode`、`optimizer_findings` 和阻塞问题。

自动优化阶段默认只产出优化报告、评估结果和用户可读摘要，不静默写入其它 skill。用户明确要求“实现/应用这些优化”时，才按报告修改对应文件并运行验证。

每次筛选的收尾阶段都必须运行：

```bash
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input <run-artifact.json> --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=<run-artifact.json> --json
```

若 evaluator 对 raw run artifact 输出 `redo_required: true`，必须处理非 info `optimizer_findings`：能补查的回到对应状态补查；不能补查的平台/卖家/登录限制必须降置信并写入最终风险。应用优化后还必须运行目标 skill 的 `game-account-skill-evaluator`；若低于门槛、存在阻塞问题或 `redo_required: true`，本轮产物必须打回重做，不得继续用于真实账号推荐。
