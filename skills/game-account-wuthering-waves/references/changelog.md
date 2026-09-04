# Wuthering Waves（鸣潮）skill changelog

## 2026-08-30

- 经真实 PZDS `goodsList/303` 列表与 `MCHYH0` 详情回归，发布 verified `pzds/wuthering-waves-list/detail`，并跑通实时找号、估值、finalizer、质量门禁和清理审计。
- 新增可复用 `evaluate-listing.mjs`、确定性 `finalize-evaluation-run.mjs`、run artifact fixture 与 finalizer 回归，不再把样例验证器当作唯一评分入口。
- 接入统一 `request_provenance`、run-only `selection_profile`、coverage/experience/knowledge candidates、optimizer/evaluator sidecar、delivery hash 与 redo gate。
- 平台能力按 support matrix fail closed；PZDS 已验证，PXB7 未验证时不切换到其他网页软件，也不伪装成已覆盖。

## 2026-05-17

- 增加热门配队/队伍原型评分，明确爱莫林、卡千夏、日月守、奥尤、绯雪队等标签应影响买号排序。
- 强化主 C 专武适配规则：命座、专武数量和队伍完整度必须合并判断，不能只看高命或五星武器总数。
- 增加 77175988 真实筛选样本和“完整队伍优于孤立高链”验证目标。

## 2026-05-16

- 加入社区证据快照 `community-evidence.md`，记录 3.3 版本上下文、B站/抖音/小红书覆盖情况、英文攻略站补充来源和局限。
- 将估值规则从原则扩展为可执行评分框架：限定核心、队伍完整度、专武/命座、资源、价格、风险和数据缺失扣分。
- 补充角色知识分层，明确当前高价值限定、中价值资产、常驻/弱势高命陷阱和关键队伍方向。
- 强化推荐解释要求：必须说明账号资产与社区证据快照的一致性，并标注人工确认项。

## 2026-05-05

- 初始化Wuthering Waves（鸣潮）账号估值 skill。
- 加入用户反馈规则：常驻/弱势角色高命低权重，不能用总黄数或五星数量高估账号。
