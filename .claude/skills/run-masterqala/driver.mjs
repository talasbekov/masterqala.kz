#!/usr/bin/env node
// Драйвер запуска MasterQala.kz: поднимает API+web, логинит клиента по OTP
// (код читается из лога API — SMS никуда не уходит) и водит браузер через CDP.
// Зависимостей нет: нужен Node >= 22 (глобальные fetch и WebSocket).
//
// node .claude/skills/run-masterqala/driver.mjs <команда>
//   setup            docker БД + pnpm install + prisma generate/migrate/seed + сборка ui
//   up               запустить api (:3000) и web (:5180) в фоне, дождаться готовности
//   down             остановить оба
//   logs [api|web]   хвост лога
//   login [phone]    OTP-логин клиента, печатает {accessToken,user}
//   smoke            сквозной API-сценарий: конфиг → категории → логин → плановая заявка
//   test             unit-тесты API
//   e2e              e2e-тесты API (сам убирает .env на время прогона)
//   shot [route] [out.png]  headless Chrome: логин, скриншот и текст страницы
//   all              setup + up + smoke + shot

import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SKILL_DIR, '../../..'); // <repo>/.claude/skills/run-masterqala → <repo>
const RUN_DIR = process.env.MQ_RUN_DIR ?? '/tmp/masterqala-run';
const API_PORT = Number(process.env.MQ_API_PORT ?? 3000);
const WEB_PORT = Number(process.env.MQ_WEB_PORT ?? 5180);
const API = `http://127.0.0.1:${API_PORT}/api/v1`;
const WEB = `http://localhost:${WEB_PORT}`;
const CDP_PORT = Number(process.env.MQ_CDP_PORT ?? 9333);
const COMPOSE_PROJECT = process.env.MQ_COMPOSE_PROJECT ?? 'masterqalakz';
const PHONE = process.env.MQ_PHONE ?? '+77010009911';

const log = (...a) => console.log(...a);
const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} → exit ${r.status}`);
}

async function waitFor(fn, { timeoutMs = 120_000, everyMs = 500, what = 'условия' } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await fn()) return true;
    } catch {
      /* ещё не поднялось */
    }
    if (Date.now() > until) die(`таймаут ожидания ${what}`);
    await sleep(everyMs);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON — отдаём как есть */
  }
  return { status: res.status, json, text };
}

// ── setup ────────────────────────────────────────────────────────────────────

function ensureEnv() {
  const envPath = `${ROOT}/apps/api/.env`;
  if (existsSync(envPath)) return log('· apps/api/.env уже есть');
  // НЕ копируем .env из главного чекаута: он обычно устарел и без обязательных
  // переменных (PORT, CORS_ORIGINS, …) API падает на config.getOrThrow.
  const example = readFileSync(`${ROOT}/apps/api/.env.example`, 'utf8');
  const patched = example
    .replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET="dev-only-secret-with-at-least-32-characters"')
    .replace(
      /^CORS_ORIGINS=.*$/m,
      `CORS_ORIGINS="http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}"`,
    )
    .replace(/^PORT=.*$/m, `PORT="${API_PORT}"`);
  writeFileSync(envPath, patched);
  log('· apps/api/.env создан из .env.example');
}

async function setup() {
  // Имя compose-проекта фиксируем: иначе из ворктри docker берёт его от имени
  // каталога и пытается поднять ВТОРУЮ пару контейнеров на тех же 5432/5433 →
  // «Bind for 0.0.0.0:5432 failed: port is already allocated». БД одна на все ворктри.
  sh('docker', ['compose', '-p', COMPOSE_PROJECT, 'up', '-d']);
  ensureEnv();
  sh('pnpm', ['install']);
  sh('pnpm', ['--filter', 'api', 'exec', 'prisma', 'generate']);
  sh('pnpm', ['--filter', '@masterqala/ui', 'build']);
  // migrate dev в неинтерактивной оболочке отказывается работать — только deploy.
  sh('pnpm', ['--filter', 'api', 'exec', 'prisma', 'migrate', 'deploy']);
  sh('pnpm', ['--filter', 'api', 'exec', 'prisma', 'db', 'seed']);
  log('✓ setup готов');
}

// ── up / down ────────────────────────────────────────────────────────────────

function startBg(name, cmd, args, cwd) {
  mkdirSync(RUN_DIR, { recursive: true });
  const logFile = `${RUN_DIR}/${name}.log`;
  rmSync(logFile, { force: true });
  const fd = openSync(logFile, 'a');
  const child = spawn(cmd, args, { cwd, detached: true, stdio: ['ignore', fd, fd] });
  child.unref();
  writeFileSync(`${RUN_DIR}/${name}.pid`, String(child.pid));
  log(`· ${name}: pid ${child.pid}, лог ${logFile}`);
}

async function up() {
  if (!existsSync(`${ROOT}/node_modules`)) die('нет node_modules — сначала `driver.mjs setup`');
  const apiUp = await api('/health')
    .then((r) => r.status === 200)
    .catch(() => false);
  // Порт API берётся из .env и один на все ворктри — второй инстанс не поднять.
  if (apiUp) log('· API уже слушает — переиспользую');
  else startBg('api', 'pnpm', ['--filter', 'api', 'start:dev'], ROOT);
  startBg('web', 'npx', ['vite', '--port', String(WEB_PORT), '--strictPort'], `${ROOT}/apps/web`);

  await waitFor(
    async () => (await fetch(`http://127.0.0.1:${API_PORT}/api/v1/health`)).status === 200,
    { what: 'API /health' },
  );
  log(`✓ API   ${API}`);
  await waitFor(async () => (await fetch(WEB)).status === 200, { what: 'web' });
  log(`✓ Web   ${WEB}`);
}

