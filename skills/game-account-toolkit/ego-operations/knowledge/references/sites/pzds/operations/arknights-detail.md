---
site: pzds
operation: arknights-detail
last_verified: 2026-10-05
---

## 检查点

- URL 为 www.pzds.com/goodsDetails/<商品编号>/6；页面与返回商品编号一致。
- 读取公开商品数据与资产网格；记录 metadata_resource 和 dom_asset_grid 来源，保留验证图片链接。
- 详情的精二六星数量不能覆盖标题的精二总数；未展示专精、模组、验号日期时保持未知。

## 成功标准

2026-10-05 实测商品编号、价格、六星、具名资产卡片和验号图；精二总数与精二六星存在不同值，已分别保存。原始证据见当次 .harness/arknights-evidence-learning/，修复后的总数口径由新增回归和后续真实详情共同验证。

## 边界

一张图只证明对应账号和区域内可读事实。OCR识别不清时保留待核实，不能把另一个账号或相邻干员的标记借过来。
