#!/bin/bash
# plugins/weather/plugin.sh — 彩云天气查询

plugin_info() {
    echo "weather:彩云天气查询:realtime|daily|hourly|minutely"
}

plugin_help() {
    echo "用法: summ weather <子命令> [经度] [纬度]"
    echo ""
    echo "子命令:"
    echo "  realtime    实时天气"
    echo "  daily       逐日预报 (默认)"
    echo "  hourly      逐小时预报"
    echo "  minutely    分钟级降水"
    echo ""
    echo "环境变量 (或 summ config set):"
    echo "  CAIYUN_TOKEN        彩云天气 API Token (必需)"
    echo "  DEFAULT_LONGITUDE   经度 (默认 116.4)"
    echo "  DEFAULT_LATITUDE    纬度 (默认 39.9)"
    echo ""
    echo "示例:"
    echo "  summ weather daily"
    echo "  summ weather realtime 121.4 31.2"
    echo "  summ weather daily --json"
}

_weather_api_base() {
    echo "https://api.caiyunapp.com/v2.6"
}

_weather_request() {
    local endpoint="$1"
    local longitude="${2:-$(summ_config_get DEFAULT_LONGITUDE 116.4)}"
    local latitude="${3:-$(summ_config_get DEFAULT_LATITUDE 39.9)}"

    local token
    token="$(summ_config_get CAIYUN_TOKEN)"
    [[ -z "$token" ]] && summ_error "未配置 CAIYUN_TOKEN，运行 summ config set CAIYUN_TOKEN <value>"

    local url="$(_weather_api_base)/${token}/${longitude},${latitude}/${endpoint}"
    curl -sf "$url" || summ_error "API 请求失败: $url"
}

cmd_realtime() { _weather_request "realtime" "$@"; }
cmd_daily()    { _weather_request "daily" "$@"; }
cmd_hourly()   { _weather_request "hourly" "$@"; }
cmd_minutely() { _weather_request "minutely" "$@"; }

cmd_default() { cmd_daily "$@"; }
