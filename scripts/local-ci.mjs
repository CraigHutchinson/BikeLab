import {spawnSync} from 'node:child_process';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const [level = 'quick', flag] = process.argv.slice(2);
const config = JSON.parse(readFileSync('.ci/local.json', 'utf8'));
if (!config.levels[level] || (flag && flag !== '--attest') || process.argv.length > 4)
  throw new Error('Usage: node scripts/local-ci.mjs quick|unit|full [--attest]');
if (Number(process.versions.node.split('.')[0]) !== config.nodeMajor)
  throw new Error(`Use Node ${config.nodeMajor}; found ${process.version}`);
if (flag && level === 'unit') throw new Error('unit coverage is not a full attestation');
const git = (...args) => {
  const r = spawnSync('git', args, {encoding: 'utf8'});
  if (r.status !== 0) throw new Error(r.stderr || 'git failed');
  return r.stdout.trim();
};
const head = git('rev-parse', 'HEAD');
const dirty = () => git('status', '--porcelain', '--untracked-files=normal');
const before = dirty();
if (flag && before) throw new Error('Attestation requires a clean checkout, including untracked source files');
const receipt = {schemaVersion: 1, level, head, clean: !before, node: process.version,
  platform: process.platform, arch: process.arch, startedAt: new Date().toISOString(), checks: [],
  coverage: level === 'full' ? 'local Node suite, pinned vendor hashes, idle records and browser receiving' :
    level === 'unit' ? 'local Node suite and pinned vendor hashes; no browser' :
      'selected quick tests and pinned vendor hashes; no full suite or browser', success: false};
for (const command of config.levels[level]) {
  console.log(`\n> ${command.join(' ')}`);
  const result = spawnSync(command[0] === 'node' ? process.execPath : command[0], command.slice(1),
    {stdio: 'inherit', timeout: 30 * 60 * 1000});
  receipt.checks.push({command, exitCode: result.status, error: result.error?.message ?? null});
  if (result.status !== 0) break;
}
receipt.finishedAt = new Date().toISOString();
receipt.success = receipt.checks.length === config.levels[level].length &&
  receipt.checks.every(c => c.exitCode === 0) && head === git('rev-parse', 'HEAD') && before === dirty();
mkdirSync('artifacts/ci', {recursive: true});
const path = resolve(`artifacts/ci/${level}.json`);
writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Receipt: ${path}`);
if (!receipt.success) process.exit(1);
if (flag) {
  // Publication is optional and never starts Actions. Confirm the exact commit exists remotely.
  const gh = (...args) => {
    const r = spawnSync('gh', args, {encoding: 'utf8'});
    if (r.status !== 0) throw new Error(r.stderr || 'gh failed');
    return r.stdout;
  };
  const repo = 'CraigHutchinson/BikeLab';
  gh('api', `repos/${repo}/commits/${head}`, '--jq', '.sha');
  const status = {state: 'success', context: `local-ci/${level}`,
    description: `Node ${process.versions.node} ${process.platform}/${process.arch}: ${level}; ${receipt.checks.length} checks`};
  const statusPath = resolve('artifacts/ci/status.json');
  writeFileSync(statusPath, JSON.stringify(status));
  gh('api', `repos/${repo}/statuses/${head}`, '--method', 'POST', '--input', statusPath);
  console.log(`Published ${status.context} on ${head}`);
}
