# 游戏账号 skill 评估标准

updated_at: 2026-05-16

## 分数构成

```yaml
structure: 20
io_contract: 15
valuation_rules: 20
community_evidence: 15
risk_and_missing_data: 15
validation: 15
```

## 阻塞问题

- 缺 `SKILL.md`。
- 缺 `references/valuation-rules.md`。
- 缺 `references/community-evidence.md`。
- 缺本地验证脚本。
- 没有风险扣分或缺失字段规则。
- 没有防止“只堆数量/泛称高稀有度”的硬规则。

## 通过标准

- 总分 >= 80。
- 无阻塞问题。
- 验证脚本存在且可运行。

## 输出建议

评估器应输出机器可读 JSON，也应能转成 `<skill_quality_report>`。
