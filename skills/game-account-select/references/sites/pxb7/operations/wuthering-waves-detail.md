---
site: pxb7
operation: wuthering-waves-detail
status: verified
last_verified: 2026-11-09
---

# 鸣潮 详情

> verified：2026-11-09 经 ego-browser 真实页面验证；保留商品编号、元价、来源 URL 与页面身份检查。原始记录位于 ignored 的 `.harness/runs/20261109-skill-acceptance/`。

## 检查点

- 页面域名为 www.pxb7.com，并出现 “鸣潮”、“商品” 信号；游戏与「鸣潮」一致。
- 详情返回的商品编号必须与输入一致，只读取主体商品，排除推荐区。

## 成功标准

manifest 声明：returns one matching numeric product id, CNY price, subject-only named assets, risk facts and source URL。2026-11-09 已实测通过；后续复用仍核对当前页面与检查点。

## 边界

不购买、不联系、不改账户。验证码、风控、权限不足或用户接管时停止；未知字段保持 null。
