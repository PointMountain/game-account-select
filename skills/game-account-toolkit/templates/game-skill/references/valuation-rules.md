# {{game_name}} 估值规则

updated_at: {{date}}

## 社区证据要求

评分前读取 `references/community-evidence.md` 和 `references/asset-knowledge.md`。如果快照超过 30 天、出现未覆盖的新核心资产、或来源覆盖不足，`confidence` 最高为 `medium`。

## 最高优先级规则

不要把稀有度总数、账号等级或卖家宣传词当作主价值来源。必须先判断：

1. 核心资产是否命名且与用户目标一致。
2. 资源是否支撑后续养成或抽取。
3. 账号绑定、实名、找回、平台保障是否清楚。
4. 社区证据是否足够支持当前判断。

## 可执行评分框架

```yaml
score_weights:
  named_core_asset_score: 0-35
  resource_score: 0-15
  progression_score: 0-10
  account_fit_score: 0-10
  price_fit_score: 0-10
  risk_penalty: 0-35
  missing_data_penalty: 0-30
```

## 低价值或陷阱资产

- 只写总数量，不列名称、练度、装备或资源。
- 高等级但缺少核心资产。
- 资源、绑定、找回包赔、官方验号缺失。
- 异常低价且描述过好。

## 排序硬规则

- “总数高但不列明细”的账号不得排在“命名核心资产 + 资源/风险明确”的账号前。
- 只写等级或极品号的账号不能进入 Top 1。
- 低风险偏好下，绑定/找回不明账号应排除或只作备选。

## 推荐解释要求

每个推荐账号必须说明核心资产、资源、风险、缺失字段、社区证据一致性和规则刷新建议。
