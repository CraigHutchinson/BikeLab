// Diagnostic only: compare a saved browser record with Node and isolate model construction.
// Requires the optional Playwright tooling; this does not change an acceptance budget.
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createPreviewServer} from '../server.mjs';
import {modelXML, replay, ARTICULATED_MODEL} from '../dist/trail-bike.js';
import {getRuntime} from '../dist/moving-wheel.js';

const [input, output, ...extra] = process.argv.slice(2);
if (!input || !output || extra.length) throw Error('Usage: node scripts/rider-portability-review.mjs browser-record.json report.json');
if ((await stat(input)).size > 8 * 1024 * 1024) throw Error('Input exceeds 8 MiB.');
const raw = await readFile(input), record = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
assert.equal(record.model, ARTICULATED_MODEL);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const budget = 1e-9;
function compare(actual, expected) {
  let max = {normalized: 0}; const over = [];
  function walk(a, b, path = 'record') {
    if (typeof a === 'number') {
      assert.ok(Number.isFinite(a) && Number.isFinite(b), path);
      const error = Math.abs(a - b), normalized = error / Math.max(1, Math.abs(b));
      if (normalized > max.normalized) max = {path, actual: a, expected: b, error, normalized};
      if (normalized > budget) over.push({path, error, normalized});
    } else if (a && typeof a === 'object') {
      assert.ok(b && typeof b === 'object', path);
      assert.equal(Array.isArray(a), Array.isArray(b), path);
      assert.deepEqual(Object.keys(a), Object.keys(b), path);
      for (const key of Object.keys(a)) walk(a[key], b[key], path + '.' + key);
    } else assert.equal(a, b, path);
  }
  walk(actual, expected); over.sort((a, b) => b.normalized - a.normalized);
  return {max, exceedingBudget: over.length, worst: over.slice(0, 12)};
}
const require = createRequire(import.meta.url); let chromium;
try {({chromium} = require('playwright'));} catch {({chromium} = require('playwright-core'));}
const server = createPreviewServer(); let browser;
try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  browser = await chromium.launch({headless: true, executablePath: process.env.BIKELAB_CHROMIUM || undefined});
  const page = await browser.newPage(); await page.goto('http://127.0.0.1:' + server.address().port + '/');
  // Confirm that the supplied record was produced by this browser/model path.
  const fresh = await page.evaluate(async r => (await import('./trail-bike.js')).replay(r), record);
  const reproduction = compare(record, fresh);
  assert.equal(reproduction.max.normalized, 0, 'Input must reproduce exactly in the selected browser before attributing its differences.');
  const xmlBrowser = await page.evaluate(async a => (await import('./trail-bike.js')).modelXML(a), record.scenario);
  const xmlNode = modelXML(record.scenario), node = await replay(record);
  const tokens = x => x.split(/(\s+|[<>])/), a = tokens(xmlBrowser), b = tokens(xmlNode), differences = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) differences.push({index: i, browser: a[i] ?? null, node: b[i] ?? null});
  const mj = await getRuntime(), original = mj.MjModel.from_xml_string;
  const model = original(xmlBrowser); let used = false, matched;
  try {
    // Construct before replacing the Embind overload dispatcher. run owns/deletes the model once returned.
    mj.MjModel.from_xml_string = () => {assert.ok(!used); used = true; return model;};
    matched = await replay(record);
  } finally {mj.MjModel.from_xml_string = original; if (!used) model.delete();}
  const result = {format: 'bikelab-rider-portability-review-0.1', node: process.version, browser: browser.version(),
    scope: 'Diagnostic of this saved scenario; no calibration, production changes, tolerance relaxation or general portability guarantee.',
    inputRecordSha256: hash(raw), scriptSha256: hash(await readFile(new URL(import.meta.url))), scenario: record.scenario,
    budget, browserReproduction: reproduction, modelXMLExact: xmlBrowser === xmlNode,
    xmlSha256: {browser: hash(xmlBrowser), node: hash(xmlNode)}, xmlTokenDifferences: differences,
    ordinary: compare(record, node), matchedXML: compare(record, matched),
    control: 'Node replay uses the exact browser-produced native XML through a temporary model factory substitution. JavaScript observation/configuration remains Node-generated. The factory is restored in finally.'};
  await mkdir(dirname(output), {recursive: true}); await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({browser: result.browser, differences: differences.length, ordinary: result.ordinary.max, matchedXML: result.matchedXML.max}));
} finally {
  await browser?.close(); server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
