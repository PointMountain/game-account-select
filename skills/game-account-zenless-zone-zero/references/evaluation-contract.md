# 估值输出与执行示例

## 独立估值维度

- `asset_score`：版本化限定核心、影画断点、免费/常驻供给折价；S 数量不是价值代理。
- `engine_score`：逐名匹配 `signature-engines.json`；总 S 音擎数不能替代归属。
- `team_score`：独立可用队伍与不重复占用关键队友；当前虚狩完整性单独核验。
- `resource_score`：菲林与菲林底片按 160:1，加密/原装母带与邦布券按 1:1。
- `progression_score`：绳匠等级、式舆/危局/零号空洞及养成披露。
- `price_fit_score`：只表达本轮市场对比与价格效率，不改变账号固有资产质量。
- `risk_penalty`：邮箱交付/实名、HoYoverse、PSN/TAP、区服区域、验号与找回保障。
- `confidence_penalty`：未披露资源、平台验号、音擎归属、绝对挂牌时间等缺失事实。

输出 `<game_account_evaluation>` 机器对象时至少保留：

```yaml
zenless_zone_zero_score:
  asset_score: number
  engine_score: number
  team_score: number
  resource_score: number
  progression_score: number
  price_fit_score: number
  risk_penalty: number
  confidence_penalty: number
  final_score: number
  confidence: low|medium|high
  community_comparison: string
  highlights: string[]
  concerns: string[]
  missing_fields: string[]
```

用户可见最终答复不得暴露原始 XML 标签；应使用自然语言或 Markdown 表格，并分开标明“挂牌价”“合理成交区间”“前置核验条件”。
