#!/bin/bash
# plugins/vision/plugin.sh — 通用图片分析（智谱 GLM-4.6V）

plugin_info() {
    echo "vision:图片分析识别:analyze|describe"
}

plugin_help() {
    echo "用法: summ vision <子命令> <图片路径> [提示词]"
    echo ""
    echo "子命令:"
    echo "  analyze <图片> \"提示词\"   自定义分析（默认）"
    echo "  describe <图片>            描述图片内容"
    echo ""
    echo "环境变量 (或 summ config set):"
    echo "  ZHIPU_API_KEY      智谱 API Key (必需)"
    echo "  ZHIPU_BASE_URL     API 地址 (默认 https://open.bigmodel.cn/api/paas/v4)"
    echo "  MULTIMODAL_MODEL   模型名 (默认 glm-4.6v)"
    echo ""
    echo "示例:"
    echo "  summ vision analyze photo.jpg \"分析营养成分\""
    echo "  summ vision describe photo.jpg"
    echo "  summ vision photo.jpg \"这是什么？\""
    echo "  summ vision analyze photo.png --json"
}

_vision_request() {
    local image_path="$1"
    local prompt="$2"

    [[ -z "$image_path" ]] && summ_error "请提供图片路径"
    [[ ! -f "$image_path" ]] && summ_error "图片文件不存在: $image_path"

    local file_size
    file_size="$(stat -c%s "$image_path" 2>/dev/null || stat -f%z "$image_path" 2>/dev/null)"
    (( file_size > 20 * 1024 * 1024 )) && summ_error "图片文件过大（超过 20MB）"

    local api_key
    api_key="$(summ_config_get ZHIPU_API_KEY)"
    [[ -z "$api_key" ]] && summ_error "未配置 ZHIPU_API_KEY，运行 summ config set ZHIPU_API_KEY <value>"

    local base_url
    base_url="$(summ_config_get ZHIPU_BASE_URL 'https://open.bigmodel.cn/api/paas/v4')"
    local model
    model="$(summ_config_get MULTIMODAL_MODEL 'glm-4.6v')"

    # Detect MIME type
    local mime_type="image/jpeg"
    case "${image_path##*.}" in
        png)  mime_type="image/png" ;;
        gif)  mime_type="image/gif" ;;
        webp) mime_type="image/webp" ;;
        heic|heif) mime_type="image/heic" ;;
    esac

    # Build payload via temp file to avoid ARG_MAX on large base64
    local tmp
    tmp="$(mktemp)"
    trap 'rm -f "$tmp"' RETURN

    base64 -w0 "$image_path" | jq -R -s \
        --arg model "$model" \
        --arg prompt "$prompt" \
        --arg mime "$mime_type" \
        '{
            model: $model,
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: "你是一个图片分析助手，请根据用户要求分析图片内容。" },
                { role: "user", content: [
                    { type: "image_url", image_url: { url: ("data:" + $mime + ";base64," + .) } },
                    { type: "text", text: $prompt }
                ]}
            ]
        }' > "$tmp"

    local response
    response="$(curl -sf -X POST \
        "${base_url}/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${api_key}" \
        -d @"$tmp")" || summ_error "API 请求失败"

    # Extract content from response
    local content
    content="$(echo "$response" | jq -r '.choices[0].message.content // empty')"
    [[ -z "$content" ]] && summ_error "API 返回空内容"

    # Try to pretty-print if it's JSON
    if echo "$content" | jq -e . &>/dev/null; then
        echo "$content" | jq .
    else
        echo "$content"
    fi
}

cmd_analyze() {
    local image_path="$1"
    local prompt="$2"
    shift 2 2>/dev/null || true
    [[ -z "$prompt" ]] && prompt="请分析这张图片的内容，以 JSON 格式返回分析结果。"
    _vision_request "$image_path" "$prompt"
}

cmd_describe() {
    local image_path="$1"
    shift 2>/dev/null || true
    [[ -z "$image_path" ]] && summ_error "请提供图片路径"
    _vision_request "$image_path" "请描述这张图片的内容。"
}

cmd_default() {
    if [[ -z "$1" ]]; then
        summ_error "请提供图片路径，例如: summ vision analyze photo.jpg \"分析内容\""
    fi
    # treat first arg as image, second as prompt
    local image_path="$1"
    local prompt="$2"
    shift 2 2>/dev/null || true
    [[ -z "$prompt" ]] && prompt="请分析这张图片的内容，以 JSON 格式返回分析结果。"
    _vision_request "$image_path" "$prompt"
}
