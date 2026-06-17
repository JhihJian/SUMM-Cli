---
name: vision
description: Use when analyzing or describing images via Zhipu GLM-4.6V, when user asks about image content, or needs visual analysis capabilities
---

# Vision — 图片分析识别

分析图片内容，支持自定义提示词。

## 前提条件

1. 已在仓库根目录运行 `npm install -g .`，或使用 `node summ.mjs ...` 直接执行
2. 设置 ZHIPU_API_KEY：`summ config set ZHIPU_API_KEY <key>`
3. 获取 Key: https://open.bigmodel.cn/

## 快速参考

| 命令 | 用途 |
|------|------|
| `summ vision analyze <图片> "提示词"` | 自定义分析 |
| `summ vision describe <图片>` | 描述图片内容 |
| `summ vision <图片> "提示词"` | 快捷分析（同 analyze） |

## 使用方法

```bash
# 描述图片
summ vision describe photo.jpg

# 自定义分析
summ vision analyze food.jpg "分析营养成分"
summ vision analyze code.png "识别代码并指出问题"

# 快捷方式
summ vision photo.jpg "这是什么？"

# JSON 输出
summ vision describe photo.jpg --json
```

## 配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ZHIPU_API_KEY` | 智谱 API Key（必需） | - |
| `ZHIPU_BASE_URL` | API 地址 | `https://open.bigmodel.cn/api/paas/v4` |
| `MULTIMODAL_MODEL` | 模型名 | `glm-4.6v` |

## 限制

- 图片大小上限 20MB
- 支持格式：JPEG、PNG、GIF、WebP、HEIC
