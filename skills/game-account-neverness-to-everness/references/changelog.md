# Neverness to Everness（异环）skill changelog

## 2026-08-30

- 经真实 PZDS `goodsList/1546` 列表与 `YED48X` 详情回归，发布 verified `pzds/neverness-to-everness-list/detail`，并跑通实时找号、估值、finalizer、质量门禁和清理审计。
- 新增可复用 `evaluate-listing.mjs`、确定性 `finalize-evaluation-run.mjs`、run artifact fixture 与 finalizer 回归，形成可独立复测的估值和交付接口。
- 接入统一 `request_provenance`、run-only `selection_profile`、coverage/experience/knowledge candidates、optimizer/evaluator sidecar、delivery hash 与 redo gate。
- 平台能力按 support matrix fail closed；PZDS 已验证，PXB7 未验证时只记录覆盖缺口，不切换到其他网页软件。

## 2026-05-16

- 增加 `community-evidence.md` 和 `asset-knowledge.md`，明确异环早期市场下必须命名 S 角色、S 弧盘、觉醒、资源和账号类型。
- 将估值规则扩展为可执行评分框架，并加入 TAP/完美/B服、主角、找回包赔和缺失字段扣分。
- 新增本地验证样例，确保命名 S 资产 + 适配弧盘 + 资源 + 低风险账号排在泛称 S 数量账号之前。

## 2026-05-05

- 初始化Neverness to Everness（异环）账号估值 skill。
- 建立 S 角色、S 弧盘、觉醒、资源和账号类型风险的基础评分方向。
