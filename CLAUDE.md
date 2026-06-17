# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

SUMM-Cli is a cross-platform npm CLI that unifies API tooling under one `summ` command. The active runtime is the Node.js ESM entry point `summ.mjs`, exposed through the `package.json` `bin.summ` mapping.

The older Bash framework under `bin/`, `lib/`, and `plugins/*/plugin.sh` remains in the repository as migration reference. New runtime behavior should be implemented in `summ.mjs` unless a task explicitly targets the legacy Bash path.

## Commands

```bash
# Install locally as a global CLI
npm install -g .

# Run tests
npm test

# Run the CLI without global install
node summ.mjs list

# Common CLI commands
summ list
summ help <plugin>
summ init
summ config set KEY VALUE
summ config get KEY
summ notify "任务完成"
summ weather daily
summ amap-geo search "天安门"
summ vision describe photo.jpg
```

## Architecture

**Active entry point**: `summ.mjs`

**Command routing flow**:
1. Parse global `--json` flag.
2. Load config from environment and `~/.summ/.env`.
3. Route built-ins: `help`, `list`, `init`, `config`, `version`.
4. Route plugin-style commands from the in-file registry.
5. Print either compact readable text or pretty JSON.

**Configuration priority**: process environment > `~/.summ/.env` > defaults.

**Package metadata**: `package.json` defines package metadata, the `summ` bin entry, Node engine constraints, and the `npm test` script.

## Active Plugins

- `notify` sends ntfy notifications with optional Docker token fallback.
- `weather` calls Caiyun Weather API.
- `amap-geo` calls AMap geocoding and reverse geocoding APIs.
- `vision` calls Zhipu multimodal chat completions with local image files.

## Testing

Node tests live in `tests/summ-cli.test.mjs` and use `node:test`. They cover package bin metadata, executable mode, config read/write, plugin listing, ntfy request behavior, and Docker token fallback.

Before committing runtime changes, run:

```bash
npm test
```

Legacy Bash plugin tests may exist for migration reference, but they are not part of the active npm test script.
