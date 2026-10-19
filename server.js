const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const root = __dirname;
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const eventsFile = path.join(dataDir, 'events.json');
const contentFile = path.join(dataDir, 'content.json');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
function saveJson(file, value) { const temp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp'; fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); fs.renameSync(temp, file); }
const sessions = new Map();
const attempts = new Map();
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };
function send(res, status, body, type='application/json; charset=utf-8', extra={}) { res.writeHead(status, { 'content-type':type, 'cache-control':'no-store', 'x-content-type-options':'nosniff', ...extra }); res.end(body); }
function readJson(req, limit = 2e6) { return new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > limit) { reject(new Error('too large')); req.destroy(); } }); req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid json')); } }); req.on('error', reject); }); }
function getSession(req) { const match = /(?:^|;\s*)mbc_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || ''); if (!match) return false; const expires = sessions.get(match[1]); if (!expires || expires < Date.now()) { sessions.delete(match[1]); return false; } return true; }
function sameOrigin(req) { const origin = req.headers.origin; if (!origin) return false; try { return new URL(origin).host === req.headers.host; } catch { return false; } }
function auth(req, res) { if (getSession(req)) return true; send(res, 401, JSON.stringify({ error:'Требуется вход' })); return false; }
function serve(res, file, method) { if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', 'text/plain'); res.writeHead(200, { 'content-type':types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'x-content-type-options':'nosniff', 'cache-control':'no-store' }); if (method === 'HEAD') return res.end(); fs.createReadStream(file).pipe(res); }
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/login' && req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, JSON.stringify({ error:'Недопустимый запрос' }));
      const key = req.socket.remoteAddress || 'unknown'; const record = attempts.get(key) || { count:0, until:0 };
      if (record.until > Date.now()) return send(res, 429, JSON.stringify({ error:'Слишком много попыток. Попробуйте через 15 минут.' }));
      if (record.until && record.until <= Date.now()) { record.count = 0; record.until = 0; }
      const body = await readJson(req, 4096);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const configured = process.env.ADMIN_LOGIN && process.env.ADMIN_PASSWORD_HASH;
      let valid = false;
      if (configured && password.length <= 200) { try { valid = username === process.env.ADMIN_LOGIN && await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH.replace(/^\$2y\$/, '$2b$')); } catch {} }
      if (!valid) { record.count++; if (record.count >= 8) record.until = Date.now() + 15 * 60 * 1000; attempts.set(key, record); return send(res, configured ? 401 : 503, JSON.stringify({ error:configured ? 'Неверный email или пароль.' : 'Вход временно не настроен. Обратитесь к администратору.' })); }
      attempts.delete(key); const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
      const secure = process.env.NODE_ENV === 'test' ? '' : '; Secure';
      return send(res, 200, JSON.stringify({ ok:true }), undefined, { 'set-cookie':`mbc_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}` });
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') { if (!sameOrigin(req)) return send(res, 403, '{}'); const match = /(?:^|;\s*)mbc_session=([a-f0-9]{64})/.exec(req.headers.cookie || ''); if (match) sessions.delete(match[1]); return send(res, 200, '{}', undefined, { 'set-cookie':'mbc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure' }); }
    if ((url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin.html') && req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '{}');
    if (url.pathname === '/admin' || url.pathname === '/admin/') return serve(res, path.join(root, getSession(req) ? 'admin.html' : 'login.html'), req.method);
    if (url.pathname === '/admin.html') { if (!getSession(req)) { res.writeHead(303, { location:'/admin', 'cache-control':'no-store' }); return res.end(); } return serve(res, path.join(root, 'admin.html'), req.method); }
    if (url.pathname === '/api/events') {
      if (req.method === 'GET') return send(res, 200, fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile) : '{}');
      if (req.method === 'PUT') { if (!sameOrigin(req)) return send(res, 403, '{}'); if (!auth(req, res)) return; const data = await readJson(req); if (!Array.isArray(data.events)) return send(res, 400, JSON.stringify({ error:'Некорректные данные' })); saveJson(eventsFile, { events:data.events }); return send(res, 200, JSON.stringify({ ok:true })); }
      return send(res, 405, '{}');
    }
    if (url.pathname === '/api/content') {
      if (req.method === 'GET') return send(res, 200, fs.existsSync(contentFile) ? fs.readFileSync(contentFile) : '{}');
      if (req.method === 'PUT') { if (!sameOrigin(req)) return send(res, 403, '{}'); if (!auth(req, res)) return; const data = await readJson(req); if (!data || Array.isArray(data) || typeof data !== 'object') return send(res, 400, '{}'); saveJson(contentFile, data); return send(res, 200, '{"ok":true}'); }
      return send(res, 405, '{}');
    }
    if (url.pathname === '/api/upload' && req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, '{}'); if (!auth(req, res)) return;
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 10 * 1024 * 1024) return send(res, 413, JSON.stringify({error:'Максимальный размер фотографии — 10 МБ'})); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks); let ext;
      if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ext = '.jpg';
      else if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ext = '.png';
      else if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') ext = '.webp';
      else return send(res, 400, JSON.stringify({error:'Выберите изображение JPEG, PNG или WebP'}));
      const name = crypto.randomUUID() + ext; fs.writeFileSync(path.join(uploadsDir, name), bytes, { mode:0o600 });
      return send(res, 200, JSON.stringify({url:'/uploads/' + name}));
    }
    if (/^\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(url.pathname) && (req.method === 'GET' || req.method === 'HEAD')) return serve(res, path.join(uploadsDir, path.basename(url.pathname)), req.method);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', 'text/plain');
    const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    if (!/^\/(?:index\.html|event\.html|faq\.html|policy\.html|login\.html|assets\/[^.][^\0]*)$/.test(pathname)) return send(res, 404, 'Not found', 'text/plain');
    const file = path.resolve(root, '.' + pathname); if (!file.startsWith(root + path.sep) || (pathname.startsWith('/assets/') && !file.startsWith(path.join(root, 'assets') + path.sep))) return send(res, 404, 'Not found', 'text/plain');
    return serve(res, file, req.method);
  } catch { if (!res.headersSent) send(res, 400, JSON.stringify({ error:'Ошибка запроса' })); }
}).listen(process.env.PORT || 8080);