function down() {
  for (const name of ['api', 'web']) {
    const pidFile = `${RUN_DIR}/${name}.pid`;
    if (!existsSync(pidFile)) continue;
    const pid = Number(readFileSync(pidFile, 'utf8'));
    // start:dev/vite плодят детей — убиваем всю группу процессов.
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* уже мёртв */
      }
    }
    rmSync(pidFile, { force: true });
    log(`· ${name} остановлен (pid ${pid})`);
  }
}

// ── login ────────────────────────────────────────────────────────────────────

const SESSION_FILE = () => `${RUN_DIR}/session.json`;

function tokenAlive(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

async function login(phone = PHONE, { fresh = false } = {}) {
  // Сервер разрешает всего 3 запроса кода на номер за 10 минут, поэтому
  // рабочая сессия кэшируется на диске и переиспользуется между командами.
  const digits = (s) => String(s).replace(/\D/g, '');
  if (!fresh && existsSync(SESSION_FILE())) {
    const cached = JSON.parse(readFileSync(SESSION_FILE(), 'utf8'));
    if (digits(cached.user?.phone) === digits(phone) && tokenAlive(cached.accessToken)) {
      log(`· переиспользую сессию ${cached.user.phone}`);
      return cached;
    }
  }

  const req = await api('/auth/request-code', { method: 'POST', body: { phone } });
  if (req.status === 429)
    die(
      'лимит OTP: 3 кода на номер за 10 минут. Подождите или возьмите другой номер: ' +
        'MQ_PHONE=+77010009912 node .claude/skills/run-masterqala/driver.mjs …',
    );
  if (req.status !== 204) die(`request-code → ${req.status} ${req.text}`);

  // Код существует только в логе API: ConsoleSmsSender печатает его всегда,
  // в любом NODE_ENV. Ждём строку, она появляется с задержкой в пару сотен мс.
  const logFile = `${RUN_DIR}/api.log`;
  if (!existsSync(logFile)) die(`нет ${logFile} — API должен быть запущен через \`driver.mjs up\``);
  let code = null;
  await waitFor(
    () => {
      const lines = readFileSync(logFile, 'utf8')
        .split('\n')
        .filter((l) => l.includes(phone) && l.includes('код подтверждения'));
      const last = lines.at(-1);
      // Именно после «подтверждения:» — в начале строки Nest печатает pid,
      // который тоже шестизначный, и наивный /(\d{6})/ хватает его.
      const m = last?.match(/подтверждения:\s*(\d{6})/);
      if (m) code = m[1];
      return Boolean(code);
    },
    { timeoutMs: 15_000, everyMs: 300, what: 'OTP в логе API' },
  );

  const ver = await api('/auth/verify-code', { method: 'POST', body: { phone, code } });
  if (ver.status !== 200 && ver.status !== 201) die(`verify-code → ${ver.status} ${ver.text}`);
  writeFileSync(SESSION_FILE(), JSON.stringify(ver.json));
  return ver.json;
}

// ── smoke ────────────────────────────────────────────────────────────────────

async function smoke() {
  const health = await api('/health');
  if (health.status !== 200) die(`health → ${health.status}`);
  log('✓ /health');

  const cfg = await api('/config/public');
  if (cfg.status !== 200) die(`config/public → ${cfg.status}`);
  log(`✓ /config/public → ${JSON.stringify(cfg.json)}`);

  const cats = await api('/categories');
  if (cats.status !== 200 || !cats.json?.length) die(`categories → ${cats.status} ${cats.text}`);
  log(`✓ /categories → ${cats.json.length} шт.`);

  const auth = await login();
  log(`✓ логин ${auth.user.phone} → role=${auth.user.role}`);

  // Плановая заявка публикуется без мастеров рядом; срочная (POST /orders)
  // упала бы с 422 «Мастеров рядом нет» без MasterProfile + онлайн-присутствия.
  const slotStart = new Date(Date.now() + 24 * 3600_000);
  const slotEnd = new Date(slotStart.getTime() + 2 * 3600_000);
  const created = await api('/planned-orders', {
    method: 'POST',
    token: auth.accessToken,
    body: {
      categoryId: cats.json[0].id,
      description: 'Смоук-заявка драйвера: течёт смеситель на кухне',
      address: 'Астана, ул. Кабанбай батыра, 53',
      district: 'Есиль',
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      budget: 15000,
    },
  });
  if (created.status !== 201) die(`POST /planned-orders → ${created.status} ${created.text}`);
  log(`✓ плановая заявка ${created.json.id} (${created.json.status})`);

  const mine = await api('/planned-orders/mine', { token: auth.accessToken });
  if (mine.status !== 200) die(`planned-orders/mine → ${mine.status}`);
  const found = (mine.json.items ?? mine.json).some?.((o) => o.id === created.json.id);
  if (!found) die('созданная заявка не вернулась в /planned-orders/mine');
  log('✓ заявка видна в /planned-orders/mine');
  log('✓ smoke пройден');
  return { auth, plannedOrderId: created.json.id };
}

// ── тесты ────────────────────────────────────────────────────────────────────

function e2e() {
  // ConfigModule читает apps/api/.env даже в NODE_ENV=test, и наш dev-овский
  // COMMERCIAL_MODE=FREE_PILOT валит 34 теста (цены/оплаты/лид-кредиты ждут
  // PAID_MOCK). В CI файла .env просто нет — воспроизводим это: убираем на время
  // прогона. Экспорт COMMERCIAL_MODE=PAID_MOCK не спасает: тогда падает
  // commercial-mode.e2e-spec, который сам выставляет FREE_PILOT.
  const envPath = `${ROOT}/apps/api/.env`;
  const parked = `${envPath}.e2e-parked`;
  const had = existsSync(envPath);
  if (had) renameSync(envPath, parked);
  const r = spawnSync('pnpm', ['--filter', 'api', 'test:e2e'], { cwd: ROOT, stdio: 'inherit' });
  if (had) renameSync(parked, envPath);
  if (r.status !== 0) die(`e2e упали (exit ${r.status})`);
  log('✓ e2e пройдены');
}

// ── браузер через CDP ────────────────────────────────────────────────────────

const CHROME =
  process.env.MQ_CHROME ??
  ['google-chrome', 'chromium', 'chromium-browser'].find(
    (b) => spawnSync('which', [b]).status === 0,
  );

async function cdp() {
  if (!CHROME) die('не найден google-chrome/chromium');
  mkdirSync(RUN_DIR, { recursive: true });
  const fd = openSync(`${RUN_DIR}/chrome.log`, 'a');
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${RUN_DIR}/chrome-profile`,
      'about:blank',
    ],
    { detached: true, stdio: ['ignore', fd, fd] },
  );

  let target = null;
  await waitFor(
    async () => {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
      return Boolean(target?.webSocketDebuggerUrl);
    },
    { timeoutMs: 30_000, what: 'CDP-таргета' },
  );

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) events.push(msg.method);
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const mid = ++id;
      pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  return {
    send,
    events,
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) die(`JS: ${r.result.exceptionDetails.text}`);
      return r.result?.result?.value;
    },
    async goto(url) {
      events.length = 0;
      await send('Page.navigate', { url });
      await waitFor(() => events.includes('Page.loadEventFired'), {
        timeoutMs: 30_000,
        everyMs: 100,
        what: `загрузки ${url}`,
      });
      await sleep(1200); // React + первые запросы к API
    },
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    },
    close() {
      ws.close();
      try {
        process.kill(-chrome.pid, 'SIGTERM');
      } catch {
        /* уже мёртв */
      }
    },
  };
}

async function shot(route = '/', out = `${RUN_DIR}/masterqala.png`) {
  const auth = await login();
  const page = await cdp();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  // Мобильный вьюпорт: web — PWA, свёрстанная под телефон.
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // localStorage пишется только на origin приложения — сначала грузим его.
  await page.goto(WEB);
  await page.evaluate(
    `localStorage.setItem('token', ${JSON.stringify(auth.accessToken)});` +
      `localStorage.setItem('user', ${JSON.stringify(JSON.stringify(auth.user))});`,
  );
  await page.goto(`${WEB}${route}`);

  const title = await page.evaluate('document.title');
  const text = await page.evaluate('document.body.innerText');
  await page.screenshot(out);
  page.close();

  log(`✓ ${route} — «${title}»`);
  log('─── видимый текст ───');
  log(text.split('\n').filter(Boolean).slice(0, 30).join('\n'));
  log('─────────────────────');
  log(`✓ скриншот: ${out}`);
}

// ── entrypoint ───────────────────────────────────────────────────────────────

const [cmd = 'smoke', ...rest] = process.argv.slice(2);
switch (cmd) {
  case 'setup':
    await setup();
    break;
  case 'up':
    await up();
    break;
  case 'down':
    down();
    break;
  case 'logs': {
    const name = rest[0] ?? 'api';
    sh('tail', ['-n', rest[1] ?? '40', `${RUN_DIR}/${name}.log`]);
    break;
  }
  case 'login':
    log(JSON.stringify(await login(rest[0]), null, 2));
    break;
  case 'smoke':
    await smoke();
    break;
  case 'test':
    sh('pnpm', ['--filter', 'api', 'test']);
    break;
  case 'e2e':
    e2e();
    break;
  case 'shot':
    await shot(rest[0], rest[1]);
    break;
  case 'all':
    await setup();
    await up();
    await smoke();
    await shot();
    break;
  default:
    die(`неизвестная команда: ${cmd}`);
}
process.exit(0);
