<p align="center">
  <img src="assets/readme-banner.svg" alt="Game Account Select - 基于社区证据的游戏账号估值 Skill Pack" width="100%" />
</p>

# Game Account Select

<p align="center">
  <em>基于社区证据的游戏账号筛选与估值 Agent Skills。</em>
</p>

<p align="center">
  <a href="README.md"><strong>简体中文</strong></a>
  ·
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="#安装"><img src="https://img.shields.io/badge/install-npx%20skills%20add-58d6b5?style=for-the-badge&labelColor=101624" alt="使用 npx skills add 安装" /></a>
  <a href="#skills"><img src="https://img.shields.io/badge/skills-10-f0c96a?style=for-the-badge&labelColor=101624" alt="10 个 Agent Skills" /></a>
  <a href="#自动-preflight"><img src="https://img.shields.io/badge/preflight-automatic-e27d60?style=for-the-badge&labelColor=101624" alt="自动 preflight" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-8b5cf6?style=for-the-badge&labelColor=101624" alt="MIT License" /></a>
</p>

Game Account Select 是一个面向游戏账号购买决策的 Agent Skills 包。它把账号挂牌、截图、卖家描述和社区攻略证据转成结构化推荐，并明确展示风险、缺失字段和规则更新建议。

它不是交易撮合平台，也不会自动下单。它的目标是帮助 Agent 判断哪些账号值得继续看、哪些账号只是资产数量看起来好看、哪些卖家信息必须人工核验后才能考虑购买。

<p align="center"><sub><a href="#安装">安装</a> · <a href="#skills">Skills</a> · <a href="#执行流程">执行流程</a> · <a href="#标准输入输出">标准输入输出</a> · <a href="#维护验证">维护验证</a> · <a href="#安全边界">安全边界</a> · <a href="#协议">协议</a></sub></p>

## 安装

安装仓库内所有 skill：

```bash
npx skills add https://github.com/PointMountain/game-account-select
```

只安装需要的单个 skill。`--skill` 后面传的是每个 `SKILL.md` frontmatter 里的 `name:`，不是目录名：

```bash
npx skills add https://github.com/PointMountain/game-account-select --skill "game-account-select"
npx skills add https://github.com/PointMountain/game-account-select --skill "game-account-zenless-zone-zero"
```

在本地 checkout 中列出所有可安装名称：

```bash
npm run list:skills
```

## Skills

| 安装名 | 角色 | 适用场景 |
| --- | --- | --- |
| `game-account-select` | 主筛选编排 | 从用户预算、游戏目标、风险偏好和账号来源出发，输出候选账号排序与解释。 |
| `game-account-preflight` | 自动执行前准备 | 其它账号 skill 开始执行时，先检查工具、浏览器访问和缺失依赖。 |
| `game-account-toolkit` | 通用工具层 | 游戏 skill 需要共享 I/O 契约、平台访问策略、社区调研协议或依赖检查工具。 |
| `game-account-skill-generator` | 游戏 skill 生成器 | 用户请求的游戏还未支持，需要生成保守的买号估值基线 skill。 |
| `game-account-skill-evaluator` | 质量门禁 | 新生成或修改过的游戏 skill 需要在真实推荐前做结构、证据、规则和验证检查。 |
| `game-account-community-updater` | 社区证据刷新 | 当前版本社区共识过期、缺失，或用户要求更新攻略/避坑证据。 |
| `game-account-wuthering-waves` | 鸣潮 / Wuthering Waves | 评估限定角色、版本价值、专武、抽卡资源和 TAP/Wegame/PS5 绑定风险。 |
| `game-account-arknights` | 明日方舟 | 评估限定/联动干员、关键练度、专精/模组、资源、收藏价值和实名找回风险。 |
| `game-account-neverness-to-everness` | 异环 / Neverness to Everness | 评估命名 S 角色、S 弧盘、觉醒、资源、主角/账号类型和早期市场风险。 |
| `game-account-zenless-zone-zero` | 绝区零 / ZZZ | 评估限定 S 代理人、专属音擎、队伍完整度、菲林/母带/邦布券和 HoYoverse/PSN/TAP 绑定风险。 |

## 执行流程

