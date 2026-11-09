---
game: neverness-to-everness
label: 异环
aliases: [异环, Neverness to Everness, NTE]
updated_at: 2026-11-09
---

# 异环

筛选数据：[game.json](game.json)（S 角色/弧盘数量、觉醒、环石等字段，以及绑定风险词）。社区证据：[evidence.md](evidence.md)（2026-05-16 的历史基线，没有具体强度榜）。

## 看什么

- S 角色要具名并符合用户目标；S 弧盘要具名，并且套装/属性能适配已有的 S 角色。
- 看关键觉醒节点和核心角色练度；资源看环石、异晶、质实骰子、三重钥匙。
- 主角性别、账号类型（TAP/完美账号/B服）、区服是否符合用户偏好。

## 常见坑

- 只写 S 总数、金数或猎人等级、不列名称的号不能排第一。目前 `game.json` 只能读数量，所以具名资产仍要在详情页人工核对。
- 验号报告里的“S级武器”卡片对应弧盘；缺少养成数值时保持未知。
- 角色和弧盘强度没有当前证据前，不能按高价值处理。

## Operations

- [refresh-evidence](operations/refresh-evidence.md)：建立首份当前强度与弧盘适配证据。
