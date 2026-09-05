# 需求与交付细则

## 标准输入输出

优先接受 `<game_account_request>`，先解析并展示本轮 `selection_profile`。预算和主要目标缺失或用户明确表示尚未决定主目标时只补问关键项；“限定齐全、练度够且资源能抽下一池”这类并列要求是完整的 `custom` 复合画像，不是冲突，不得要求用户删减目标或先选择固定抽数。区服、风险等只有会显著改变结果时补问，非关键缺项写入 `assumptions`。画像完整时展示后自动冻结并开始查询，不要求用户在“严格预算/允许突破”之间先做选择；只有关键项缺失或真实冲突时才暂停等待确认。

最终输出 `<recommendations>`。如果需要评价单个账号，游戏 skill 必须输出 `<game_account_evaluation>`。内部 run artifact 必须包含 `request_provenance`、`selection_profile`、`profile_confirmation`、`profile_isolation`、`success_criteria`、`coverage_plan`、`coverage_gaps` 和 `knowledge_update_candidates`，方便优化器与评估器复查。`user_request` 永远保留用户原话；推导出的资源阈值或标准化画像只能写入 `request_provenance.profile_input` 与冻结画像，不得覆盖原话。

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

平台顺序以 `game-account-toolkit/references/platform-priority.json` 为准，实际可执行能力以 `operation-support-matrix.json` 为准。优先级不等于支持声明：某个 game/platform/list-or-detail 标为 `unsupported` 时，只记录覆盖缺口，不得切换其它浏览器实现。只有 `ego-ops` 受控探索通过 `ego-browser` 实证并回写 operation 后，才能升级为 `verified`。

用户没有指定平台时，按以下顺序规划候选来源；执行时逐项受支持矩阵约束：

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
