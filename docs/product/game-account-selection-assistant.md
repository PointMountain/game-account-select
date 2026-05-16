# 游戏账号智能筛选助手

## 产品定位

本项目不是账号交易撮合平台，而是账号购买前的智能筛选、估值和风险提示助手。目标是帮助用户直接找到符合条件的账号，并解释为什么值得看、为什么不建议买，而不是让用户在大量挂牌中手动大海捞针。

## MVP 范围

### 平台

优先支持中国账号代售平台：

- 盼之代售
- 螃蟹代售
- 交易猫

第一版不做全站实时聚合，不做自动下单，不做交易撮合。采用低频、用户条件驱动、浏览器辅助读取和样本库沉淀的方式验证可行性。

### 游戏

先做四款二次元游戏：

- 明日方舟
- Wuthering Waves（鸣潮）
- Neverness to Everness（异环）
- Zenless Zone Zero（绝区零 / ZZZ）

不同游戏的账号价值逻辑差异很大，因此每个游戏使用独立 skill 和独立估值规则。

## 推荐实现形态

采用“执行前准备 skill + 通用工具 skill + 主筛选 skill + 游戏专属 skill + 生成/评估/更新 skill + 后续本地 Web”的混合路线。

```text
game-account-preflight    执行前依赖、权限、浏览器/CDP、opencli、web-access 检查
game-account-toolkit      通用工具、依赖检查、安装指引、平台访问规范
game-account-select       主筛选编排：收集条件、查询平台、调用游戏估值 skill
game-account-skill-generator      根据新游戏生成买号估值 skill 和验证样例
game-account-skill-evaluator      评估 skill 是否达到使用标准
game-account-community-updater    刷新社区证据快照和覆盖限制
game-account-wuthering-waves     Wuthering Waves（鸣潮）估值规则
game-account-arknights    明日方舟估值规则
game-account-neverness-to-everness       Neverness to Everness（异环）估值规则
game-account-zenless-zone-zero   Zenless Zone Zero（绝区零 / ZZZ）估值规则
local web app             后续展示候选列表、筛选器、对比表和反馈入口
```

Skill 适合早期，因为估值规则会根据用户反馈快速迭代；Web 页面适合中后期，因为大量账号需要表格、排序、筛选、横向对比和人工反馈。

## Skill 框架标准

所有账号相关 skill 采用文件化结构：

- `SKILL.md` 只做入口、边界、必须读取文件和标准输入输出。
- `references/` 存储规则、社区证据、知识表、协议和 changelog。
- `scripts/` 存储可重复的本地验证/生成/评估脚本。
- `test-fixtures/` 存储离线验证样例。

输入输出使用标签契约：

- 输入：`<game_account_request>`、`<account_listing>`、`<community_evidence>`、`<skill_generation_request>`。
- 输出：`<game_account_evaluation>`、`<recommendations>`、`<skill_quality_report>`、`<community_refresh_report>`。

这个结构借鉴主流工程化 skill 框架的原则：薄编排、文档即状态、验证报告可复查、每个阶段都有明确输入输出。

## 数据策略

第一阶段只做购买前决策辅助：

1. 用户给出游戏、预算、区服、风险偏好和目标角色/资源偏好。
2. 主筛选 skill 低频访问平台公开列表页或用户提供的页面。
3. 通用工具层负责浏览器/CDP、OCR、HTML 提取、依赖检查和平台风险提示。
4. 游戏专属 skill 将挂牌字段转换为游戏内资产强度。
5. 输出 Top N 候选、排除理由、风险提示和待人工确认点。

当游戏未支持时，主筛选 skill 先调用 `game-account-skill-generator` 生成保守基线 skill，再调用 `game-account-skill-evaluator` 做质量门禁。未通过门禁时，只输出阻塞问题和社区刷新建议，不直接给真实购买推荐。

不应把平台公开可见等同于允许采集。任何自动化访问都应低频、可解释、保守，并优先使用用户主动触发的查询。

## 通用字段 schema

```yaml
listing:
  platform: string
  game: string
  url: string
  title: string
  price: number
  server: string
  account_type: string
  published_at: string | null
  view_count: number | null
  want_count: number | null
  discount: string | null
  guarantee_tags: string[]
  verification_tags: string[]
  binding_tags: string[]
  raw_text: string
  screenshots: string[]
```

## 评分框架

总评分不直接等于资产数量，而是：

