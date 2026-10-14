import http from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('./dist/', import.meta.url);
const allowed = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/style.css', 'style.css'], ['/app.js', 'app.js'], ['/physics.js', 'physics.js']]);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const server = http.createServer(async (req, res) => {
  const name = allowed.get(new URL(req.url, 'http://localhost').pathname);
  if (!name || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return; }
  try {
    const data = await readFile(new URL(name, root));
    res.writeHead(200, { 'Content-Type': types[name.split('.').pop()] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Unable to read application file.'); }
});
server.on('error', e => { console.error(e.message); process.exitCode = 1; });
server.listen(4177, '127.0.0.1', () => console.log('BikeLab: http://127.0.0.1:4177'));
