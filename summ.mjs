#!/usr/bin/env node

import { constants as fsConstants } from 'node:fs';
import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  readFile,
  stat,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const VERSION = '0.1.0';
const DEFAULT_CONFIG = {
  NTFY_URL: 'http://127.0.0.1:8200',
  NTFY_TOPIC: 'zhengming_notify',
  NTFY_USER_NAME: 'jhihjian',
  NTFY_TITLE: '通知',
  NTFY_PRIORITY: 'default',
  NTFY_TAGS: '',
  NTFY_TIMEOUT: '10',
  DEFAULT_LONGITUDE: '116.4',
  DEFAULT_LATITUDE: '39.9',
  ZHIPU_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
  MULTIMODAL_MODEL: 'glm-4.6v'
};

const execFileAsync = promisify(execFile);

const plugins = {
  'amap-geo': {
    name: 'amap-geo',
    description: '高德地图地理编码',
    subcommands: ['search', 'reverse'],
    help: [
      '用法: summ amap-geo <子命令> [选项]',
      '',
      '子命令:',
      '  search "地址" [-c 城市]   地理编码（地址 → 坐标）',
      '  reverse "经度,纬度"        逆地理编码（坐标 → 地址）',
      '',
      '环境变量 (或 summ config set):',
      '  AMAP_API_KEY   高德地图 Web 服务 API Key (必需)'
    ].join('\n'),
    commands: {
      search: cmdAmapSearch,
      reverse: cmdAmapReverse,
      default: cmdAmapDefault
    }
  },
  notify: {
    name: 'notify',
    description: 'ntfy 通知发送',
    subcommands: ['send', 'test'],
    help: [
      '用法: summ notify <子命令> [消息]',
      '',
      '子命令:',
      '  send "消息"   发送通知（默认）',
      '  test          发送测试通知',
      '',
      '环境变量 (或 summ config set):',
      '  NTFY_TOKEN       ntfy 访问 Token (必需)',
      '  NTFY_URL         ntfy 服务地址 (默认 http://127.0.0.1:8200)',
      '  NTFY_TOPIC       ntfy topic (默认 zhengming_notify)',
      '  NTFY_TITLE       通知标题 (默认 通知)',
      '  NTFY_PRIORITY    通知优先级 (默认 default)',
      '  NTFY_TAGS        通知标签 (默认空)',
      '  NTFY_TIMEOUT     请求超时时间，秒 (默认 10)'
    ].join('\n'),
    commands: {
      send: cmdNotifySend,
      test: cmdNotifyTest,
      default: cmdNotifyDefault
    }
  },
  vision: {
    name: 'vision',
    description: '图片分析识别',
    subcommands: ['analyze', 'describe'],
    help: [
      '用法: summ vision <子命令> <图片路径> [提示词]',
      '',
      '子命令:',
      '  analyze <图片> "提示词"   自定义分析（默认）',
      '  describe <图片>            描述图片内容',
      '',
      '环境变量 (或 summ config set):',
      '  ZHIPU_API_KEY      智谱 API Key (必需)',
      '  ZHIPU_BASE_URL     API 地址 (默认 https://open.bigmodel.cn/api/paas/v4)',
      '  MULTIMODAL_MODEL   模型名 (默认 glm-4.6v)'
    ].join('\n'),
    commands: {
      analyze: cmdVisionAnalyze,
      describe: cmdVisionDescribe,
      default: cmdVisionDefault
    }
  },
  weather: {
    name: 'weather',
    description: '彩云天气查询',
    subcommands: ['realtime', 'daily', 'hourly', 'minutely'],
    help: [
      '用法: summ weather <子命令> [经度] [纬度]',
      '',
      '子命令:',
      '  realtime    实时天气',
      '  daily       逐日预报 (默认)',
      '  hourly      逐小时预报',
      '  minutely    分钟级降水',
      '',
      '环境变量 (或 summ config set):',
      '  CAIYUN_TOKEN        彩云天气 API Token (必需)',
      '  DEFAULT_LONGITUDE   经度 (默认 116.4)',
      '  DEFAULT_LATITUDE    纬度 (默认 39.9)'
    ].join('\n'),
    commands: {
      realtime: (ctx, args) => weatherRequest(ctx, 'realtime', args),
      daily: (ctx, args) => weatherRequest(ctx, 'daily', args),
      hourly: (ctx, args) => weatherRequest(ctx, 'hourly', args),
      minutely: (ctx, args) => weatherRequest(ctx, 'minutely', args),
      default: (ctx, args) => weatherRequest(ctx, 'daily', args)
    }
  }
};

