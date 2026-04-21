#!/bin/bash
# install.sh — SUMM-Cli 系统安装器
# 幂等运行: 可多次执行，自动覆盖旧安装

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/usr/local/bin"

# 获取实际用户的 HOME 目录（支持 sudo）
ACTUAL_HOME="${HOME}"
if [[ -n "$SUDO_USER" ]]; then
    ACTUAL_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
fi
CLAUDE_SKILLS_DIR="$ACTUAL_HOME/.claude/skills"
SUMM_CONFIG_DIR="$ACTUAL_HOME/.summ"

echo "=== SUMM-Cli 安装 ==="

# 1. 安装 summ 命令
echo "[1/5] 安装 summ 到 $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
ln -sf "$SCRIPT_DIR/bin/summ" "$INSTALL_DIR/summ"
chmod +x "$SCRIPT_DIR/bin/summ"

# 2. 安装 TOON CLI
echo "[2/5] 检查 TOON CLI"
if ! command -v toon &>/dev/null; then
    if command -v npm &>/dev/null; then
        echo "       安装 @toon-format/cli..."
        npm install -g @toon-format/cli 2>/dev/null || echo "       安装失败，将使用 npx fallback"
    else
        echo "       未找到 npm，将使用 npx fallback"
    fi
else
    echo "       已安装: $(command -v toon)"
fi

# 3. 创建配置目录
echo "[3/5] 初始化配置目录"
mkdir -p "$SUMM_CONFIG_DIR"
if [[ ! -f "${SUMM_CONFIG_DIR}/.env" ]]; then
    cp "$SCRIPT_DIR/.env.example" "${SUMM_CONFIG_DIR}/.env"
    echo "       已创建配置文件: ${SUMM_CONFIG_DIR}/.env"
else
    echo "       配置文件已存在: ${SUMM_CONFIG_DIR}/.env"
fi

# 4. 安装 Claude Skills
echo "[4/5] 安装 Claude Skills"
for plugin_dir in "$SCRIPT_DIR"/plugins/*/; do
    [[ ! -f "${plugin_dir}SKILL.md" ]] && continue
    local_name="$(basename "$plugin_dir")"
    skill_target="${CLAUDE_SKILLS_DIR}/summ-${local_name}"
    mkdir -p "$skill_target"
    ln -sf "${plugin_dir}SKILL.md" "${skill_target}/SKILL.md"
    echo "       summ-${local_name} ✓"
done

# 5. 验证
echo "[5/5] 验证安装"
if command -v summ &>/dev/null; then
    echo ""
    summ help
    echo ""
    echo "安装成功: $(command -v summ)"
else
    echo "安装完成，但 summ 不在 PATH 中"
    echo "请将 $INSTALL_DIR 添加到 PATH"
fi
