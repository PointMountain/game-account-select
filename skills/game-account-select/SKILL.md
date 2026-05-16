---
name: game-account-select
description: 根据用户预算、游戏目标、平台偏好和风险偏好，查询并筛选中国游戏账号平台的候选账号，调用游戏专属 skill 进行估值和解释。
argument-hint: "[游戏] [预算] [偏好]"
---

# Game Account Select Skill

## 作用

这是游戏账号智能筛选体系的主编排 skill。它负责把用户需求转成查询条件，调用 `game-account-toolkit` 做工具和平台访问准备，再调用对应游戏 skill 做资产估值。

## 依赖

必须引用：

- `game-account-toolkit`

按游戏引用：

- Wuthering Waves（鸣潮） → `game-account-wuthering-waves`
- 明日方舟 → `game-account-arknights`
- Neverness to Everness（异环） → `game-account-neverness-to-everness`

## 执行流程

读取 `references/selection-state-machine.md`，按状态机执行。不要把流程写成泛泛建议；每一步都要有明确输入、输出和降级路径。

## 默认筛选目标

优先解决用户“大海捞针”的问题：主动找到符合条件的候选账号，而不是只分析用户粘贴的单个链接。

默认支持条件：

- 游戏
- 预算
- 平台范围
- 官服/B服/渠道服
- 绑定要求
- 找回包赔/官方验号
- 强度开荒
- 抽卡资源
- 收藏/皮肤
- 性价比
- 低风险

## 输出格式

```text
1. 查询条件
2. 数据来源与限制
3. 入选账号 Top N
4. 每个账号的推荐理由
5. 每个账号的风险/缺失字段
6. 被排除账号与排除理由
7. 需要用户人工确认的问题
8. 本次规则是否需要更新
```

## 自我优化

每次执行结束，如果用户反馈推荐错误，先判断错误类型：

- 平台解析错误
- 游戏估值权重错误
- 当前版本强度知识过期
- 用户偏好理解错误
- 风险判断不足

只有在用户确认后，才能修改对应 skill 的规则文件。修改后写入该 skill 的 changelog。
