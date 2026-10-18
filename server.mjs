import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('./dist/', import.meta.url);
const assets = ['footprint.html','footprint.js','footprint-app.js','footprint-worker.js','terrain-request.html','terrain-request.js','terrain-request-app.js','travel-buffer.js', 'bike.html', 'bike-app.js', 'rig-loads.js','linkage.js','geometry-catalogue.js','geometry-reference-app.js','bike-geometry.js', 'bike-rig.js', 'bike-worker.js', 'vendor/mujoco-3.16.0/mujoco.js', 'vendor/mujoco-3.16.0/mujoco.wasm', 'vendor/mujoco-3.16.0/LICENSE', 'vendor/mujoco-3.16.0/provenance.json', 'vendor/mujoco-3.16.0/NOTICES.txt', 'index.html', 'style.css', 'app.js', 'physics.js', 'worker.js', 'ui-model.js', 'calculation.js',
  'suspension.html', 'suspension.js', 'suspension-app.js', 'suspension-ui-model.js', 'suspension-reference.js', 'terrain.html', 'terrain.js', 'terrain-app.js', 'solver.html', 'solver-app.js', 'solver-config.js', 'solver-trial.js', 'solver-worker.js',
  'vendor/rapier-0.21.0/rapier.mjs', 'vendor/rapier-0.21.0/LICENSE', 'vendor/rapier-0.21.0/provenance.json'];
const allowed = new Map(assets.map(name => ['/' + name, name]));
allowed.set('/', 'index.html');
const types = { wasm: 'application/wasm', html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', LICENSE: 'text/plain' };

export function createPreviewServer() {
  return http.createServer(async (req, res) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { res.writeHead(400); res.end('Malformed request target.'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    const name = allowed.get(pathname);
    if (!name) { res.writeHead(404); res.end(); return; }
    try {
      const data = await readFile(new URL(name, root));
      res.writeHead(200, { 'Content-Type': (types[name.split('.').pop()] || 'text/plain') + (name.endsWith('.wasm') ? '' : '; charset=utf-8'),
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(500); res.end('Unable to read application file.'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createPreviewServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(4177, '127.0.0.1', () => console.log('BikeLab: http://127.0.0.1:4177'));
}
