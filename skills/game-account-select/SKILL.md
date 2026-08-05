---
name: game-account-select
description: 根据用户预算、游戏目标、平台偏好和风险偏好，先制定覆盖计划，再低频查询中国游戏账号平台候选账号，调用游戏专属 skill 估值，并把平台缺口、社区证据、用户反馈和优化建议沉淀到可验证的 run artifact。
argument-hint: "[游戏] [预算] [偏好]"
---

# Game Account Select Skill

## 作用

这是游戏账号智能筛选体系的主编排 skill。它负责把用户需求转成查询条件，先调用 `game-account-preflight` 做执行前准备，再调用 `game-account-toolkit` 做工具和平台访问策略，最后调用对应游戏 skill 做资产估值。

## 设计哲学

本 skill 借鉴 `web-access` 的执行哲学：先定义成功标准，再选择最可能直达目标的起点；每一步结果都是证据，失败后换路径而不是重复等待；完成后把可复用事实沉淀到 references、fixtures 或优化器知识库。

主入口只做策略编排：

- `SKILL.md` 负责入口、边界、必须读取文件和对外契约。
- `references/selector-architecture.md` 负责层级边界、成功标准和停止条件。
- `references/source-coverage-playbook.md` 负责平台与社区来源覆盖计划。
- `references/knowledge-ledger.md` 负责把运行观察转成可验证的知识更新候选。
- `references/selection-state-machine.md` 负责具体状态转换、字段、降级和门禁。

不要把一次搜索结果当成完整结论。默认先生成 `success_criteria` 和 `coverage_plan`，再进入平台读取；最终必须把成功、失败、降级和待沉淀知识写入 raw run artifact。

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

执行前必须读取：

- `references/selector-architecture.md`
- `references/source-coverage-playbook.md`
- `references/knowledge-ledger.md`
- `references/selection-state-machine.md`
- `../game-account-toolkit/references/skill-io-contract.md`

按状态机执行，不要把流程写成泛泛建议；每一步都要有明确输入、输出和降级路径。每次真实查询都必须执行状态机里的 `POST_RUN_OPTIMIZE` 收尾阶段：先生成 raw run artifact，运行 `game-account-skill-optimizer`，再运行 `game-account-skill-evaluator --from-report=<run-artifact>`，根据门禁结果补查、降级、改写推荐或打回重做。

## 标准输入输出

优先接受 `<game_account_request>`，先解析并展示本轮 `selection_profile`。预算和主要目标缺失或互相冲突时只补问关键项；区服、风险等只有会显著改变结果时补问，非关键缺项写入 `assumptions`。画像完整时展示后自动冻结并开始查询，不要求用户在“严格预算/允许突破”之间先做选择；只有关键项缺失或冲突时才暂停等待确认。

最终输出 `<recommendations>`。如果需要评价单个账号，游戏 skill 必须输出 `<game_account_evaluation>`。内部 run artifact 必须包含 `selection_profile`、`profile_confirmation`、`profile_isolation`、`success_criteria`、`coverage_plan`、`coverage_gaps` 和 `knowledge_update_candidates`，方便优化器与评估器复查。

自然语言画像可用：

```bash
node skills/game-account-select/scripts/parse-selection-profile.mjs --request "限定多、1000元左右"
node skills/game-account-select/scripts/create-run-artifact.mjs --game "明日方舟" --user-request "限定多、1000元左右，螃蟹" --json
```

预算、权重、区服偏好、风险容忍度和用户硬条件只属于本轮。不得把它们沉淀为游戏 skill 默认值。

预算只定义本轮“优先搜索区间”，不是隐含的绝对上限。默认先完成主区间和浮动区间筛选；没有硬条件完整项时，自动向更低价和更高价逐档扩展，两侧分别在首个详情复核合格价档停止，同时保留预算附近近似项并解释价格差买到的具体价值。用户明确说“绝不超预算、只看预算内”等严格口径时才关闭扩展。这个策略属于通用查询流程，本轮金额和扩展结果仍不得写入永久知识。

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
4. 每个账号的上架时间 / 平台验号时间
5. 每个账号的推荐理由
6. 每个账号的风险/缺失字段
7. 被排除账号与排除理由
8. 需要用户人工确认的问题
9. 本次规则是否需要更新
```

面向用户的最终答复必须先输出自然语言推荐结论、Top N、风险和人工确认项。`<game_account_evaluation>`、`<recommendations>` 等标签只用于内部契约、调试或用户明确要求结构化输出时展示，不要把原始标签作为主文案直接暴露。

每个主推荐、备选和排除项都要分别展示“上架时间”和“平台验号时间”。前者取标准字段 `published_at`，后者取 `platform_verified_at`；平台未披露时明确写“未披露”。不得把 `extracted_at`、运行开始/结束时间或截图时间冒充其中任一项，也不得把验号时间写成上架时间。

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
- 主推荐、价格浮动备选、风险备选和排除账号，全部保留 URL、价格、上架时间、平台验号时间、分层、降级原因；平台没有公开相应时间时保留 `null` 并在用户文案写“未披露”。
- 启用自动价格扩展时，额外保留带 `expansion_direction: lower|higher` 的 `budget_breakthrough_listings`、`near_match_listings` 和 `budget_comparison`；比较硬条件补齐、实战、养成、资源、皮肤及风险，而不是只比较数量或总分。
- 最终回复草稿是否用了结构化标签、是否包含自然语言结论、风险和人工确认项。
- 用户反馈、规则更新建议和残留问题。
- 目标 skill 的 evaluator 报告；若已有优化产物，还要包含 `score`、`passed`、`redo_required`、`mode`、`optimizer_findings` 和阻塞问题。

自动优化阶段默认只产出优化报告、评估结果、`knowledge_update_candidates` 和用户可读摘要，不静默写入其它 skill。用户明确要求“实现/应用这些优化”时，才按报告修改对应文件并运行验证。

即使用户要求应用优化，也只能沉淀稳定事实和经证据/回归验证的规则。由 `selection_profile` 直接派生的预算、权重、区服或硬条件不得写入 durable references；optimizer 发现这类写入时必须以 `selector-session-preference-leak` 阻塞本轮。

每次筛选的收尾阶段都必须运行：

```bash
node skills/game-account-skill-optimizer/scripts/analyze-run.mjs --input <run-artifact.json> --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs --from-report=<run-artifact.json> --json
```

若 evaluator 对 raw run artifact 输出 `redo_required: true`，必须处理非 info `optimizer_findings`：能补查的回到对应状态补查；不能补查的平台/卖家/登录限制必须降置信并写入最终风险。应用优化后还必须运行目标 skill 的 `game-account-skill-evaluator`；若低于门槛、存在阻塞问题或 `redo_required: true`，本轮产物必须打回重做，不得继续用于真实账号推荐。