class SummError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

function userHome() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function configFilePath() {
  return path.join(userHome(), '.summ', '.env');
}

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const equalIndex = line.indexOf('=');
    if (equalIndex < 1) {
      continue;
    }
    const key = line.slice(0, equalIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadConfig() {
  const envFile = configFilePath();
  let fileValues = {};
  if (await pathExists(envFile)) {
    fileValues = parseEnv(await readFile(envFile, 'utf8'));
  }

  return {
    envFile,
    values: { ...DEFAULT_CONFIG, ...fileValues, ...cleanProcessEnv(process.env) }
  };
}

function cleanProcessEnv(env) {
  const values = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.length > 0) {
      values[key] = value;
    }
  }
  return values;
}

function getConfig(ctx, key, defaultValue = '') {
  return ctx.config.values[key] ?? defaultValue;
}

async function setConfig(key, value) {
  if (!key) {
    throw new SummError('config set 需要 key 参数');
  }
  if (!value) {
    throw new SummError('config set 需要 value 参数');
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new SummError(`无效的配置键名: ${key}`);
  }

  const envFile = configFilePath();
  await mkdir(path.dirname(envFile), { recursive: true });
  let values = {};
  if (await pathExists(envFile)) {
    values = parseEnv(await readFile(envFile, 'utf8'));
  }
  values[key] = value;
  const content = Object.entries(values)
    .map(([itemKey, itemValue]) => `${itemKey}=${itemValue}`)
    .join('\n') + '\n';
  await writeFile(envFile, content, 'utf8');
}

function parseArgs(argv) {
  const cleanArgs = [];
  let json = false;
  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
    } else {
      cleanArgs.push(arg);
    }
  }
  return { args: cleanArgs, json };
}

function printHelp(pluginName) {
  if (pluginName) {
    const plugin = plugins[pluginName];
    if (!plugin) {
      throw new SummError(`未知插件: ${pluginName}`);
    }
    console.log(`summ ${plugin.name} — ${plugin.description}`);
    console.log('');
    console.log(`子命令: ${plugin.subcommands.join(', ')}`);
    console.log('');
    console.log(plugin.help);
    return;
  }

  console.log('SUMM-Cli — 统一 API 工具集');
  console.log('');
  console.log('用法: summ <插件> [子命令] [选项] [参数]');
  console.log('      summ <内置命令> [参数]');
  console.log('');
  console.log('内置命令:');
  console.log('  help [插件]      显示帮助信息');
  console.log('  list             列出已安装插件');
  console.log('  init             初始化配置');
  console.log('  config get KEY   查看配置');
  console.log('  config set K V   设置配置');
  console.log('  version          显示版本');
  console.log('');
  console.log('全局选项:');
  console.log('  --json           输出 JSON 格式');
  console.log('');
  console.log('可用插件:');
  printPluginList();
}

function printPluginList() {
  for (const plugin of Object.values(plugins)) {
    console.log(`  ${plugin.name.padEnd(15)} ${plugin.description}`);
  }
}

