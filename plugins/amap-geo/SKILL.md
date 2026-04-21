---
name: amap-geocoding
description: Use when converting Chinese addresses to coordinates (longitude, latitude), when user mentions "地理编码", "地址转坐标", or needs location lookup for addresses in China
---

# AMap Geocoding (高德地图地理编码)

将中国地址转换为经纬度坐标。

## 前提条件

1. 已运行 `/data/dev/SUMM-Cli/install.sh` 安装脚本
2. 设置 AMAP_API_KEY：`summ config set AMAP_API_KEY <key>`
3. 申请地址: https://console.amap.com/dev/key/app (选择 "Web服务" 类型)

## 快速参考

| 命令 | 说明 |
|------|------|
| `summ amap-geo search "地址"` | 地理编码 |
| `summ amap-geo search "地址" -c 城市` | 指定城市 |
| `summ amap-geo reverse "经度,纬度"` | 逆地理编码 |

## 使用方法

```bash
# 地理编码
summ amap-geo search "天安门"
summ amap-geo search "天安门" -c 北京

# 逆地理编码
summ amap-geo reverse 116.397463,39.909187

# JSON 输出
summ amap-geo search "天安门" --json
```

## 配置

| 变量 | 说明 |
|------|------|
| `AMAP_API_KEY` | 高德地图 Web 服务 API Key（必需） |

## 参考

- API 文档: https://lbs.amap.com/api/webservice/guide/api/georegeo/
