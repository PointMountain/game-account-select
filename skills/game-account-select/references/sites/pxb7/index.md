# 螃蟹（pxb7）

site: pxb7 · 域名 www.pxb7.com · 别名：螃蟹、螃蟹账号、pxb7

## 共享事实

- 列表入口是 `/buy/<游戏ID>/1?keyword=<游戏名>&searchType=自然搜索`。游戏 ID：明日方舟 10053、绝区零 10312、鸣潮 10302、异环 10630。
- 列表在页面内请求已有的搜索接口（`api-pc.pxb7.com .../selectSearchPageList`），接口里的价格单位是分，输出时换算成元。
- 详情 URL 是 `product/<数字 product ID>/1`，数字 ID 是主键；标题里的展示编号另存为 `productCode`。
- 详情页要等标题和价格出现后再读，读得太早会失败。只提取“商品推荐”之前的主体区，推荐区的商品不能混进本商品的资产。
- “官方验号”标签只是平台声明，不等于交易风险已消除，也不能代替对字段的复核。验号时间存为 `platform_verified_at`，不能拿采集时间代替。
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
