import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(repoRoot, 'summ.mjs');

function runSumm(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...options.env },
    encoding: 'utf8'
  });
}

function runSummAsync(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...options.env }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function onceServer() {
  let resolveRequest;
  const requestPromise = new Promise((resolve) => {
    resolveRequest = resolve;
  });

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      resolveRequest({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id: 'mock-message', event: 'message', topic: req.url.slice(1) }));
    });
  });

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      resolveServer({
        port: server.address().port,
        readRequest: () => requestPromise,
        stop: () => new Promise((resolveClose) => server.close(resolveClose))
      });
    });
  });
}

describe('npm CLI metadata', () => {
  it('exposes summ through package.json bin', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
    assert.equal(pkg.type, 'module');
    assert.equal(pkg.bin.summ, './summ.mjs');
  });

  it('points the bin target at an executable file', async () => {
    const mode = (await stat(cliPath)).mode;
    assert.ok(mode & 0o111);
  });
});

describe('summ commands', () => {
  let tempHome;
  let env;

  before(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'summ-cli-test-'));
    env = {
      HOME: tempHome,
      USERPROFILE: tempHome,
      NTFY_TOKEN: '',
      NTFY_URL: '',
      NTFY_TOPIC: '',
      NTFY_TITLE: '',
      NTFY_PRIORITY: '',
      NTFY_TAGS: '',
      NTFY_TIMEOUT: ''
    };
  });

  after(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  it('lists built-in plugins', () => {
    const result = runSumm(['list'], { env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /notify\s+ntfy 通知发送/);
    assert.match(result.stdout, /weather\s+彩云天气查询/);
  });

  it('initializes and reads config values', async () => {
    await mkdir(join(tempHome, '.summ'), { recursive: true });
    const setResult = runSumm(['config', 'set', 'NTFY_TOPIC', 'ops-alerts'], { env });
    assert.equal(setResult.status, 0, setResult.stderr);

    const getResult = runSumm(['config', 'get', 'NTFY_TOPIC'], { env });
    assert.equal(getResult.status, 0, getResult.stderr);
    assert.equal(getResult.stdout.trim(), 'ops-alerts');

    const envFile = await readFile(join(tempHome, '.summ', '.env'), 'utf8');
    assert.match(envFile, /^NTFY_TOPIC=ops-alerts$/m);
  });

  it('sends notify messages through fetch and returns JSON', async () => {
    const server = await onceServer();
    try {
      const notifyEnv = {
        ...env,
        NTFY_TOKEN: 'tk_test_token',
        NTFY_URL: `http://127.0.0.1:${server.port}`,
        NTFY_TOPIC: 'ops-alerts',
        NTFY_TITLE: 'SUMM Test',
        NTFY_PRIORITY: 'urgent',
        NTFY_TAGS: 'warning,robot',
        NTFY_TIMEOUT: '5'
      };

      const result = await runSummAsync(['notify', 'send', '磁盘空间不足', '--json'], { env: notifyEnv });
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.ok, true);
      assert.equal(output.topic, 'ops-alerts');
      assert.match(output.message, /^当前设备IP: .+\n运行CLI命令目录名称: SUMM-Cli\n\n磁盘空间不足$/);

      const request = await server.readRequest();
      assert.equal(request.method, 'POST');
      assert.equal(request.url, '/ops-alerts');
      assert.equal(request.headers.authorization, 'Bearer tk_test_token');
      assert.equal(request.headers.title, 'SUMM Test');
      assert.equal(request.headers.priority, 'urgent');
      assert.equal(request.headers.tags, 'warning,robot');
      assert.match(request.body, /^当前设备IP: .+\n运行CLI命令目录名称: SUMM-Cli\n\n磁盘空间不足$/);
    } finally {
      await server.stop();
    }
  });

  it('falls back to docker token when NTFY_TOKEN is missing', async () => {
    const server = await onceServer();
    const binDir = join(tempHome, 'bin');
    const dockerPath = join(binDir, 'docker');
    await mkdir(binDir, { recursive: true });
    await writeFile(dockerPath, [
      '#!/usr/bin/env sh',
      'printf "user token\\ntk_from_docker fallback\\n"'
    ].join('\n'), 'utf8');
    await chmod(dockerPath, 0o755);

    try {
      const notifyEnv = {
        ...env,
        PATH: `${binDir}${delimiter}${process.env.PATH}`,
        NTFY_TOKEN: '',
        NTFY_URL: `http://127.0.0.1:${server.port}`,
        NTFY_TOPIC: 'ops-alerts'
      };

      const result = await runSummAsync(['notify', 'send', 'docker fallback', '--json'], { env: notifyEnv });
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.ok, true);

      const request = await server.readRequest();
      assert.equal(request.headers.authorization, 'Bearer tk_from_docker');
      assert.match(request.body, /^当前设备IP: .+\n运行CLI命令目录名称: SUMM-Cli\n\ndocker fallback$/);
    } finally {
      await server.stop();
    }
  });
});
