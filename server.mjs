import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 4173);
let updating = false;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const sendFile = async (res, file) => {
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not found' }));
  }
};

function runUpdate() {
  if (updating) return Promise.resolve(false);
  updating = true;
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(root, 'src', 'update.mjs')], { cwd: root, stdio: 'inherit' });
    child.on('exit', code => { updating = false; resolve(code === 0); });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/data') {
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY)) {
      try {
        const { readNbaData } = await import('./supabase.mjs');
        const data = await readNbaData();
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(data));
        return;
      } catch (e) {
        console.warn('Supabase読み込みスキップ、JSONにフォールバック:', e.message);
      }
    }
    return sendFile(res, path.join(root, 'data', 'nba-data.json'));
  }
  if (url.pathname === '/api/update' && req.method === 'POST') {
    if (updating) { res.writeHead(409); return res.end('更新中'); }
    const ok = await runUpdate();
    res.writeHead(ok ? 200 : 500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok }));
    return;
  }
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const target = path.resolve(publicDir, relative);
  if (!target.startsWith(publicDir)) { res.writeHead(403); return res.end(); }
  return sendFile(res, target);
}).listen(port, '127.0.0.1', () => {
  console.log(`NBA Dashboard: http://127.0.0.1:${port}`);
  setInterval(() => runUpdate(), UPDATE_INTERVAL_MS).unref();
  fs.readFile(path.join(root, 'data', 'nba-data.json'), 'utf8')
    .then(raw => {
      const age = Date.now() - new Date(JSON.parse(raw).meta.updatedAt).getTime();
      if (age > 60 * 60 * 1000) { console.log('データが古いため起動時更新を開始'); runUpdate(); }
    })
    .catch(() => { console.log('データファイルなし、起動時更新を開始'); runUpdate(); });
});
