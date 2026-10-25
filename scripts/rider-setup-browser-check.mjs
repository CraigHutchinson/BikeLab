import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {riderSetupExample, riderSetupReceipt} from '../dist/rider-setup.js';
import {run} from '../dist/trail-bike.js';
import {compareCanonicalTrailRecord} from './trail-section-browser-check.mjs';

export async function checkRiderSetup({page, root, dir, report}) {
  const prefix = 'rider-setup';dir = join(dir, prefix);await mkdir(dir, {recursive: true});
  const reference = riderSetupExample(), cases = [];
  await page.setViewportSize({width: 1440, height: 1100});
  for (const bike of ['full', 'hardtail']) for (const fit of ['reference', 'changed']) {
    const setup = structuredClone(reference);setup.trail.bike.bike = bike;setup.trail.motion.duration = .02;
    if (fit === 'changed') {
      setup.placement.hip = [-.13, .29];setup.placement.trunkPitch = .60;
      setup.bikeMount.hand.position = [.46, .33];setup.bikeMount.foot.position = [.01, -.29];
    }
    const receipt = await riderSetupReceipt(setup), browserReceipt = await page.evaluate(async({root, setup}) =>
      (await import(root + 'rider-setup.js')).riderSetupReceipt(setup), {root, setup});
    assert.deepEqual(browserReceipt, receipt);
    assert.deepEqual(receipt.setup.rider, reference.rider);
    // Feed the compiled scenario to the existing visible consumer. The source
    // definition and receipt stay separate from the unchanged legacy record.
    await page.locator('#scenarioEditor').evaluate(el => {el.open = true;});
    await page.locator('#setupText').fill(JSON.stringify(browserReceipt.scenario));await page.locator('#applyJson').click();
    await page.waitForFunction(() => document.getElementById('status').textContent === 'COMPLETED', null, {timeout: 120000});
    const name = bike + '-' + fit, pending = page.waitForEvent('download');await page.locator('#save').click();
    const path = join(dir, name + '.json');await (await pending).saveAs(path);
    const actual = JSON.parse(await readFile(path, 'utf8')), expected = await run(receipt.scenario);
    const agreement = compareCanonicalTrailRecord(actual, expected);
    assert.equal(actual.massBudget.rider, 70);assert.equal(actual.massBudget.total, 83);
    assert.deepEqual(actual.scenario.articulated.passive.joints, reference.rider.joints);
    assert.deepEqual(actual.scenario.articulated.passive.posture.hand, setup.bikeMount.hand.position);
    assert.deepEqual(actual.scenario.articulated.passive.posture.foot, setup.bikeMount.foot.position);
    await page.locator('#scrub').fill(String(actual.frames.length - 1));
    await page.locator('#rig').screenshot({path: join(dir, name + '.png')});report.screenshots.push(prefix + '/' + name + '.png');
    await writeFile(join(dir, name + '-receipt.json'), JSON.stringify(receipt, null, 2));
    cases.push({bike, fit, riderIdentity: receipt.riderIdentity, worldIdentity: actual.initialState.identity,
      status: actual.status, steps: actual.summary.steps, agreement});
  }
  assert.equal(new Set(cases.map(c => c.riderIdentity)).size, 1);
  assert.equal(new Set(cases.map(c => c.worldIdentity)).size, 4);
  const before = await page.locator('#setupText').inputValue();
  const rejected = await page.evaluate(async({root, reference}) => {
    const {compileRiderSetup} = await import(root + 'rider-setup.js');reference.bikeMount.hand.position = [2, 2];
    try {compileRiderSetup(reference);return null;} catch (error) {return error.message;}
  }, {root, reference});
  assert.match(rejected, /unreachable/);assert.equal(await page.locator('#setupText').inputValue(), before);
  assert.ok(await page.locator('#save').isEnabled());
  report.riderSetup = {cases, scope: 'Setup-time reuse; unchanged Trail editor and runner. No detached actor or live transfer.'};
  report.checks.push('One portable rider definition on both bikes and two fits: browser/Node compiler receipt parity, existing JSON editor execution, complete-record comparison, unchanged body/laws, separate world identities and actual geometry captures.');
  await writeFile(join(dir, 'report.json'), JSON.stringify(report.riderSetup, null, 2));
}
