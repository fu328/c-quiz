#!/usr/bin/env node
/**
 * 本地静态服务器：把 dist 目录跑在 http://127.0.0.1:5180
 * 之所以需要它，是因为浏览器在 file:// 下无法使用 IndexedDB / Worker。
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
const basePort = Number(process.env.PORT || 5180);
const openBrowser = !process.argv.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.gz': 'application/octet-stream',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = resolve(join(root, normalize(decoded)));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

const server = createServer(async (req, res) => {
  try {
    let filePath = safePath(req.url || '/');
    if (!filePath) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      // SPA 兜底
      filePath = join(root, 'index.html');
      info = await stat(filePath).catch(() => null);
      if (!info) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('未找到页面，请先执行 pnpm build');
        return;
      }
    }
    const ext = extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': isHtml ? 'no-store' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`服务器错误：${err?.message ?? err}`);
  }
});

function listen(port, retriesLeft = 10) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
      listen(port + 1, retriesLeft - 1);
      return;
    }
    console.error('启动失败：', err.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log('');
    console.log('  C 语言刷题助手已启动');
    console.log(`  地址：${url}`);
    console.log('  关闭这个窗口即可停止服务。');
    console.log('');
    if (openBrowser) {
      const cmd =
        process.platform === 'win32'
          ? `start "" "${url}"`
          : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;
      exec(cmd, () => {});
    }
  });
}

listen(basePort);
