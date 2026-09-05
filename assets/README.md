# README 视觉素材

2026-09-05 使用内置 `image_gen` 生成；先确定原创角色，再以首版头像为角色与画风参考制作介绍图和分区插画。当前头像已修订为满版方形，背景延伸到四角。

| 文件 | 用途 |
| --- | --- |
| [readme-avatar.png](readme-avatar.png) | 满版方形项目头像；README 以 112 px 显示 |
| [readme-hero.png](readme-hero.png) | 中英文 README 共用的宽幅介绍插画 |
| [readme-status.png](readme-status.png) | Project Status：工作室进度板 |
| [readme-install.png](readme-install.png) | 安装：拆开技能卡盒、准备工具 |
| [readme-search.png](readme-search.png) | 找号：愿望清单与账号卡片 |
| [readme-evaluate.png](readme-evaluate.png) | 单号评估：核对角色、装备与资源 |
| [readme-compare.png](readme-compare.png) | 账号比较：三份候选资料 |
| [readme-report.png](readme-report.png) | 推荐报告：整理好的卡片与核对清单 |
| [readme-games.png](readme-games.png) | 游戏支持：四本不同世界的冒险图鉴 |
| [readme-architecture.png](readme-architecture.png) | 架构引导：需求、资料、游戏图鉴与报告 |

视觉方向：原创薄荷发看板娘、珊瑚色耳机与星星发夹、奶油纸色，结合角色卡、放大镜与比较清单。图片里的卡片与人物为说明性插画。

排版参考 [Cherry Studio](https://github.com/CherryHQ/cherry-studio) 和 [LobeHub](https://github.com/lobehub/lobehub) 的居中品牌区、语言导航与折叠内容组织方式；文案和插画为本项目重新创作。

Project Status 与架构组织参考 [Project AIRI](https://github.com/moeru-ai/airi)。状态徽章指向本仓库的 GitHub Actions、提交历史与 Issues；Mermaid 图根据当前架构文档与技能入口绘制。分区插画中的卡片、书籍和图标为说明性素材，实际状态与架构以 README 的文字和 Mermaid 为准。

当前方形头像修订和八张分区插画的完整提示词见 [readme-art-prompts.json](readme-art-prompts.json)。以下保留首版头像与首页介绍图的原始提示词。

## 首版头像生成提示词

```text
Use case: logo-brand
Asset type: square project avatar for the open-source project Game Account Select.
Primary request: an original, beautifully drawn anime mascot for an assistant that helps players choose a game account.
Subject: friendly young adult anime woman with short mint-silver bob hair, a small coral-orange star hairclip, warm amber eyes, and coral over-ear headphones resting around her neck. She wears a neat cream-and-teal casual jacket and holds one small collectible character card with a coral checkmark, beside her face.
Style/medium: premium Japanese anime illustration with confident dark-teal linework, polished cel shading, expressive eyes and slightly simplified avatar proportions. Charming and calm, with a hand-drawn collectible sticker sensibility.
Composition/framing: 1024x1024 square, centered head-and-shoulders portrait, face large and clearly legible at 64px. All important features fit safely inside a centered circular crop; generous margin above the head. Hair silhouette must be distinctive.
Lighting/mood: warm, inviting, quietly playful.
Color palette: warm ivory paper background, mint/teal, restrained coral-orange, deep ink outlines. A simple flat pale mint circle behind the character, tiny single star accent.
Text: none.
Constraints: original character design, fully clothed, clean anatomy, only one visible hand gripping the card naturally. No lettering, no watermark, no existing game logos, no mockup sheet, no extra panels, no generic 3D robot, no neon or glass effects.
```

## 介绍图生成提示词

参考图为首版头像；[当前头像](readme-avatar.png) 沿用同一角色并修正了四角构图。

```text
Use case: ads-marketing
Asset type: wide illustrated GitHub README introduction banner for Game Account Select.
Primary request: create a polished anime editorial banner, approximately 2.5:1 landscape, matching the supplied original project avatar.
Input image 1: character identity and art-style reference only; make a new wide composition, not a collage of the existing avatar.
Scene: a warm, uncluttered illustrated desk for choosing a game account. A few paper character cards with small check marks, a magnifying glass, and a small shortlist notebook communicate comparing accounts and finding a good fit.
Subject: the same mint-silver bob-haired young adult anime woman, amber eyes, coral star hairclip, coral headphones around the neck, cream jacket with deep teal trim. She smiles and presents a selected character card; show natural hands. Occupies the right half of the banner.
Style/medium: premium Japanese anime key visual meets a refined printed gaming magazine. Confident ink linework, elegant cel shading, very subtle paper texture, airy composition.
Composition: strong left-aligned dark-teal headline in the left 43 percent, mascot and desk on the right 57 percent. Large readable type, careful kerning. Wide safe margins. Cream background with a restrained pale mint curved graphic behind her. A few coral star accents only.
Text (verbatim), large left title, split across these three lines:
"GAME"
"ACCOUNT"
"SELECT"
Under it in much smaller clear type:
"Find your next adventure."
At the lower left, three short labels in a clean single row, separated by small dots:
"WISHLIST  ·  COMPARE  ·  PLAY"
Color palette: warm ivory, mint, deep ink teal, coral-orange. Use coral for SELECT to create one strong accent.
Constraints: one unified widescreen image, no mock webpage frame, no 3D render, no neon, no glassmorphism, no existing game logos, no extra text, no watermark. Character face and cards must stay clear when displayed at GitHub README width.
```
