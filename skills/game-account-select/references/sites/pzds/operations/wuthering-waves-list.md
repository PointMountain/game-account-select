---
site: pzds
operation: wuthering-waves-list
status: verified
last_verified: 2026-11-09
---

# 鸣潮 列表

> verified：2026-11-09 经 ego-browser 真实页面验证；保留商品编号、元价、来源 URL 与页面身份检查。原始记录位于 ignored 的 `.harness/runs/20261109-skill-acceptance/`。

## 检查点

- 页面域名为 www.pzds.com，并出现 “鸣潮” 信号；游戏与「鸣潮」一致。
- 入口：https://www.pzds.com/goodsList/303

## 成功标准

manifest 声明：returns unique live Wuthering Waves listing ids, prices, source URLs, and list facts。2026-11-09 已实测通过；后续复用仍核对当前页面与检查点。

## 边界

不购买、不联系、不改账户。验证码、风控、权限不足或用户接管时停止；未知字段保持 null。

## 已验证的读取限制

游戏名称可能位于语义摘要的 4000 字边界之后。页面身份与验证拦截信号须从当前可见正文提取，不能只检查截断摘要；修复后本 operation 返回3条带唯一编号、价格与链接的商品。
