import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Walk the static dependencies at a project-site URL, where root-absolute paths
// would accidentally request another site's assets instead of BikeLab's.
test('static page, modules and worker resolve under the Pages project path', async () => {
  const base = new URL('https://example.test/BikeLab/');
  const pending = [new URL('index.html', base)];
  const visited = new Set();
  while (pending.length) {
    const url = pending.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    assert.equal(url.origin, base.origin);
    assert.ok(url.pathname.startsWith(base.pathname), `Asset escapes project path: ${url}`);
    const name = url.pathname.slice(base.pathname.length) || 'index.html';
    if(name.endsWith('.wasm')){assert.ok((await readFile(new URL('../dist/'+name,import.meta.url))).length>0);continue;}
    if(name==='vendor/mujoco-3.16.0/mujoco.js'){pending.push(new URL('./mujoco.wasm',url));continue;}
    const source = await readFile(new URL('../dist/' + name, import.meta.url), 'utf8');
    // The pinned compat bundle embeds its WASM. A dead fallback URL in the
    // upstream bundle is not a fetch dependency; integrity and real loading are tested separately.
    if(name === 'vendor/rapier-0.21.0/rapier.mjs')continue;
    const pattern = name.endsWith('.html')
      ? /(?:href|src)=["']([^"']+)["']/g
      : (name.endsWith('.js') || name.endsWith('.mjs'))
        ? /(?:\bfrom\s*|\bimport\s*|\bnew URL\(\s*)["']([^"']+)["']/g
        : /url\(\s*["']?([^"'\s)]+)["']?\s*\)/g;
    for (const [, path] of source.matchAll(pattern)) {
      pending.push(new URL(path, url));
    }
  }
  for (const asset of ['footprint.html','footprint.js','footprint-app.js','footprint-worker.js','terrain-request.html','terrain-request.js','terrain-request-app.js','travel-buffer.js','bike.html','bike-app.js','rig-loads.js','linkage.js','geometry-catalogue.js','geometry-reference-app.js','bike-geometry.js','bike-rig.js','bike-worker.js','vendor/mujoco-3.16.0/mujoco.js','vendor/mujoco-3.16.0/mujoco.wasm','style.css', 'app.js', 'physics.js', 'calculation.js', 'ui-model.js', 'worker.js',
    'suspension.html', 'suspension-app.js', 'suspension-ui-model.js', 'suspension.js', 'suspension-reference.js', 'terrain.html', 'terrain.js', 'terrain-app.js', 'solver.html', 'solver-app.js', 'solver-config.js', 'solver-trial.js', 'solver-worker.js', 'vendor/rapier-0.21.0/rapier.mjs']) {
    assert.ok(visited.has(new URL(asset, base).href), `Unverified dependency: ${asset}`);
  }
});