async function initConfig() {
  const envFile = configFilePath();
  await mkdir(path.dirname(envFile), { recursive: true });
  if (!(await pathExists(envFile))) {
    const lines = [
      '# SUMM-Cli 配置文件',
      'NTFY_URL=http://127.0.0.1:8200',
      'NTFY_TOPIC=zhengming_notify',
      'NTFY_TOKEN=',
      'CAIYUN_TOKEN=',
      'AMAP_API_KEY=',
      'ZHIPU_API_KEY='
    ];
    await writeFile(envFile, `${lines.join('\n')}\n`, 'utf8');
    console.log(`已创建配置文件: ${envFile}`);
  } else {
    console.log(`配置文件已存在: ${envFile}`);
  }
}

async function requestJson(url, options = {}) {
  const timeoutSeconds = Number(options.timeoutSeconds || 30);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(timeoutSeconds, 1) * 1000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new SummError(`API 请求失败: ${url} (${response.status}) ${text}`.trim());
    }
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (error) {
    if (error instanceof SummError) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new SummError(`API 请求超时: ${url}`);
    }
    throw new SummError(`API 请求失败: ${url} (${error.message})`);
  } finally {
    clearTimeout(timer);
  }
}

async function cmdNotifySend(ctx, args) {
  const message = args[0] || '';
  if (!message) {
    throw new SummError('请输入通知消息');
  }
  return notifyRequest(ctx, message);
}

async function cmdNotifyTest(ctx) {
  return notifyRequest(ctx, '[OpsAgent] 测试告警');
}

async function cmdNotifyDefault(ctx, args) {
  if (args[0]) {
    return cmdNotifySend(ctx, args);
  }
  return cmdNotifyTest(ctx, args);
}

async function notifyRequest(ctx, message) {
  const ntfyUrl = getConfig(ctx, 'NTFY_URL', DEFAULT_CONFIG.NTFY_URL);
  const topic = getConfig(ctx, 'NTFY_TOPIC', DEFAULT_CONFIG.NTFY_TOPIC);
  let token = getConfig(ctx, 'NTFY_TOKEN', '');
  const userName = getConfig(ctx, 'NTFY_USER_NAME', DEFAULT_CONFIG.NTFY_USER_NAME);
  const title = getConfig(ctx, 'NTFY_TITLE', DEFAULT_CONFIG.NTFY_TITLE);
  const priority = getConfig(ctx, 'NTFY_PRIORITY', DEFAULT_CONFIG.NTFY_PRIORITY);
  const tags = getConfig(ctx, 'NTFY_TAGS', '');
  const timeout = getConfig(ctx, 'NTFY_TIMEOUT', DEFAULT_CONFIG.NTFY_TIMEOUT);

  if (!token) {
    token = await dockerNtfyToken(userName);
  }

  if (!token) {
    throw new SummError('未找到 NTFY_TOKEN。请运行 summ config set NTFY_TOKEN <token>，或确认 ntfy 容器可访问。');
  }

  const publishUrl = `${ntfyUrl.replace(/\/+$/, '')}/${topic.replace(/^\/+/, '')}`;
  const headers = {
    Authorization: `Bearer ${token}`
  };
  if (isByteString(title)) {
    headers.Title = title;
  }
  if (isByteString(priority)) {
    headers.Priority = priority;
  }
  if (tags && isByteString(tags)) {
    headers.Tags = tags;
  }

  const response = await requestJson(publishUrl, {
    method: 'POST',
    headers,
    body: message,
    timeoutSeconds: Number(timeout)
  });

  return {
    ok: true,
    topic,
    url: publishUrl,
    title,
    priority,
    tags,
    message,
    response
  };
}

function isByteString(value) {
  return [...String(value)].every((char) => char.codePointAt(0) <= 255);
}

async function dockerNtfyToken(userName) {
  try {
    const { stdout } = await execFileAsync('docker', [
      'exec',
      'ntfy',
      'sh',
      '-lc',
      'ntfy token list "$1" 2>/dev/null | awk "/tk_/ {print \\$2; exit}"',
      'sh',
      userName
    ], {
      timeout: 5000,
      windowsHide: true
    });
    return extractToken(stdout);
  } catch {
    return '';
  }
}

