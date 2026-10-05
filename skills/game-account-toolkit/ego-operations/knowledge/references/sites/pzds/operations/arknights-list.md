---
site: pzds
operation: arknights-list
last_verified: 2026-10-05
---

## 检查点

- 页面是 www.pzds.com 明日方舟列表，返回编号与详情链接一致。
- 在同一页面累积读取，不为后续批次重头导航；分页失败保留自然页面已读行并标 partial。
- 精二总数和精二六星分开；时装名称截断到下一个资源字段，名称中的双斜线保留。

## 成功标准

2026-10-05 实测5行，保留元价、区服、挂牌时间与详情链接。原始证据见当次 .harness/arknights-evidence-learning/browser-probe.json。

## 边界

验证码或风控时停止，不更换通道绕过。列表标题只用于候选发现，详情前不将数量升级为完整名单。
