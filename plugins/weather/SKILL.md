---
name: weather
description: Use when fetching weather data via Caiyun API, when user asks about weather, or needs weather info for reports
---

# Weather API

获取天气信息。

## 前提条件

1. 已运行 `/data/dev/SUMM-Cli/install.sh` 安装脚本
2. 设置 CAIYUN_TOKEN：`summ config set CAIYUN_TOKEN <token>`
3. 获取 Token: https://www.caiyunapp.com/h5/

## 快速参考

| 命令 | 用途 |
|------|------|
| `summ weather realtime` | 实时天气 |
| `summ weather daily` | 逐日预报 |
| `summ weather hourly` | 逐小时预报 |
| `summ weather minutely` | 分钟级降水 |

## 使用方法

```bash
# 今日天气预报
summ weather daily

# 实时天气
summ weather realtime

# 指定坐标
summ weather daily 121.4 31.2

# JSON 输出
summ weather daily --json
```

## 配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CAIYUN_TOKEN` | API Token（必需） | - |
| `DEFAULT_LONGITUDE` | 经度 | 116.4（北京） |
| `DEFAULT_LATITUDE` | 纬度 | 39.9（北京） |

## 参考

- API文档: https://docs.caiyunapp.com/weather-api/v2/v2.6/4-daily.html