function extractToken(text) {
  const match = text.match(/\btk_[A-Za-z0-9._-]+\b/);
  return match ? match[0] : '';
}

async function weatherRequest(ctx, endpoint, args) {
  const token = getConfig(ctx, 'CAIYUN_TOKEN', '');
  if (!token) {
    throw new SummError('未配置 CAIYUN_TOKEN，运行 summ config set CAIYUN_TOKEN <value>');
  }
  const longitude = args[0] || getConfig(ctx, 'DEFAULT_LONGITUDE', DEFAULT_CONFIG.DEFAULT_LONGITUDE);
  const latitude = args[1] || getConfig(ctx, 'DEFAULT_LATITUDE', DEFAULT_CONFIG.DEFAULT_LATITUDE);
  const url = `https://api.caiyunapp.com/v2.6/${encodeURIComponent(token)}/${encodeURIComponent(longitude)},${encodeURIComponent(latitude)}/${endpoint}`;
  return requestJson(url);
}

async function cmdAmapSearch(ctx, args) {
  let address = '';
  let city = '';
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-c' || arg === '--city') {
      city = args[i + 1] || '';
      i += 1;
    } else {
      address = arg;
    }
  }

  if (!address) {
    throw new SummError('请输入地址');
  }

  const apiKey = getConfig(ctx, 'AMAP_API_KEY', '');
  if (!apiKey) {
    throw new SummError('未配置 AMAP_API_KEY，运行 summ config set AMAP_API_KEY <value>');
  }

  const url = new URL('https://restapi.amap.com/v3/geocode/geo');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('address', address);
  url.searchParams.set('output', 'JSON');
  if (city) {
    url.searchParams.set('city', city);
  }
  return requestJson(url);
}

async function cmdAmapReverse(ctx, args) {
  const location = args[0] || '';
  if (!location) {
    throw new SummError('请输入坐标，格式: 经度,纬度');
  }

  const apiKey = getConfig(ctx, 'AMAP_API_KEY', '');
  if (!apiKey) {
    throw new SummError('未配置 AMAP_API_KEY，运行 summ config set AMAP_API_KEY <value>');
  }

  const url = new URL('https://restapi.amap.com/v3/geocode/regeo');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location', location);
  url.searchParams.set('output', 'JSON');
  return requestJson(url);
}

async function cmdAmapDefault(ctx, args) {
  if (!args[0]) {
    throw new SummError('请输入地址，例如: summ amap-geo search "天安门"');
  }
  return cmdAmapSearch(ctx, args);
}

async function cmdVisionAnalyze(ctx, args) {
  const imagePath = args[0] || '';
  const prompt = args[1] || '请分析这张图片的内容，以 JSON 格式返回分析结果。';
  return visionRequest(ctx, imagePath, prompt);
}

async function cmdVisionDescribe(ctx, args) {
  const imagePath = args[0] || '';
  return visionRequest(ctx, imagePath, '请描述这张图片的内容。');
}

async function cmdVisionDefault(ctx, args) {
  if (!args[0]) {
    throw new SummError('请提供图片路径，例如: summ vision analyze photo.jpg "分析内容"');
  }
  return visionRequest(ctx, args[0], args[1] || '请分析这张图片的内容，以 JSON 格式返回分析结果。');
}

