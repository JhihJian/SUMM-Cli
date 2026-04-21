# SUMM-Cli

统一 API 工具集 CLI。

## 安装

```bash
sudo ./install.sh
```

## 使用

```bash
summ list                  # 查看可用插件
summ help <插件>           # 查看插件帮助
summ init                  # 初始化配置
summ config set KEY VALUE  # 设置配置
summ config get KEY        # 查看配置
```

## 添加新插件

在 `plugins/<name>/` 下创建:

1. `plugin.sh` — 实现 `plugin_info()` 和 `cmd_<子命令>()` 函数
2. `SKILL.md` — Claude Agent Skill 定义

无需修改核心代码，自动发现。

### plugin_info 格式

```
name:description:subcmd1|subcmd2|subcmd3
```

### 示例插件

```bash
#!/bin/bash
# plugins/my-plugin/plugin.sh

plugin_info() {
    echo "my-plugin:我的插件描述:action1|action2"
}

cmd_action1() {
    local key="$(summ_config_get MY_API_KEY)"
    [[ -z "$key" ]] && summ_error "未配置 MY_API_KEY"
    curl -sf "https://api.example.com/${key}/action1"
}

cmd_default() { cmd_action1 "$@"; }
```

## 配置

配置文件: `~/.summ/.env`

优先级: 环境变量 > 配置文件 > 默认值

## 输出格式

- 默认: TOON 格式（紧凑可读）
- `--json`: JSON 格式

## 项目结构

```
bin/summ          # 入口
lib/core.sh       # 核心函数
lib/output.sh     # 输出格式化
plugins/          # 插件目录
install.sh        # 安装脚本
```
