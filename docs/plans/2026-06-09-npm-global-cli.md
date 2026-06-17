# NPM Global CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use summ:executing-plans to implement this plan task-by-task.

**Goal:** 将 SUMM-Cli 重构为可通过 npm 全局安装的跨平台 CLI，并在本机验证 `summ notify "xxx"` 可运行。

**Architecture:** 使用一个 Node.js ESM 文件作为业务本体，通过 `package.json` 的 `bin.summ` 暴露命令。CLI 内置命令注册表替代 Bash 插件加载，配置继续使用用户目录下 `.summ/.env`，HTTP 请求使用 Node 内置 `fetch`。

**Tech Stack:** Node.js ESM、npm `bin`、Node 内置 `node:test`、Node 内置 `fetch`/`fs`/`os`/`path`。

---

### Task 1: 建立 npm CLI 测试边界

**Files:**
- Create: `tests/summ-cli.test.mjs`
- Create: `package.json`

**Steps:**
1. 写测试覆盖 `package.json` 的 `bin.summ`、`summ list`、`summ config set/get`、`summ notify send`。
2. 运行 `npm test`，预期因 Node CLI 尚未实现而失败。

### Task 2: 实现单文件 Node CLI

**Files:**
- Create: `summ.mjs`
- Modify: `package.json`

**Steps:**
1. 实现命令解析、全局 `--json`、配置读写、输出格式化。
2. 实现 `notify` 插件：支持 `send`、`test`、默认消息、ntfy 配置项、JSON 输出。
3. 实现 `weather`、`amap-geo`、`vision` 的基础 HTTP 行为，避免依赖 `curl/jq/base64/sed`。
4. 运行 `npm test`，预期测试通过。

### Task 3: 更新安装和使用说明

**Files:**
- Modify: `README.md`

**Steps:**
1. 将安装方式改为 `npm install -g .`。
2. 明确 `summ notify "xxx"` 的用法和 Node 版本要求。
3. 保留配置说明。

### Task 4: 本机验证

**Commands:**
- `npm test`
- `npm install -g .`
- `which summ`
- `summ list`
- `summ notify "npm 全局 CLI 验证完成"`

**Expected:** 命令均退出码为 0，`summ notify` 返回 `ok: true`。
