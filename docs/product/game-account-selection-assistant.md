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

先做三款二次元游戏：

- 明日方舟
- Wuthering Waves（鸣潮）
- Neverness to Everness（异环）

不同游戏的账号价值逻辑差异很大，因此每个游戏使用独立 skill 和独立估值规则。

## 推荐实现形态

采用“通用工具 skill + 主筛选 skill + 游戏专属 skill + 后续本地 Web”的混合路线。

```text
game-account-toolkit      通用工具、依赖检查、安装指引、平台访问规范
game-account-select       主筛选编排：收集条件、查询平台、调用游戏估值 skill
game-account-wuthering-waves     Wuthering Waves（鸣潮）估值规则
game-account-arknights    明日方舟估值规则
game-account-neverness-to-everness       Neverness to Everness（异环）估值规则
local web app             后续展示候选列表、筛选器、对比表和反馈入口
```

Skill 适合早期，因为估值规则会根据用户反馈快速迭代；Web 页面适合中后期，因为大量账号需要表格、排序、筛选、横向对比和人工反馈。

## 数据策略

第一阶段只做购买前决策辅助：

1. 用户给出游戏、预算、区服、风险偏好和目标角色/资源偏好。
2. 主筛选 skill 低频访问平台公开列表页或用户提供的页面。
3. 通用工具层负责浏览器/CDP、OCR、HTML 提取、依赖检查和平台风险提示。
4. 游戏专属 skill 将挂牌字段转换为游戏内资产强度。
5. 输出 Top N 候选、排除理由、风险提示和待人工确认点。

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

## 后续验证清单

- 验证交易猫列表结构和访问限制。
- 建立Wuthering Waves（鸣潮）当前版本限定/常驻/强势角色知识表。
- 建立明日方舟限定、强度、资源、皮肤和区服权重。
- 建立Neverness to Everness（异环）S 角色、弧盘、觉醒、资源和账号类型权重。
- 实现通用工具 skill 的依赖检查脚本。
- 实现主筛选 skill 的状态机流程。
- 用真实查询样本验证评分结果。
- 后续创建本地 Web 页面展示候选账号对比。
