#!/bin/bash
# plugins/notify/plugin.sh — ntfy 通知发送

plugin_info() {
    echo "notify:ntfy 通知发送:send|test"
}

plugin_help() {
    echo "用法: summ notify <子命令> [消息]"
    echo ""
    echo "子命令:"
    echo "  send \"消息\"   发送通知（默认）"
    echo "  test          发送测试通知"
    echo ""
    echo "环境变量 (或 summ config set):"
    echo "  NTFY_TOKEN       ntfy 访问 Token (必需；未设置时尝试从 docker 容器 ntfy 获取)"
    echo "  NTFY_URL         ntfy 服务地址 (默认 http://127.0.0.1:8200)"
    echo "  NTFY_TOPIC       ntfy topic (默认 zhengming_notify)"
    echo "  NTFY_USER_NAME   docker token fallback 用户名 (默认 jhihjian)"
    echo "  NTFY_TITLE       通知标题 (默认 通知)"
    echo "  NTFY_PRIORITY    通知优先级 (默认 default)"
    echo "  NTFY_TAGS        通知标签 (默认空)"
    echo "  NTFY_TIMEOUT     curl 超时时间，秒 (默认 10)"
    echo ""
    echo "示例:"
    echo "  summ notify send \"磁盘空间不足\""
    echo "  summ notify \"任务完成\""
    echo "  summ notify test --json"
}

_notify_docker_token() {
    local user_name="$1"

    command -v docker &>/dev/null || return 0
    docker exec ntfy sh -lc \
        'ntfy token list "$1" 2>/dev/null | awk "/tk_/ {print \$2; exit}"' \
        sh "$user_name" 2>/dev/null || true
}

_notify_request() {
    local message="${1:-[OpsAgent] 测试告警}"

    local ntfy_url
    ntfy_url="$(summ_config_get NTFY_URL 'http://127.0.0.1:8200')"
    local topic
    topic="$(summ_config_get NTFY_TOPIC 'zhengming_notify')"
    local user_name
    user_name="$(summ_config_get NTFY_USER_NAME 'jhihjian')"
    local title
    title="$(summ_config_get NTFY_TITLE '通知')"
    local priority
    priority="$(summ_config_get NTFY_PRIORITY 'default')"
    local tags
    tags="$(summ_config_get NTFY_TAGS)"
    local timeout
    timeout="$(summ_config_get NTFY_TIMEOUT '10')"
    local token
    token="$(summ_config_get NTFY_TOKEN)"

    if [[ -z "$token" ]]; then
        token="$(_notify_docker_token "$user_name")"
    fi

    [[ -z "$token" ]] && summ_error "未找到 NTFY_TOKEN。请运行 summ config set NTFY_TOKEN <token>，或确认 ntfy 容器可访问。"

    command -v curl &>/dev/null || summ_error "需要安装 curl"
    command -v jq &>/dev/null || summ_error "需要安装 jq"

    local curl_config
    curl_config="$(mktemp)"
    trap 'rm -f "$curl_config"' RETURN
    chmod 600 "$curl_config"
    printf 'header = "Authorization: Bearer %s"\n' "$token" > "$curl_config"

    local curl_headers=(-H "Title: $title" -H "Priority: $priority")
    if [[ -n "$tags" ]]; then
        curl_headers+=(-H "Tags: $tags")
    fi

    local publish_url="${ntfy_url%/}/${topic#/}"
    local response
    response="$(printf '%s' "$message" | curl -fsS \
        --max-time "$timeout" \
        --config "$curl_config" \
        "${curl_headers[@]}" \
        --data-binary @- \
        "$publish_url")" || summ_error "API 请求失败: $publish_url"

    jq -n \
        --arg topic "$topic" \
        --arg url "$publish_url" \
        --arg title "$title" \
        --arg priority "$priority" \
        --arg tags "$tags" \
        --arg message "$message" \
        --arg response "$response" \
        '{
            ok: true,
            topic: $topic,
            url: $url,
            title: $title,
            priority: $priority,
            tags: $tags,
            message: $message,
            response: (if $response == "" then null else (try ($response | fromjson) catch $response) end)
        }'
}

cmd_send() {
    local message="${1:-}"
    [[ -z "$message" ]] && summ_error "请输入通知消息"
    _notify_request "$message"
}

cmd_test() {
    _notify_request "[OpsAgent] 测试告警"
}

cmd_default() {
    if [[ -n "$1" ]]; then
        cmd_send "$@"
    else
        cmd_test
    fi
}
