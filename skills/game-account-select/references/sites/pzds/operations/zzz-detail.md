---
site: pzds
operation: zzz-detail
status: verified
last_verified: 2026-11-09
---

# 绝区零 详情

> verified：2026-11-09 经 ego-browser 真实页面验证；保留商品编号、元价、来源 URL 与页面身份检查。原始记录位于 ignored 的 `.harness/runs/20261109-skill-acceptance/`。

## 检查点

- 页面域名为 www.pzds.com，并出现 “绝区零”、“账号” 信号；游戏与「绝区零」一致。
- 详情返回的商品编号必须与输入一致，只读取主体商品，排除推荐区。
- 同 PXB7：保存 `agentStatuses` 与 `sWEngineNames`，单数字角标交 ZZZ skill 以专武表交叉核对。

## 成功标准

manifest 声明：returns one matching listing with price, binding state, named assets, and source URL。2026-11-09 已实测通过；后续复用仍核对当前页面与检查点。

## 边界

不购买、不联系、不改账户。验证码、风控、权限不足或用户接管时停止；未知字段保持 null。

## 已验证的字段口径

加密母带可使用数值在前的写法；S级代理人、音擎、邦布总数可使用标签在前的写法。按字段边界解析，相邻无关数字不能充当缺失资源。资源数量本身不证明当前队伍价值。
