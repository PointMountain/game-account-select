---
name: game-account-arknights
description: 明日方舟账号的通用动态估值与筛选能力。把限定/联动稀缺度、当前实战、养成、抽卡资源、皮肤、价格效率和风险拆成独立基础维度，再按本轮用户画像动态排序；预算、区服和收藏/战力偏好不会写成永久默认值。
---

# Game Account Arknights Skill

## 作用与边界

本 skill 负责明日方舟资产事实标准化、基础维度评分和基于本轮 `selection_profile` 的动态排序，不负责平台访问，也不替用户购买或联系卖家。

永久知识只保存稳定事实和彼此独立的评价维度。预算、目标、权重、区服偏好、风险容忍度和硬性条件只能存在于当次 run artifact；不得把“1000 元、限定优先、官服”等会话条件写回本文件或 references 作为默认规则。

## 按需读取

评分与组装 `<game_account_evaluation>` 前读 [估值输出契约](references/evaluation-contract.md)；应用改进时读 [学习闭环](../game-account-skill-optimizer/references/learning-loop.md)，applied 需当前验证凭据。

- `../game-account-toolkit/references/skill-io-contract.md`
- 新增/修改规则时读 [game-skill-standard](../game-account-toolkit/references/game-skill-standard.md)。
- `references/valuation-rules.md`
- `references/operator-knowledge.md`
- `references/operator-value-map.json`
- `references/collab-roster.json`
- `references/community-evidence.md`
- 修改规则或追溯决策时读 [changelog](references/changelog.md)。

## 执行流程

1. 调用 `game-account-preflight` 并展示 `<preflight_report>`；后台执行时使用 `--unattended`。平台访问冻结为 `ego_browser`，同一筛选复用一个 task space，并按语义、直接数据、视觉复核的顺序读取。
2. 用 `../game-account-select/scripts/parse-selection-profile.mjs` 解析自然语言。
3. 预算或主要目标缺失、或用户明确表示尚未决定哪个目标优先时只补问关键项；收藏、战力、养成和资源并列出现时自动形成 `custom` 复合画像，不得强迫用户删减条件或先选择固定抽数。其余缺项用中性假设并写入 `assumptions`。
4. 查询前向用户展示画像。预算和目标完整时自动记录 `profile_confirmation` 和 digest，冻结为 run-only artifact 后继续，不要求用户先选择预算策略。
   - 只有用户明确未决定主目标产生的 `objective_conflict`，或预算/目标真正缺失时才停止补问；`--profile-confirmed` 仅用于消解已经展示并由用户确认的真实冲突。
5. 主动找号必须通过 ego-ops 同时运行螃蟹与盼之的明日方舟列表/详情 operation，并由 ego-browser 在当前页面复验。两边分别形成可见清单；某边没有完全符合项时仍要显示该平台的近似项或明确覆盖缺口，禁止把单平台结果写成完成态。
6. 平台 operation 只读取价格、区服、资产、资源、挂牌/验号时间和风险事实；不得在查询层决定账号是否值得买。
7. 用 `scripts/score-listings.mjs` 计算独立基础维度，再按冻结画像做跨平台统一排序；总榜可以选出任意平台的性价比第一，但不能吞掉另一平台清单。
8. 输出候选、风险、缺失字段、证据覆盖和人工验号项。
9. 默认先查本轮预算主区间和浮动区间；没有硬条件完整项时，两平台自动向更低价和更高价逐档扩展，各自在首个精确满足价档停止。只有用户明确要求严格预算才禁用；同时保留预算附近近似项，按收藏补齐与推图提升分别解释差价。
10. 用户给出明确资源数值时，将它冻结为本轮硬条件而不只是提高资源权重。例如“合成玉 10 万左右”解析为 `orundum:80000-120000`，“合成玉 10 万以上”解析为 `orundum:100000+`；未满足者只能进入近似候选并标明缺口。
11. 平台文本缺少低练度联动干员、但详情提供公开验号图时，调用 `scripts/verify-collab-images.mjs` 对干员页 OCR 复核；图中未找到仍只能记为未确认，不能把文本缺失直接等同于账号缺失。
12. 每个平台默认详情复核 10 个、表格展示 10 个；完全符合项不足时用明确标注的接近项或列表待复核项补足比较视野。候选确实不足 10 个时展示全部并说明覆盖缺口，不得把 artifact 中已有候选手工删成 1–2 个。
13. 数据采集结束必须由 `scripts/finalize-selection-run.mjs` 收尾：先用 `scripts/render-selection-report.mjs` 生成“预算内完整满足数量 → 预算内接近项 → 预算外完整满足项 → 双平台候选”的 Markdown 表格，再运行 optimizer 和 raw-artifact evaluator，并把 `request_provenance`、`self_improve`、`presentation`、`quality_gate`、`delivery_contract`、完整 `final_response` 和 sidecar 报告落盘。最终答复逐字使用 `final_response`，禁止绕过收尾器手写另一份推荐。
14. 任何非 info optimizer finding 或 evaluator `redo_required` 都要继续修复/降级，不得口头声称“已总结经验”后仍把坏结果当完成态。
15. “不要陈年老号/断代仓库号”等账号级描述进入 `soft_preferences.account_recency` 和付款前人工复核，不得进入干员 `exclusions`；干员排除只允许精确名或至少两个字符的稳定别名匹配，禁止单字干员名反向命中整句描述。
16. PZDS 多批列表需求合并成一次 `single_accumulating_scan`，在同一浏览器页面内低频加载并记录 `list_attempts`；不得为第 2/3 批从头重复导航和扫描。PXB7 保留轻量分页请求。

## Self-improve 边界

每次执行都输出：

- 本轮有效/无效的解析和平台字段。
- 覆盖缺口与详情缺失字段。
- `knowledge_update_candidates` 及证据、目标文件、验证命令。
- `self_improve`：`summary_generated`、optimizer/evaluator 报告路径、质量状态、知识候选总数/本轮已应用数/已有机制复核数/待验证数。

只有 `apply_status: applied` 且验证通过的稳定流程/字段修复才写“本轮已应用”。`verified_existing` 只表示复核了运行前已存在的机制，不能算本轮代码优化；`proposed` / `deferred` 必须显示为待验证。跨画像恢复候选时还必须提供 `canonical_rescore` 证据、匹配的新画像 digest 和完整重评分商品 ID，否则 optimizer 必须输出 `selection-reconciliation-unvalidated` 并打回。

允许自动沉淀：平台字段、解析别名、干员别名、脱敏 fixture、证据日期和稳定客观事实。估值变化只能作为候选，满足社区证据门槛且通过回归/evaluator 后再更新。禁止自动沉淀本轮预算、权重、区服偏好、风险容忍度和用户硬条件。
