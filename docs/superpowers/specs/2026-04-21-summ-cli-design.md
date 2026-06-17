# SUMM-Cli Design Spec

> 历史说明：本文档记录 2026-04-21 的 Bash 插件式架构设计。当前活跃运行时已经迁移到 npm/Node.js 单文件 CLI，维护入口请以 `CLAUDE.md`、`README.md` 和 `docs/plans/2026-06-09-npm-global-cli.md` 为准。

## Overview

SUMM-Cli is a plugin-based CLI framework that unifies local API tooling under a single `summ` command. It replaces scattered shell scripts with a structured, extensible system where adding a new API capability means creating one directory with two files.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Bash + shared function library | Consistent with existing scripts, minimal dependencies |
| Command style | Sub-command (`summ <plugin> [subcommand]`) | Single entry point, unified config, good discoverability |
| Plugin model | Directory auto-discovery (`plugins/<name>/`) | Adding a plugin = creating a directory, no registration needed |
| Config | `~/.summ/.env`, env vars take priority | Flexible: shell env overrides file, file provides defaults |
| Output format | Default TOON, `--json` to switch | TOON is compact and readable; JSON for piping |
| Install | `install.sh` → `/usr/local/bin/summ` | Same pattern as existing tools |
| Migration | Full rewrite of weather and amap-geo | Single source of truth going forward |

## Project Structure

```
/data/dev/SUMM-Cli/
├── bin/
│   └── summ                # Entry point (symlinked to /usr/local/bin/summ)
├── lib/
│   ├── core.sh             # Core: config loading, plugin discovery, command routing
│   └── output.sh           # Output: TOON/JSON formatting, fallback chain
├── plugins/
│   ├── weather/
│   │   ├── plugin.sh       # Implementation: cmd_daily, cmd_realtime, etc.
│   │   └── SKILL.md        # Claude Agent Skill definition
│   └── amap-geo/
│       ├── plugin.sh       # Implementation: cmd_default, etc.
│       └── SKILL.md
├── .env.example            # Config template
├── install.sh              # System installer
└── README.md
```

## Plugin Convention

Each plugin lives in `plugins/<name>/` and contains:

1. **`plugin.sh`** — implementation file with these required/optional functions:
   - `plugin_info()` — **required**. Returns colon-separated metadata: `name:description:subcommand1|subcommand2`
   - `cmd_<subcommand>()` — **required for each subcommand**. Executes the API call, outputs raw JSON to stdout
   - `cmd_default()` — **optional**. Called when no subcommand is specified
   - `plugin_help()` — **optional**. Returns detailed help text

2. **`SKILL.md`** — Claude Agent Skill definition with frontmatter and usage docs

**Rules:**
- Directory name = plugin name = first argument to `summ`
- Plugin outputs raw JSON to stdout; the core handles formatting
- Plugin reads config via `summ_config_get "KEY"` (never reads env vars directly)
- Plugin uses `summ_error "message"` for errors (stderr + exit 1)

**Example plugin skeleton:**
```bash
#!/bin/bash
# plugins/weather/plugin.sh

plugin_info() {
    echo "weather:彩云天气查询:realtime|daily|hourly|minutely"
}

cmd_daily() {
    local token="$(summ_config_get CAIYUN_TOKEN)"
    [[ -z "$token" ]] && summ_error "未配置 CAIYUN_TOKEN，运行 summ config set CAIYUN_TOKEN <value>"

    local lng="$(summ_config_get DEFAULT_LONGITUDE 116.4)"
    local lat="$(summ_config_get DEFAULT_LATITUDE 39.9)"
    local url="https://api.caiyunapp.com/v2.6/${token}/${lng},${lat}/daily"

    curl -sf "$url" || summ_error "API 请求失败: $url"
}
```

## Entry Point and Command Routing

`bin/summ` responsibilities:
1. Resolve its own directory (handle symlink)
2. Source `lib/core.sh` and `lib/output.sh`
3. Load config: environment variables first, `~/.summ/.env` as fallback
4. Parse arguments: `summ <command> [subcommand] [options] [args]`
5. Route to built-in command or plugin

**Built-in commands:**