async function visionRequest(ctx, imagePath, prompt) {
  if (!imagePath) {
    throw new SummError('请提供图片路径');
  }

  let fileStats;
  try {
    fileStats = await stat(imagePath);
  } catch {
    throw new SummError(`图片文件不存在: ${imagePath}`);
  }
  if (fileStats.size > 20 * 1024 * 1024) {
    throw new SummError('图片文件过大（超过 20MB）');
  }

  const apiKey = getConfig(ctx, 'ZHIPU_API_KEY', '');
  if (!apiKey) {
    throw new SummError('未配置 ZHIPU_API_KEY，运行 summ config set ZHIPU_API_KEY <value>');
  }

  const baseUrl = getConfig(ctx, 'ZHIPU_BASE_URL', DEFAULT_CONFIG.ZHIPU_BASE_URL);
  const model = getConfig(ctx, 'MULTIMODAL_MODEL', DEFAULT_CONFIG.MULTIMODAL_MODEL);
  const imageBuffer = await readFile(imagePath);
  const mimeType = imageMimeType(imagePath);
  const payload = {
    model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是一个图片分析助手，请根据用户要求分析图片内容。' },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`
            }
          },
          { type: 'text', text: prompt }
        ]
      }
    ]
  };

  const response = await requestJson(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new SummError('API 返回空内容');
  }
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }
  return content;
}

function imageMimeType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.heic':
    case '.heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

async function route(ctx, args) {
  const command = args[0] || 'help';
  const rest = args.slice(1);

  switch (command) {
    case 'help':
      printHelp(rest[0]);
      return undefined;
    case 'list':
      printPluginList();
      return undefined;
    case 'init':
      await initConfig();
      return undefined;
    case 'version':
    case '--version':
    case '-v':
      console.log(VERSION);
      return undefined;
    case 'config':
      await routeConfig(rest);
      return undefined;
    default:
      return routePlugin(ctx, command, rest);
  }
}

async function routeConfig(args) {
  const action = args[0] || '';
  switch (action) {
    case 'get': {
      const key = args[1] || '';
      if (!key) {
        throw new SummError('用法: summ config get <KEY>');
      }
      const ctx = { config: await loadConfig() };
      const value = getConfig(ctx, key, '');
      console.log(value || '(未设置)');
      return;
    }
    case 'set': {
      const key = args[1] || '';
      const value = args[2] || '';
      await setConfig(key, value);
      console.log(`已设置 ${key}`);
      return;
    }
    default:
      throw new SummError(`未知 config 操作: ${action || '空'}。使用 get 或 set`);
  }
}

async function routePlugin(ctx, pluginName, args) {
  const plugin = plugins[pluginName];
  if (!plugin) {
    throw new SummError(`未知命令: ${pluginName}，运行 summ list 查看可用命令`);
  }

  const subcommand = args[0] || '';
  if (subcommand && plugin.commands[subcommand]) {
    return plugin.commands[subcommand](ctx, args.slice(1));
  }
  if (plugin.commands.default) {
    return plugin.commands.default(ctx, args);
  }
  if (subcommand) {
    throw new SummError(`未知子命令: ${subcommand}`);
  }
  printHelp(pluginName);
  return undefined;
}

function printResult(result, jsonOutput) {
  if (typeof result === 'undefined') {
    return;
  }
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(toReadableOutput(result));
}

function toReadableOutput(value, depth = 0) {
  if (value === null) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      const rendered = toReadableOutput(item, depth + 1);
      return `${'  '.repeat(depth)}- ${indentMultiline(rendered, depth + 1).trimStart()}`;
    }).join('\n');
  }
  return Object.entries(value).map(([key, item]) => {
    if (item && typeof item === 'object') {
      return `${'  '.repeat(depth)}${key}:\n${toReadableOutput(item, depth + 1)}`;
    }
    return `${'  '.repeat(depth)}${key}: ${item === null ? 'null' : String(item)}`;
  }).join('\n');
}

function indentMultiline(text, depth) {
  const indent = '  '.repeat(depth);
  return text.split('\n').map((line, index) => index === 0 ? line : `${indent}${line}`).join('\n');
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const ctx = {
    config: await loadConfig(),
    jsonOutput: parsed.json
  };
  const result = await route(ctx, parsed.args);
  printResult(result, parsed.json);
}

main().catch((error) => {
  if (error instanceof SummError) {
    console.error(`[summ] 错误: ${error.message}`);
    process.exit(error.exitCode);
  }
  console.error(`[summ] 错误: ${error.stack || error.message}`);
  process.exit(1);
});
