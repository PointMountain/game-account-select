# 筛选状态机

## START

输入用户需求。如果缺少游戏或预算，先询问最少必要信息：

- 游戏
- 预算范围
- 核心偏好：强度、资源、收藏、低风险、性价比

## LOAD_TOOLKIT

先调用 `game-account-preflight`：

1. 运行环境校验。
2. 若缺少必需工具，停止并输出安装/授权指引。
3. 若缺少可选工具，继续但记录能力限制。

再调用 `game-account-toolkit`：

1. 检查依赖。
2. 读取平台访问策略。
3. 确认可用能力：WebFetch、浏览器 CDP、OCR、样本库。

输出：

```yaml
capabilities:
  browser_cdp: boolean
  web_fetch: boolean
  ocr: boolean
limitations: string[]
```

## SELECT_GAME_SKILL

根据游戏选择专属 skill：

- Wuthering Waves（鸣潮）：`game-account-wuthering-waves`
- 明日方舟：`game-account-arknights`
- Neverness to Everness（异环）：`game-account-neverness-to-everness`
- Zenless Zone Zero（绝区零 / ZZZ）：`game-account-zenless-zone-zero`

若游戏未支持，不要套用其它游戏规则。进入 `GENERATE_GAME_SKILL`。

## GENERATE_GAME_SKILL

调用 `game-account-skill-generator`：

1. 根据用户输入的游戏名、别名和已知证据生成 `skills/game-account-<slug>/`。
2. 运行生成后的验证脚本。
3. 调用 `game-account-skill-evaluator` 判断是否达到使用标准。
4. 若未通过，只输出生成报告、阻塞问题和社区刷新建议；不要用低质量 skill 真实推荐。

输出：

```xml
<skill_generation_report>...</skill_generation_report>
<skill_quality_report>...</skill_quality_report>
```

## BUILD_QUERY

将用户需求转成硬筛和软评分条件。

硬筛例子：

- 预算范围
- 区服/渠道
- 未绑定 TAP/Wegame
- 找回包赔
- 官方验号

软评分例子：

- 强度开荒
- 抽卡资源
- 限定/稀有资产
- 价格优势
- 数据完整度

## COLLECT_LISTINGS

按保守访问策略获取候选账号：

1. 优先用户提供的链接、截图、复制文本或指定平台。
2. 用户没有指定平台时，按 `game-account-toolkit/references/platform-priority.json` 的 `default_order` 低频尝试：螃蟹账号代售、盼之代售、交易猫、淘手游；闲鱼只作为补充来源。
3. 每个平台最多做少量用户意图明确的列表页/搜索页读取。不要全站扫描。
4. 对每个平台记录：查询词、开始/结束时间、耗时、结果数、失败文本、是否进入详情页。
5. 平台页面不可读时，请用户提供截图/链接/复制文本。
6. 记录数据来源和限制，不要声称覆盖了未成功读取的平台。

不要全站扫描或高频翻页。

## NORMALIZE_LISTINGS

用 `game-account-toolkit/references/shared-listing-schema.md` 标准化字段。

缺失字段保留为空，不要猜测。

## COLLECT_COMMUNITY_EVIDENCE

读取 `game-account-toolkit/references/community-research-protocol.md`，为当前游戏和版本建立证据快照，或读取游戏 skill 中最近一次仍可用的证据快照。

当快照过期、覆盖不足、或用户要求刷新时，调用 `game-account-community-updater`，把当次调研结果写成 `<community_refresh_report>`。

输入：

- 游戏与版本上下文
- 用户偏好：强度、资源、收藏、低风险、性价比
- 待比较账号中出现的角色、命座、武器、资源和绑定风险

输出：

```yaml
community_evidence:
  version_context: string
  updated_at: YYYY-MM-DD
  community_confidence: low|medium|high
  source_coverage: object
  high_value_assets: string[]
  medium_value_assets: string[]
  low_value_or_trap_assets: string[]
  key_teams: string[]
  limitations: string[]
```

要求：

- 优先用 B站长视频/字幕/评论、小红书图文/评论、抖音话题或视频信号；平台不可用时记录失败原因并使用降级来源。
- 不得因为单条视频标题、短帖或评论就显著提高账号排名。
- 如果当前证据过期、冲突或覆盖不足，继续筛选时必须降低置信度并列出人工确认项。

## SCORE_WITH_GAME_SKILL

把标准化挂牌和 `community_evidence` 一起传给游戏专属 skill，获取：

- 游戏资产评分
- 资源评分
- 风险扣分
- 版本强度解释
- 排除理由

## RANK_AND_EXPLAIN

合并平台风险、价格、游戏资产分，输出 Top N。

每个入选账号必须包含：

- 价格
- 核心资产
- 为什么适合用户偏好
- 风险和缺失信息
- 是否需要人工二次确认

用户可见答复必须是自然语言推荐和清单，不要把 `<game_account_evaluation>` 或 `<recommendations>` 原始标签作为主文案输出。机器可读标签可在内部日志或用户明确要求结构化输出时附在后面。

## FEEDBACK_LOOP

询问或接收用户反馈：

- 推荐是否准确
- 哪个账号被高估/低估
- 原因是什么

如果反馈揭示规则问题，进入 `PROPOSE_RULE_UPDATE`。

## POST_RUN_OPTIMIZE

筛选完成后，调用 `game-account-skill-optimizer` 分析本次执行摘要。

输入：

- `game`
- `target_skill`
- `user_request`
- `platform_attempts`
- `recommendations`
- `excluded_listings`
- `final_response`
- `missing_fields`
- `rule_update_suggestions`
- `user_feedback`

输出：

```xml
<skill_optimization_report>...</skill_optimization_report>
```

处理规则：

- 默认只报告优化建议，不自动改文件。
- 如果报告指出平台耗时或空结果，下次同平台应使用更短等待预算并更快降级。
- 如果报告指出平台覆盖缺口，下次筛选应先纳入缺失平台或明确说明不可读。
- 如果报告指出输出格式问题，下次用户可见答复必须先给自然语言摘要。
- 如果报告指出估值规则问题，进入 `PROPOSE_RULE_UPDATE` 或在用户明确要求实现优化时修改对应 skill 并验证。

## PROPOSE_RULE_UPDATE

输出拟更新的文件、规则和原因。只有用户确认后才修改 skill 文件。

## END

总结本次查询限制、保留的待验证平台/规则问题，以及下一次如何改进。