```text
账号价值 = 游戏资产效用 + 资源效用 + 版本强度 + 稀缺资产
        - 价格溢价 - 绑定/找回风险 - 描述缺失风险 - 异常低价风险
```

LLM 不负责直接拍脑袋估值。LLM 适合：

- 解析卖家自然语言描述
- 总结截图/OCR内容
- 解释推荐理由
- 将攻略和版本评价转成可维护的游戏因子
- 根据用户反馈提出规则更新建议

规则和统计模型负责：

- 字段标准化
- 硬筛条件
- 相似账号比价
- 价格分位
- 风险扣分
- 排序

## Wuthering Waves（鸣潮）估值特别规则

Wuthering Waves（鸣潮）账号不能把总黄数、五星角色数量、五星武器数量或常驻角色高命当作主要价值来源。高命常驻/弱势角色只给低权重。

优先看：

- 限定/版本强势角色
- 关键命座
- 专武
- 队伍完整度
- 星声、月相、浮金波纹、铸潮波纹等抽卡资源
- TAP/Wegame 绑定风险
- 官服/B服/渠道服差异

用户已经指出过一次错误推荐：前排高命角色多为常驻无用角色，导致账号质量被高估。后续Wuthering Waves（鸣潮）筛选必须先识别高命来源，再评分。

## 跨游戏估值特别规则

不同游戏必须独立维护估值逻辑，但有共同底线：

- 不把总稀有度数量当作主价值来源。
- 不把常驻高命/高潜/高影画当作限定核心价值。
- 不把角色/干员/代理人名单和专武/音擎/弧盘/练度缺失的账号排到前列。
- 不用资产分掩盖实名、绑定、PSN/TAP/Wegame/HoYoverse、找回包赔、官方验号等风险。

明日方舟优先看限定/联动、关键干员练度、专精/模组、资源、稀有时装和实名找回风险。

异环优先看命名 S 角色、S 弧盘适配、觉醒/练度、环石/异晶/骰子/钥匙资源、主角与账号类型风险。

绝区零优先看限定 S 代理人、专属音擎、队伍完整度、菲林/母带/邦布券资源、HoYoverse/PSN/TAP 绑定风险。

## 安装与执行入口

仓库按 Agent Skills 目录结构组织，支持通过 `npx skills` 从 GitHub 安装：

```bash
npx skills add https://github.com/PointMountain/game-account-select
npx skills add https://github.com/PointMountain/game-account-select --skill "game-account-select"
```

用户正常执行时不需要先手动跑环境检查。所有入口 skill 都应把 `game-account-preflight` 作为第一步自动调用，再进入平台读取、社区证据、游戏估值和质量评估流程。

## 自我优化机制

每次执行筛选后，skill 应记录：

- 哪些候选被推荐
- 用户是否接受
- 用户指出的误判原因
- 是否需要更新游戏规则
- 是否需要更新平台解析模式

但 skill 不能静默改写自身规则。安全流程应为：

1. 提出规则更新建议。
2. 展示将修改的文件和原因。
3. 获得用户确认。
4. 写入对应游戏 skill 的 `references/valuation-rules.md` 或平台解析规则。
5. 记录 changelog。

## 社区证据刷新机制

社区证据有两种刷新方式：

- 执行时临时刷新：当用户样本出现未覆盖资产、版本变化或本地快照过期时，按社区调研协议收集少量高信号来源。
- 维护者预刷新：使用 `game-account-community-updater` 将整理好的 evidence JSON 写入对应 skill，减少真实执行时的 token 和网络成本。

刷新只更新 `community-evidence.md` 和刷新报告，不直接改变估值权重。若证据显示规则需要调整，应输出规则更新建议并等待用户确认。

## 后续验证清单

- 验证交易猫列表结构和访问限制。
- 建立Wuthering Waves（鸣潮）当前版本限定/常驻/强势角色知识表。
- 建立明日方舟限定、强度、资源、皮肤和区服权重。
- 建立Neverness to Everness（异环）S 角色、弧盘、觉醒、资源和账号类型权重。
- 建立Zenless Zone Zero（绝区零）限定代理人、音擎、队伍、资源和绑定风险权重。
- 实现通用工具 skill 的依赖检查脚本。
- 实现执行前准备、skill 生成、skill 评估和社区证据更新脚本。
- 实现主筛选 skill 的状态机流程。
- 用真实查询样本验证评分结果。
- 后续创建本地 Web 页面展示候选账号对比。
