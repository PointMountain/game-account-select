# 游戏账号 skill 生成流程

updated_at: 2026-05-16

## 流程

1. 读取 `<skill_generation_request>` 或 CLI 参数。
2. 规范化游戏名和 slug。
   - 英文或含英文别名时使用可读 slug。
   - 纯中文/非 ASCII 游戏名且用户未提供 `--slug` 时，生成稳定 `game-<hash>` slug，避免多个游戏都落到 `new-game`。
3. 复制 `game-account-toolkit/templates/game-skill/`。
4. 替换模板变量：
   - `{{game_name}}`
   - `{{title_name}}`
   - `{{slug}}`
   - `{{date}}`
5. 重命名验证样例为 `<slug>-validation-sample.json`。
6. 运行生成后的 `scripts/validate-sample.mjs`。
7. 输出生成报告。

## 保守默认

生成器不能假装完成社区研究。默认：

- `community_confidence: low`
- 社区来源全部 `not_checked`
- 只有命名核心资产、资源和风险字段能给稳定分。
- 总数量、高等级、极品号宣传词均视为陷阱。

## 后续门槛

生成后应运行：

- `game-account-community-updater` 刷新社区证据。
- `game-account-skill-evaluator` 判断是否达到使用标准。
