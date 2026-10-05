---
site: pxb7
operation: arknights-list
last_verified: 2026-10-05
---

## 检查点

- 页面为 www.pxb7.com 的明日方舟列表，游戏 ID 为 10053。
- 仅在页面内读取既有搜索接口，gameId 与返回行一致；价格从分转换为元。
- 保留商品编号、价格、官服/B服和详情链接；卖家标题的数量不等同于已核实的逐人名单。

## 成功标准

同一 task space 返回非空的唯一商品行。2026-10-05 实测10行，原始记录留在当次 .harness/arknights-evidence-learning/pxb-list.json；商品会变价或下架，后续仍做当前页面复验。

## 边界

不购买、不联系、不改账户。验证码、权限不足、用户接管时停止。默认完成后精确清理；父任务继续时 keep。
