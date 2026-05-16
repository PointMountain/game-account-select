# Game Account Select

游戏账号智能筛选/估值助手的产品与 Claude Code skill 草案。

## 当前内容

- `docs/product/game-account-selection-assistant.md`：产品定位、MVP 范围、数据策略、评分框架和架构选择。
- `skills/game-account-toolkit/`：通用工具 skill，负责依赖检查、平台访问策略、通用 schema。
- `skills/game-account-select/`：主筛选编排 skill。
- `skills/game-account-wuthering-waves/`：Wuthering Waves（鸣潮）账号估值 skill。
- `skills/game-account-arknights/`：明日方舟账号估值 skill。
- `skills/game-account-neverness-to-everness/`：Neverness to Everness（异环）账号估值 skill。
- `skills/game-account-zenless-zone-zero/`：Zenless Zone Zero（绝区零 / ZZZ）账号估值 skill。

## 推荐执行链路

```text
用户需求
  -> game-account-select
  -> game-account-toolkit
  -> 对应游戏 skill
  -> 推荐列表 + 风险解释 + 规则更新建议
```

## 使用前检查

```bash
node skills/game-account-toolkit/scripts/check-deps.mjs
```

如果需要访问动态页面或登录态页面，应加载并遵循本地 `web-access` skill。

## 游戏规则验证

每个重点游戏 skill 都带有本地回归样例，用于验证排序不会被“总数量/泛称高稀有度”误导：

```bash
node skills/game-account-arknights/scripts/validate-sample.mjs
node skills/game-account-neverness-to-everness/scripts/validate-sample.mjs
node skills/game-account-wuthering-waves/scripts/validate-sample.mjs
node skills/game-account-zenless-zone-zero/scripts/validate-sample.mjs
```

## 设计原则

- 不做交易撮合。
- 不做全站高频抓取。
- 不绕过验证码、登录限制或平台风控。
- 不静默安装全局工具。
- 不静默修改 skill 规则。
- 不同游戏独立维护估值规则。
- 用户反馈先转成规则更新建议，确认后再写入对应 skill。
