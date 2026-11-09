---
site: pzds
operation: neverness-to-everness-list
status: verified
last_verified: 2026-11-09
---

# 异环 列表

> verified：2026-11-09 经 ego-browser 真实页面验证；保留商品编号、元价、来源 URL 与页面身份检查。原始记录位于 ignored 的 `.harness/runs/20261109-skill-acceptance/`。

## 检查点

- 页面域名为 www.pzds.com，并出现 “异环” 信号；游戏与「异环」一致。
- 入口：https://www.pzds.com/goodsList/1546

## 成功标准

manifest 声明：returns unique live Neverness to Everness listing ids, prices, source URLs, and list facts。2026-11-09 已实测通过；后续复用仍核对当前页面与检查点。

## 边界

不购买、不联系、不改账户。验证码、风控、权限不足或用户接管时停止；未知字段保持 null。
