#!/bin/bash
# plugins/amap-geo/plugin.sh — 高德地图地理编码

plugin_info() {
    echo "amap-geo:高德地图地理编码:search|reverse"
}

plugin_help() {
    echo "用法: summ amap-geo <子命令> [选项]"
    echo ""
    echo "子命令:"
    echo "  search \"地址\" [-c 城市]   地理编码（地址 → 坐标）"
    echo "  reverse \"经度,纬度\"        逆地理编码（坐标 → 地址）"
    echo ""
    echo "选项:"
    echo "  -c, --city CITY   指定查询城市"
    echo ""
    echo "环境变量 (或 summ config set):"
    echo "  AMAP_API_KEY   高德地图 Web 服务 API Key (必需)"
    echo ""
    echo "示例:"
    echo "  summ amap-geo search \"天安门\" -c 北京"
    echo "  summ amap-geo reverse 116.397463,39.909187"
    echo "  summ amap-geo search \"天安门\" --json"
}

_urlencode() {
    jq -sRr @uri <<< "$1"
}

cmd_search() {
    local address=""
    local city=""
    local args=("$@")
    local i=0

    while [[ $i -lt ${#args[@]} ]]; do
        case "${args[$i]}" in
            -c|--city)
                city="${args[$((i+1))]}"
                ((i+=2)) || true
                ;;
            *)
                address="${args[$i]}"
                ((i++)) || true
                ;;
        esac
    done

    [[ -z "$address" ]] && summ_error "请输入地址"

    local api_key="$(summ_config_get AMAP_API_KEY)"
    [[ -z "$api_key" ]] && summ_error "未配置 AMAP_API_KEY，运行 summ config set AMAP_API_KEY <value>"

    command -v jq &>/dev/null || summ_error "需要安装 jq"

    local encoded_addr="$(_urlencode "$address")"
    local url="https://restapi.amap.com/v3/geocode/geo?key=${api_key}&address=${encoded_addr}&output=JSON"

    if [[ -n "$city" ]]; then
        local encoded_city="$(_urlencode "$city")"
        url="${url}&city=${encoded_city}"
    fi

    curl -sf "$url" || summ_error "API 请求失败: $url"
}

cmd_reverse() {
    local location="${1:-}"
    [[ -z "$location" ]] && summ_error "请输入坐标，格式: 经度,纬度"

    local api_key="$(summ_config_get AMAP_API_KEY)"
    [[ -z "$api_key" ]] && summ_error "未配置 AMAP_API_KEY，运行 summ config set AMAP_API_KEY <value>"

    local url="https://restapi.amap.com/v3/geocode/regeo?key=${api_key}&location=${location}&output=JSON"
    curl -sf "$url" || summ_error "API 请求失败: $url"
}

cmd_default() {
    if [[ -n "$1" ]]; then
        cmd_search "$@"
    else
        summ_error "请输入地址，例如: summ amap-geo search \"天安门\""
    fi
}
