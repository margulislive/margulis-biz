const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const eventsFile = path.join(dataDir, 'events.json');
fs.mkdirSync(dataDir, { recursive: true });
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };
function send(res, status, body, type='application/json; charset=utf-8') { res.writeHead(status, { 'content-type':type, 'cache-control':'no-store' }); res.end(body); }
function admin(req, res) { const expected = `${process.env.ADMIN_LOGIN || ''}:${process.env.ADMIN_PASSWORD || ''}`; const got = Buffer.from((req.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString(); if (!expected || got !== expected) { res.writeHead(401, { 'www-authenticate':'Basic realm="Margulis admin"' }); res.end(); return false; } return true; }
function safeFile(url) { const file = url === '/' ? '/index.html' : decodeURIComponent(url); const full = path.resolve(root, '.' + file); return full.startsWith(root + path.sep) ? full : null; }
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin.html') { if (!admin(req, res)) return; url.pathname = '/admin.html'; }
  if (url.pathname === '/api/events') {
    if (req.method === 'GET') return send(res, 200, fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile) : '{}');
    if (req.method === 'PUT') { if (!admin(req, res)) return; let raw=''; req.on('data', c => { raw += c; if (raw.length > 2e6) req.destroy(); }); req.on('end', () => { try { const data = JSON.parse(raw); if (!Array.isArray(data.events)) throw Error(); fs.writeFileSync(eventsFile, JSON.stringify({ events:data.events }, null, 2)); send(res, 200, JSON.stringify({ ok:true })); } catch { send(res, 400, JSON.stringify({ error:'Некорректные данные' })); } }); return; }
    return send(res, 405, JSON.stringify({ error:'Method not allowed' }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', 'text/plain');
  const file = safeFile(url.pathname);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found', 'text/plain');
  res.writeHead(200, { 'content-type':types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end(); fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 8080);
