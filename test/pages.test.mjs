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
    const source = await readFile(new URL('../dist/' + name, import.meta.url), 'utf8');
    const pattern = name.endsWith('.html')
      ? /(?:href|src)=["']([^"']+)["']/g
      : name.endsWith('.js')
        ? /(?:\bfrom\s*|\bimport\s*|\bnew URL\(\s*)["']([^"']+)["']/g
        : /url\(\s*["']?([^"'\s)]+)["']?\s*\)/g;
    for (const [, path] of source.matchAll(pattern)) {
      pending.push(new URL(path, url));
    }
  }
  for (const asset of ['style.css', 'app.js', 'physics.js', 'calculation.js', 'ui-model.js', 'worker.js']) {
    assert.ok(visited.has(new URL(asset, base).href), `Unverified dependency: ${asset}`);
  }
});
