#!/bin/bash
# lib/output.sh — SUMM-Cli output formatting

# Format JSON data for display
# Uses TOON by default, JSON when SUMM_OUTPUT_JSON=true
summ_output() {
    local json_data="$1"

    if [[ -z "$json_data" ]]; then
        return
    fi

    if [[ "$SUMM_OUTPUT_JSON" == "true" ]]; then
        printf '%s\n' "$json_data" | jq .
    elif command -v toon &>/dev/null; then
        printf '%s\n' "$json_data" | toon
    elif command -v npx &>/dev/null; then
        printf '%s\n' "$json_data" | npx @toon-format/cli 2>/dev/null
    else
        printf '%s\n' "$json_data" | jq .
        echo "[提示] 安装 toon 以获得更好的输出: npm install -g @toon-format/cli" >&2
    fi
}

# Parse --json flag from arguments, strip it out
# Sets SUMM_OUTPUT_JSON and returns cleaned args in SUMM_CLEAN_ARGS
summ_parse_output_flag() {
    SUMM_OUTPUT_JSON="false"
    SUMM_CLEAN_ARGS=()

    local args=("$@")
    local i=0
    while [[ $i -lt ${#args[@]} ]]; do
        case "${args[$i]}" in
            --json)
                SUMM_OUTPUT_JSON="true"
                ;;
            *)
                SUMM_CLEAN_ARGS+=("${args[$i]}")
                ;;
        esac
        ((i++))
    done
}
