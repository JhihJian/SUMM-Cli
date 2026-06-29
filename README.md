# SUMM-Cli

统一 API 工具集 CLI。

SUMM-Cli 现在是 npm 全局安装式 CLI。业务本体是单个跨平台 Node.js 文件 `summ.mjs`，通过 npm 的 `bin` 机制在 Windows、macOS、Linux 上生成 `summ` 命令入口。

## 要求

- Node.js 18.17 或更高版本
- npm

## 安装

```bash
npm install -g .
```

## 使用

```bash
summ notify "任务完成"      # 发送通知
summ list                  # 查看可用插件
summ help <插件>           # 查看插件帮助
summ init                  # 初始化配置
summ config set KEY VALUE  # 设置配置
summ config get KEY        # 查看配置
```

`summ notify` 发送正文时，会在用户消息前自动补充两行上下文：当前设备 IP、运行 CLI 命令的目录名称。

## 添加新插件

当前 npm 单文件本体的命令注册在 `summ.mjs` 内。新增跨平台命令时，应优先使用 Node.js 标准库实现，避免依赖 Bash、curl、jq、sed 等 Unix 工具。

旧 Bash 插件目录仍保留为迁移参考：

1. `plugin.sh` — 实现 `plugin_info()` 和 `cmd_<子命令>()` 函数
2. `SKILL.md` — Claude Agent Skill 定义

## 配置

配置文件: `~/.summ/.env`

优先级: 环境变量 > 配置文件 > 默认值

## 输出格式

- 默认: 紧凑可读文本
- `--json`: JSON 格式

## 项目结构

```
summ.mjs          # 跨平台 CLI 本体
package.json      # npm 包配置和 bin 映射
tests/            # Node.js 测试
plugins/          # 旧 Bash 插件，迁移参考
bin/              # 旧 Bash 入口，迁移参考
```
