import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Walk the static dependencies at a project-site URL, where root-absolute paths
// would accidentally request another site's assets instead of BikeLab's.
test('static page, modules and worker resolve under the Pages project path', async () => {
  const base = new URL('https://example.test/BikeLab/');
  const pending = [new URL('index.html', base)];
  const visited = new Set();
  let stationLinks;
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
    const nav = name.endsWith('.html') && source.match(/<nav class="stations"[\s\S]*?<\/nav>/)?.[0];
    if (nav) {
      const links = [...nav.matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
      const destinations = links.map(([,href,,label]) => [href,label]);
      stationLinks ??= destinations;
      assert.deepEqual(destinations, stationLinks, `Inconsistent station navigation: ${name}`);
      assert.equal(new Set(links.map(([,href]) => href)).size, links.length);
      assert.deepEqual(links.filter(([, ,attributes]) => attributes.includes('aria-current="page"')).map(([,href]) => href), ['./'+name]);
    }
    // The pinned compat bundle embeds its WASM. A dead fallback URL in the
    // upstream bundle is not a fetch dependency; integrity and real loading are tested separately.
    if(name === 'vendor/rapier-0.21.0/rapier.mjs')continue;
    const pattern = name.endsWith('.html')
      ? /(?:href|src)=["']([^"']+)["']/g
      : (name.endsWith('.js') || name.endsWith('.mjs'))
        // Match this repository's import/export declarations, not the word
        // "from" in UI prose (for example 'Fresh run from '+mode).
        ? /(?:^\s*(?:import\s+(?:[^'";]*?\bfrom\s*)?|export\s+[^'";]*?\bfrom\s*)|\bnew URL\(\s*)["']([^"']+)["']/gm
        : /url\(\s*["']?([^"'\s)]+)["']?\s*\)/g;
    for (const [, path] of source.matchAll(pattern)) {
      pending.push(new URL(path, url));
    }
  }
  for (const asset of ['tyre-fixture-ui.js','tyre-fixture-observation.js','tyre-fixture.html','tyre-fixture.js','tyre-fixture-worker.js','tyre-fixture-app.js','tyre-fixture-examples.json','rider-pose-study.js','rider-pose-study-app.js','trail-bike.html','trail-bike.js','trail-initial-state.js','trail-section.js','trail-canonical.js','trail-bike-app.js','trail-bike-worker.js','moving-wheel.html','moving-wheel.js','moving-wheel-app.js','moving-wheel-worker.js','wheel-limits.html','wheel-limits.js','wheel-limits-app.js','wheel-limits-worker.js','footprint.html','footprint.js','footprint-app.js','footprint-worker.js','terrain-request.html','terrain-request.js','terrain-request-app.js','travel-buffer.js','bike.html','bike-app.js','rig-loads.js','linkage.js','geometry-catalogue.js','geometry-reference-app.js','bike-geometry.js','bike-assembly.js','bike-rig.js','bike-worker.js','vendor/mujoco-3.16.0/mujoco.js','vendor/mujoco-3.16.0/mujoco.wasm','style.css', 'app.js', 'physics.js', 'calculation.js', 'ui-model.js', 'worker.js',
    'suspension.html', 'suspension-app.js', 'suspension-ui-model.js', 'suspension.js', 'suspension-reference.js', 'terrain.html', 'terrain.js', 'terrain-app.js', 'solver.html', 'solver-app.js', 'solver-config.js', 'solver-trial.js', 'solver-worker.js', 'vendor/rapier-0.21.0/rapier.mjs']) {
    assert.ok(visited.has(new URL(asset, base).href), `Unverified dependency: ${asset}`);
  }
});