| Command | Description |
|---------|-------------|
| `summ help` | List all plugins and their subcommands |
| `summ help <plugin>` | Show detailed help for a plugin |
| `summ init` | Create `~/.summ/` and copy `.env` template |
| `summ list` | List installed plugins (name + description) |
| `summ config get <key>` | Show a config value |
| `summ config set <key> <value>` | Set a config value in `~/.summ/.env` |

**Routing logic:**
```
$1 matches built-in (help|init|list|config) → execute built-in
$1 matches plugins/<name>/plugin.sh → source it, call cmd_$2 (or cmd_default)
no match → error: "未知命令: $1，运行 summ list 查看可用命令"
```

## Configuration

**File:** `~/.summ/.env`

**Format:** Shell-compatible key=value pairs
```bash
# API Keys
CAIYUN_TOKEN=your_token
AMAP_API_KEY=your_key

# Defaults
DEFAULT_LONGITUDE=116.4
DEFAULT_LATITUDE=39.9
```

**Priority:** environment variable > `~/.summ/.env` file > default value

**`summ_config_get` function:**
```bash
summ_config_get() {
    local key="$1"
    local default="${2:-}"
    # env var takes priority
    if [[ -n "${!key}" ]]; then
        echo "${!key}"
    elif [[ -n "$SUMM_CONFIG_LOADED" ]]; then
        # from .env file (loaded into SUMM_CONFIG_ prefixed vars)
        local file_val="$(grep "^${key}=" "$SUMM_ENV_FILE" 2>/dev/null | cut -d= -f2-)"
        echo "${file_val:-$default}"
    else
        echo "$default"
    fi
}
```

## Output Formatting

**`summ_output` function** handles JSON → display format conversion:

```bash
summ_output() {
    local json_data="$1"
    if [[ "$SUMM_OUTPUT_JSON" == "true" ]]; then
        echo "$json_data" | jq .
    elif command -v toon &>/dev/null; then
        echo "$json_data" | toon
    elif command -v npx &>/dev/null; then
        echo "$json_data" | npx @toon-format/cli
    else
        echo "$json_data" | jq .
        echo "[提示] 安装 toon 以获得更好的输出: npm install -g @toon-format/cli" >&2
    fi
}
```

**Call chain:**
- Plugin function outputs raw JSON
- Entry point captures stdout, passes to `summ_output`
- `--json` flag sets `SUMM_OUTPUT_JSON=true` before plugin execution

## Error Handling

- `summ_error "message"` — prints `[summ] 错误: message` to stderr, exits 1
- Plugins return non-zero on failure with error on stderr
- Core catches missing config, network failures, missing dependencies
- Curl failures use `-sf` flags (silent on success, fail on error)

## Help System

- `summ help` iterates `plugins/*/plugin.sh`, sources each, calls `plugin_info()`
- `summ help <plugin>` calls `plugin_help()` if defined, otherwise shows `plugin_info()` output + SKILL.md excerpt
- Output format: table with columns [Plugin] [Description] [Subcommands]

## Install Script

`install.sh` does:
1. Symlink `bin/summ` → `/usr/local/bin/summ`
2. Install TOON CLI if not present: `npm install -g @toon-format/cli`
3. Create `~/.summ/` directory
4. Copy `.env.example` → `~/.summ/.env` if not exists
5. Symlink each `plugins/*/SKILL.md` → `~/.claude/skills/summ-<name>/SKILL.md`
6. Verify: `summ help` runs successfully

Idempotent — safe to run multiple times.

## Plugin Migration Plan

### weather (from /data/app/base/weather/)
- Migrate `weather.sh` logic into `plugins/weather/plugin.sh`
- Subcommands: `realtime`, `daily`, `hourly`, `minutely`
- Config keys: `CAIYUN_TOKEN`, `DEFAULT_LONGITUDE`, `DEFAULT_LATITUDE`
- Adapt `SKILL.md` to reference `summ weather` commands

### amap-geo (from /data/app/base/amap-geo/)
- Migrate `amap-geo.sh` logic into `plugins/amap-geo/plugin.sh`
- Subcommands: `default` (geocode), `reverse` (reverse geocode — future)
- Config keys: `AMAP_API_KEY`
- Adapt `SKILL.md` to reference `summ amap-geo` commands
