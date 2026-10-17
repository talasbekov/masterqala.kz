'use strict';
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const categories = require('./fixtures.cjs').map(category => ({ id: `test-build-${category.slug}`, ...category }));

async function main() {
  // generateStaticParams reads categories during next build. The real API is a
  // runtime dependency, so supply only the shared synthetic taxonomy at build time.
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/api/v1/categories') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(categories));
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  try {
    const siteDir = resolve(__dirname, '../../apps/site');
    const siteRequire = createRequire(resolve(siteDir, 'package.json'));
    const code = await new Promise((resolveExit, reject) => {
      const child = spawn(process.execPath, [siteRequire.resolve('next/dist/bin/next'), 'build'], {
        cwd: siteDir,
        env: { ...process.env, NODE_ENV: 'production', API_URL: `http://127.0.0.1:${server.address().port}/api/v1` },
        stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('exit', code => resolveExit(code ?? 1));
    });
    process.exitCode = code;
  } finally {
    server.closeAllConnections();
    await new Promise(resolveClose => server.close(resolveClose));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
