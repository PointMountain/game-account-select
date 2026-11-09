# 知识格式与自动写回

新增、修正或重复验证经验时读取。分类规则见 [ops-model](ops-model.md)。

## 唯一归属

| 文件 | 内容 |
| --- | --- |
| `sites/<site>/index.md` | 站点共享事实与 operation 目录 |
| `sites/<site>/operations/<game>-list|detail.md` | 某游戏在该站的查询经验；query.mjs 会读取它 |
| [operations.json](operations.json) | 可执行 operation 目录（entry、信号、availability） |
| `games/<game>/index.md` | 要看哪些资产、常见坑 |
| `games/<game>/game.json` | 筛选脚本用的名单、字段信号和风险词 |
| `games/<game>/evidence.md`、`data/` | 社区证据快照与客观名单数据 |
| `.harness/`、`experience.local.md`、`local/` | 单次运行与原始证据（ignored） |

## 站点 operation（query.mjs 的消费 schema，不要改结构）

frontmatter 要有 `site`、`operation`、`status`、`last_verified`；正文必须有 `## 检查点`（列表）和 `## 成功标准`，并在站点 index 用 `(operations/<slug>.md)` 链接。少了任何一项，runner 都会判为 drift 并 fail closed。

## 游戏 operation

```yaml
---
game: zenless-zone-zero
operation: refresh-evidence
status: partial      # documented | partial | verified
last_verified: null  # 只有 verified 才填真实成功日期
---
```

正文写：何时做、要维护的事实、步骤、成功标准、证据。

## game.json 信号

`signals[]` 中每项含 `id`、`label`、`objective`（rarity / combat / progression / resources / skins，对应 profile priorities）、`scale`，再加以下一种取值方式：

- `names`：具名资产名单；单字名只作精确资产名匹配。
- `field`：解析器输出字段路径，例如 `resources.polychrome`。
- `regex`：从标题或正文取数；加 `sum: true` 时求和。
- `signature`：专武表路径。

名单有时效性时加 `as_of`；只是历史快照的，加 `confidence: historical`。

## 证据与资产完整性

- `data/community-evidence.json` 的当前主张需要 `id`、`subject`、`status: supported`、`as_of`、`version_context`、非空玩法 `contexts` 和 `source_ids`。每个引用的来源需要 `id`、`url`、`publisher`、`published_at`、`observed_at`、`content_kind`、`excerpt` 和相同的 `version_context`。
- 新鲜度检查只接受原始发布日期在 7 天内、可读正文/字幕/图表或官方数据、至少两位不同作者支持的主张。只有检索标题、观察时间或单一作者不足以标为当前主张。
- 商品的 `status.assetRosterComplete: true` 只在完整资产名单被真实核实后填写；`sourceStatus: success` 不代表名单完整。没有完整名单时，无法证实排除项不存在。

## 每次任务后的自动写回

1. 对照成功标准判定本次结果：完整成功、部分完成、失败，或没有新事实。
2. 在唯一归属里合并新事实或修正旧结论，不追加互相矛盾的段落。
3. 真实查询完整成功时，刷新对应站点 operation 的 `last_verified`；内容没变时只改日期。
4. 部分执行只记录观察到的事实和待核实项，不刷新日期。登录失效或等待授权不写成平台缺陷。
5. 修复了解析问题时，先加一个能复现问题的失败样例（`tests/` 或 `scripts/tests/`），再改代码。不改低已有的断言。
6. 跑 `npm run verify:skills`，然后报告写回了哪些文件、证据范围是什么。没有新知识要说明原因；写入或校验失败就报告“未沉淀”。

迁移日不是验证日。被新证据推翻的结论要降级并移除成功日期。

## 私有信息

凭据、Cookie、签名 URL、卖家联系方式、完整商品响应和用户原话都不写入共享经验；原始证据只引用 `.harness/...` 的相对路径。
