# 交易网站

按 site 路由，只读取本轮站点 index 和对应的 `<game>-list` / `<game>-detail`。平台顺序见 [platform-priority.json](../platform-priority.json)，可执行的 operation 见 [operations.json](../operations.json)。

- [pxb7](pxb7/index.md) — 螃蟹
- [pzds](pzds/index.md) — 盼之

尚未接入：交易猫、淘手游、闲鱼。新增站点按 [add-site](../workflow.md#新增游戏或站点) 的步骤处理。闲鱼常见登录推荐页、空卡片和验证码，遇到就快速降级。