```text
用户需求
  -> game-account-select
  -> 自动 game-account-preflight
  -> game-account-toolkit
  -> 对应游戏 skill 或 game-account-skill-generator
  -> game-account-skill-evaluator
  -> 推荐排序、风险、缺失字段、规则更新建议
```

1. 用户提供游戏、预算、区服、目标资产、风险偏好和账号来源。
2. `game-account-select` 标准化请求，并自动启动 `game-account-preflight`。
3. `game-account-toolkit` 为用户提供的页面、截图、OCR 文本或公开挂牌片段选择安全访问方式。
4. 对应游戏 skill 按游戏专属规则和社区证据给账号评分。
5. 如果游戏尚未支持，`game-account-skill-generator` 先生成保守基线 skill，再由 `game-account-skill-evaluator` 判断是否可用。
6. 最终输出推荐排序、不建议购买的原因、卖家缺失字段和规则更新建议。

## 自动 Preflight

用户不需要先手动执行“使用前检查”。每个入口 skill 都应把 `game-account-preflight` 作为第一步自动调用。

Preflight 会检查 Node.js、git、GitHub CLI、浏览器/CDP、`opencli`、`web-access` 和项目本地依赖状态。它可以安全地报告缺失工具和运行仓库内检查，但不会静默安装全局软件，也不会静默修改已安装的 Codex skills。

## 标准输入输出

所有账号 skill 共享 `skills/game-account-toolkit/references/skill-io-contract.md` 中的契约。

推荐输入标签：

- `<game_account_request>`
- `<account_listing>`
- `<community_evidence>`
- `<skill_generation_request>`

推荐输出标签：

- `<game_account_evaluation>`
- `<recommendations>`
- `<skill_quality_report>`
- `<community_refresh_report>`

这个结构让每个 skill 保持清晰：`SKILL.md` 只写入口行为，`references/` 存规则和证据，`scripts/` 存可重复验证脚本，`test-fixtures/` 存离线样例。

## 生成新游戏 Skill

可以直接让已安装的 skill 为新游戏生成买号 skill：

```text
使用 game-account-skill-generator 为 <游戏名> 创建账号购买评估 skill，然后先评估质量再用于推荐。
```

维护者也可以在本地 checkout 中运行确定性生成脚本：

```bash
node skills/game-account-skill-generator/scripts/generate-game-skill.mjs --game "Test Frontier" --out /tmp/game-account-generator-test --force
node /tmp/game-account-generator-test/skills/game-account-test-frontier/scripts/validate-sample.mjs
```

新生成的 skill 默认低置信度，直到社区证据、评分规则、验证样例和 evaluator 报告都通过质量门禁。

## 维护验证

下面命令面向仓库维护者和 CI 风格验证。普通用户调用 skill 前不需要手动执行。

```bash
npm run list:skills
npm run verify:skills
node skills/game-account-preflight/scripts/preflight.mjs --json
node skills/game-account-skill-evaluator/scripts/evaluate-skill.mjs skills/game-account-wuthering-waves --json
node skills/game-account-community-updater/scripts/update-community-evidence.mjs --skill skills/game-account-zenless-zone-zero --evidence skills/game-account-community-updater/test-fixtures/evidence-sample.json --out /tmp/community-refresh-test
```

社区证据有两种刷新方式：

- 执行时刷新：挂牌出现本地快照未覆盖的资产、版本发生大变化，或用户要求检查当前社区评价。
- 维护者预刷新：通过 `game-account-community-updater` 把整理好的 evidence JSON 写入某个游戏 skill，减少后续执行时的 token 和网络成本。

证据刷新只更新 `community-evidence.md` 和刷新报告。它不应静默改写估值权重；规则变化应先提出建议，经过确认后再写入游戏 skill changelog。

## 安全边界

- 不自动购买账号，不替用户做交易决策。
- 不绕过验证码、登录限制、平台频率限制或反自动化机制。
- 不把公开可见挂牌等同于允许大规模抓取。
- 不用稀有资产总数直接抬高账号排名。
- 不隐藏绑定、实名、PSN/TAP/Wegame/HoYoverse、找回、包赔或验号缺口。
- 不在用户反馈后静默修改估值规则；必须先提出具体规则更新建议。

## 协议

[MIT License](LICENSE) © 2026 PointMountain
