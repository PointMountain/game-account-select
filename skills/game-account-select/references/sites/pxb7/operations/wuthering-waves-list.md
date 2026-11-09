---
site: pxb7
operation: wuthering-waves-list
status: verified
last_verified: 2026-11-09
---

# 鸣潮 列表

> verified：2026-11-09 经 ego-browser 真实页面验证；保留商品编号、元价、来源 URL 与页面身份检查。原始记录位于 ignored 的 `.harness/runs/20261109-skill-acceptance/`。

## 检查点

- 页面域名为 www.pxb7.com，并出现 “鸣潮” 信号；游戏与「鸣潮」一致。
- 入口：https://www.pxb7.com/buy/10302/1?keyword=%E9%B8%A3%E6%BD%AE&searchType=%E8%87%AA%E7%84%B6%E6%90%9C%E7%B4%A2

## 成功标准

manifest 声明：returns unique listing ids, CNY prices, game-specific titles and source URLs。2026-11-09 已实测通过；后续复用仍核对当前页面与检查点。

## 边界

不购买、不联系、不改账户。验证码、风控、权限不足或用户接管时停止；未知字段保持 null。
