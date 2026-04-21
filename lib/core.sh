#!/bin/bash
# lib/core.sh — SUMM-Cli core functions

# Resolve SUMM_HOME: directory where bin/summ lives (handles symlinks)
_resolve_summ_home() {
    local source="${BASH_SOURCE[0]}"
    while [[ -L "$source" ]]; do
        local dir="$(cd -P "$(dirname "$source")" && pwd)"
        source="$(readlink "$source")"
        [[ "$source" != /* ]] && source="$dir/$source"
    done
    SUMM_HOME="$(cd -P "$(dirname "$source")/.." && pwd)"
}

# Print error to stderr and exit 1
summ_error() {
    echo "[summ] 错误: $1" >&2
    exit 1
}

# Load config from ~/.summ/.env (env vars take priority)
_summ_load_config() {
    SUMM_ENV_FILE="${HOME}/.summ/.env"
    if [[ -f "$SUMM_ENV_FILE" ]]; then
        set -a
        # shellcheck disable=SC1090
        while IFS='=' read -r key value; do
            [[ -z "$key" || "$key" == \#* ]] && continue
            # Only set if not already in environment
            if [[ -z "${!key}" ]]; then
                export "$key=$value"
            fi
        done < "$SUMM_ENV_FILE"
        set +a
    fi
    SUMM_CONFIG_LOADED=true
}

# Get config value: env var > .env file > default
summ_config_get() {
    local key="$1"
    local default="${2:-}"
    if [[ -n "${!key}" ]]; then
        echo "${!key}"
    elif [[ -f "${SUMM_ENV_FILE:-$HOME/.summ/.env}" ]]; then
        local file_val
        file_val="$(grep "^${key}=" "$SUMM_ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)"
        echo "${file_val:-$default}"
    else
        echo "$default"
    fi
}

# Set config value in ~/.summ/.env
summ_config_set() {
    local key="$1"
    local value="$2"
    local env_file="${HOME}/.summ/.env"

    [[ -z "$key" ]] && summ_error "config set 需要 key 参数"
    [[ -z "$value" ]] && summ_error "config set 需要 value 参数"

    mkdir -p "$(dirname "$env_file")"

    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
    else
        echo "${key}=${value}" >> "$env_file"
    fi
}

# Discover all plugin directories
_summ_discover_plugins() {
    local plugins_dir="${SUMM_HOME}/plugins"
    if [[ ! -d "$plugins_dir" ]]; then
        return
    fi
    for plugin_dir in "$plugins_dir"/*/; do
        [[ -f "${plugin_dir}plugin.sh" ]] && echo "${plugin_dir}"
    done
}

# Initialize core
_resolve_summ_home
