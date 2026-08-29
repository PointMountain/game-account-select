# 游戏账号 skill 生成流程

updated_at: 2026-08-30

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
5. 重命名估值样例与 run artifact 为 `<slug>-validation-sample.json`、`<slug>-run-artifact.json`。
6. 运行生成后的 `scripts/validate-sample.mjs` 和 `game-account-skill-evaluator`。
7. 输出目录含 toolkit 时运行 `scripts/validate-finalizer.mjs`；外部暂存目录明确标记为待安装后验证。
8. 输出生成报告。

## 保守默认

生成器不能假装完成社区研究。默认：

- `community_confidence: low`
- 社区来源全部 `not_checked`
- 只有命名核心资产、资源和风险字段能给稳定分。
- 总数量、高等级、极品号宣传词均视为陷阱。
- 平台 list/detail capability 全部默认为 unsupported；只有 `ego-ops` + `ego-browser` 实证后才能写入 support matrix。
- 新 skill 必须生成 fixture-independent evaluator、raw-artifact finalizer、确定性 report 和 redo gate 回归。

## 后续门槛

生成后应运行：

- `game-account-community-updater` 刷新社区证据。
- `game-account-skill-evaluator` 判断是否达到使用标准。
- `scripts/validate-finalizer.mjs` 验证 sidecar、self-improve、SHA delivery contract 和 redo gate。
