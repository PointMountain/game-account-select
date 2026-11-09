# 盼之（pzds）

site: pzds · 域名 www.pzds.com · 别名：盼之、盼之代售、pzds

## 共享事实

- 列表入口：明日方舟 `/goodsList/84/6/headerSearch?...`（84 是游戏 ID，6 是目录段）、绝区零 `/goodsList/275`、鸣潮 `/goodsList/303`、异环 `/goodsList/1546`。
- 详情 URL 是 `goodsDetails/<编号>/6`，末尾的 `/6` 是目录段，不能反推列表游戏 ID（误用 `goodsList/6` 会读到别的游戏）。
- 列表在同一页面内累积读取，不为后续批次重新导航。`loadMore` 遇到 429 或频率限制时，保留已读的行并标记 partial，同一路径不连续重试。
- `onStandTime` 对应 `published_at`，`verifyTime` 对应 `platform_verified_at`。`verifyTime` 为空时显示“未披露”，即使 `shotTypeName` 显示官方验号，也不能反推验号时间。
- 页面可见正文的前 4000 字可能没有游戏名。页面身份和拦截信号要从可见正文提取，不能只看截断摘要（2026-11-09 已修复）。
- 健康检查：`/gameList` 能打开，正文含“欢迎来到盼之代售/盼之账号”和“请选择要购买的游戏”，并且没有验证/滑块/频率提示。不健康时不清 cookie，改为请用户提供截图。
- 边界：不购买、不联系卖家、不改账户；遇到验证码、风控或用户接管立即停止。

## Operations

每个游戏的列表/详情各对应一个 operation，状态以文件 frontmatter 为准。runner 对 `status: documented` 会 fail closed。

- [arknights-detail](operations/arknights-detail.md)
- [arknights-list](operations/arknights-list.md)
- [neverness-to-everness-detail](operations/neverness-to-everness-detail.md)
- [neverness-to-everness-list](operations/neverness-to-everness-list.md)
- [wuthering-waves-detail](operations/wuthering-waves-detail.md)
- [wuthering-waves-list](operations/wuthering-waves-list.md)
- [zzz-detail](operations/zzz-detail.md)
- [zzz-list](operations/zzz-list.md)
