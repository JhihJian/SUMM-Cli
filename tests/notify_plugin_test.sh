#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

export HOME="$TMP_DIR/home"
mkdir -p "$HOME/.summ" "$TMP_DIR/bin"

cat > "$TMP_DIR/bin/curl" <<'STUB'
#!/bin/bash
set -euo pipefail
printf '%s\n' "$@" > "$CURL_ARGS_FILE"
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
    if [[ "${args[$i]}" == "--config" && $((i + 1)) -lt ${#args[@]} ]]; then
        cat "${args[$((i + 1))]}" > "$CURL_CONFIG_CAPTURE"
    fi
done
cat > "$CURL_BODY_FILE"
printf '{"id":"mock-message","time":123,"event":"message","topic":"%s"}\n' "${NTFY_TOPIC:-unknown}"
STUB
chmod +x "$TMP_DIR/bin/curl"

cat > "$TMP_DIR/bin/docker" <<'STUB'
#!/bin/bash
exit 1
STUB
chmod +x "$TMP_DIR/bin/docker"

export PATH="$TMP_DIR/bin:/usr/bin:/bin"
export CURL_ARGS_FILE="$TMP_DIR/curl.args"
export CURL_BODY_FILE="$TMP_DIR/curl.body"
export CURL_CONFIG_CAPTURE="$TMP_DIR/curl.config"

fail() {
    echo "FAIL: $1" >&2
    exit 1
}

assert_contains() {
    local file="$1"
    local expected="$2"
    grep -Fq -- "$expected" "$file" || {
        echo "Expected to find: $expected" >&2
        echo "Actual content:" >&2
        cat "$file" >&2
        exit 1
    }
}

assert_not_contains() {
    local file="$1"
    local unexpected="$2"
    if grep -Fq -- "$unexpected" "$file"; then
        echo "Did not expect to find: $unexpected" >&2
        echo "Actual content:" >&2
        cat "$file" >&2
        exit 1
    fi
}

cat > "$HOME/.summ/.env" <<'ENV'
NTFY_TOKEN=tk_test_token
NTFY_URL=https://ntfy.example.test
NTFY_TOPIC=ops-alerts
NTFY_TITLE=SUMM Test
NTFY_PRIORITY=urgent
NTFY_TAGS=warning,robot
NTFY_TIMEOUT=7
ENV

"$ROOT_DIR/bin/summ" list > "$TMP_DIR/list.out"
grep -Fq "notify" "$TMP_DIR/list.out" || fail "notify plugin should be listed"

"$ROOT_DIR/bin/summ" notify send "磁盘空间不足" --json > "$TMP_DIR/send.out"

assert_contains "$TMP_DIR/curl.args" "--max-time"
assert_contains "$TMP_DIR/curl.args" "7"
assert_contains "$TMP_DIR/curl.config" "Authorization: Bearer tk_test_token"
assert_contains "$TMP_DIR/curl.args" "Title: SUMM Test"
assert_contains "$TMP_DIR/curl.args" "Priority: urgent"
assert_contains "$TMP_DIR/curl.args" "Tags: warning,robot"
assert_contains "$TMP_DIR/curl.args" "https://ntfy.example.test/ops-alerts"
assert_contains "$TMP_DIR/curl.body" "当前设备IP: "
assert_contains "$TMP_DIR/curl.body" "运行CLI命令目录名称: SUMM-Cli"
assert_contains "$TMP_DIR/curl.body" "磁盘空间不足"
jq -e '.ok == true and .topic == "ops-alerts"' "$TMP_DIR/send.out" >/dev/null

cat > "$HOME/.summ/.env" <<'ENV'
NTFY_TOKEN=tk_test_token
NTFY_URL=https://ntfy.example.test
NTFY_TOPIC=ops-alerts
ENV

"$ROOT_DIR/bin/summ" notify send "默认标题" --json > "$TMP_DIR/default-title.out"

assert_contains "$TMP_DIR/curl.args" "Title: 通知"
assert_contains "$TMP_DIR/curl.args" "Priority: default"
assert_not_contains "$TMP_DIR/curl.args" "Tags:"
jq -e '.title == "通知" and .priority == "default" and .tags == ""' "$TMP_DIR/default-title.out" >/dev/null

cat > "$HOME/.summ/.env" <<'ENV'
NTFY_URL=https://ntfy.example.test
NTFY_TOPIC=ops-alerts
ENV

if "$ROOT_DIR/bin/summ" notify send "missing token" --json > "$TMP_DIR/missing.out" 2> "$TMP_DIR/missing.err"; then
    fail "notify should fail without token"
fi
assert_contains "$TMP_DIR/missing.err" "未找到 NTFY_TOKEN"

echo "notify plugin tests passed"
