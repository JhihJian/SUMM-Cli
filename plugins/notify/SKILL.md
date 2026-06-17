---
name: notify
description: Use when sending ntfy notifications or alerts through SUMM-Cli, especially for task completion, operations alerts, or short status messages
---

# Notify — ntfy 通知

通过 ntfy 发送通知消息。

## 前提条件

1. 已在仓库根目录运行 `npm install -g .`，或使用 `node summ.mjs ...` 直接执行
2. 设置 `NTFY_TOKEN`：`summ config set NTFY_TOKEN <token>`
3. 如果未设置 `NTFY_TOKEN`，插件会尝试从本机 `ntfy` Docker 容器读取指定用户的 token

## 快速参考

| 命令 | 用途 |
|------|------|
| `summ notify send "消息"` | 发送通知 |
| `summ notify "消息"` | 快捷发送 |
| `summ notify test` | 发送测试通知 |

## 使用方法

```bash
# 发送通知
summ notify send "任务已完成"

# 快捷方式
summ notify "磁盘空间不足"

# JSON 输出
summ notify test --json
```

## 配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NTFY_TOKEN` | ntfy 访问 Token | - |
| `NTFY_URL` | ntfy 服务地址 | `http://127.0.0.1:8200` |
| `NTFY_TOPIC` | ntfy topic | `zhengming_notify` |
| `NTFY_USER_NAME` | Docker token fallback 用户名 | `jhihjian` |
| `NTFY_TITLE` | 通知标题 | `通知` |
| `NTFY_PRIORITY` | 通知优先级 | `default` |
| `NTFY_TAGS` | 通知标签，留空则不发送 Tags 头 | 空 |
| `NTFY_TIMEOUT` | 请求超时时间（秒） | `10` |
