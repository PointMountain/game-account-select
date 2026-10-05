# 绝区零、鸣潮与异环：当前证据核验

三款游戏共享核验与收尾机制，角色、装备及历史评分仍由各游戏 skill 负责。明日方舟使用自己的 [当前证据流程](../../game-account-arknights/references/current-evidence-workflow.md)。

## 先取证，再确认推荐

1. 在本轮 `selection_profile` 保存用户原话、`version_context` 和 `play_contexts`，保持 `persistence_scope: run_only`。先核实实际版本；未知版本不能填最新。玩法可为 `story`（主线日常）、`high_difficulty`（高难）、`roguelike`（用户实际指定的肉鸽模式）；没有该玩法证据就保留缺口。
2. 默认25分钟左右交付，社区最多8分钟。先根据账号命名资产生成任务；缺角色时带名字定向查。搜索卡片只作入口，正文、字幕或清晰图表才可作为依据。动态页面经 ego-ops / ego-browser，在同一 task space 中读取；时间耗尽交付待核实项。

   ```bash
   node skills/game-account-toolkit/scripts/plan-community-refresh.mjs --game wuthering-waves --input .harness/run.json --out .harness/refresh-plan.json
   ```

3. 每个游戏的 `references/community-evidence.json` 是可执行证据，Markdown 保留可审阅来源。不要通过改 `updated_at` 刷新旧结论；主张和两位独立作者的原始发布日期均须在7天内，版本、玩法一致且无冲突。官方机制、获取方式与社区强度判断分开记录。未完成取证时保留空 `claims`，不得生成虚假的最新榜单。

`team_recommendation` 主张示例（这里只说明结构，不是游戏结论）：

```json
{
  "id": "team-example",
  "kind": "team_recommendation",
  "subject": "队伍名称",
  "status": "supported",
  "version_context": "本轮核实版本",
  "as_of": "已核实主张的时间",
  "contexts": ["high_difficulty"],
  "source_ids": ["independent-author-a", "independent-author-b"],
  "members": ["核心的标准化名称", "队友的标准化名称"],
  "equipment": ["适用结论要求的装备名称"],
  "requirements": [{"member": "核心的标准化名称", "field": "resonance_chain", "minimum": 2}]
}
```

绝区零使用 `mindscape`，鸣潮使用 `resonance_chain`，异环使用 `awakening`。每款游戏的 JSON `game` 必须是 skill slug（如 `wuthering-waves`）。来源结构及更新命令见 [社区更新流程](../../game-account-community-updater/references/update-workflow.md)。当前接口核验队伍适用性；历史数值仍标记 `historical_baseline`，不是动态版本强度榜。修改数值规则另走来源审查、三类画像前后对比和学习凭据。

## 核对账号事实

用 `field_evidence` 保存 `field`、`value`、`listing_id`、`source_url`、`observed_at`、`method` 和原文或 `source_field/source_value`。字段路径对应原始标准化挂牌，例如 `game_assets.characters.0.resonance_chain`；先看 evaluator 输出的 `recommendation_gate.field_checks` 补证。缺失影画/共鸣链/觉醒保持 null，不把未披露当零。资产、价格、区服、正向计分资源与绑定风险都保留出处。

可用方法为 `platform_detail`、`platform_asset_grid`、`image_review`、`ocr_confirmed`。仅卖家自述用 `seller_claim`，不能通过核验。图片证据还需本账号已观察图片 URL、SHA256 和 `[left,top,width,height]` 归一化区域；OCR 需人工或 Agent 视觉确认。错账号、错 URL、超过24小时或矛盾值都不能通过。已披露但不满足硬条件也不能进入主推荐；暂不支持的硬条件保留待核实，不自动忽略。

```bash
node skills/game-account-wuthering-waves/scripts/evaluate-listing.mjs --input .harness/listing.json --profile .harness/profile.json --evidence .harness/community-evidence.json --out .harness/evaluation.json
```

`source_listing` 保留可追溯的输入；不要只留下分数。真实 run 必须有 `run_id`、当前 `selection_profile`、`evaluations`、原始请求与覆盖记录，可用 `community_evidence` 携带本轮快照。finalizer 每次重算核验状态，忽略缓存的 eligible。通过者进入 `recommendations`，其他完整保留在 `pending_verification` 和报告中。待核实不是抓取失败，也不等于可直接购买。

## 交付后改进

真实 run 的 finalizer 自动 collect 并输出相邻 `.repair-plan.json`。负责本轮的 Agent 交付后按既有授权在当前会话执行，遵循 [学习闭环](../../game-account-skill-optimizer/references/learning-loop.md)。清单不启动后台模型。保护旧测试，新增正反例、验证、登记 applied；来源不足则延期。用户预算与偏好仅保存在本轮产物中。
