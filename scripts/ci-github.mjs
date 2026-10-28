import {readFileSync, appendFileSync} from 'node:fs';
import {mergePolicy, latestStatus, fullRequested} from './ci-policy.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const mode = process.argv[2];
const api = async (path, body) => {
  const r = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    method: body ? 'POST' : 'GET', headers: {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
    body: body ? JSON.stringify(body) : undefined});
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${path}`);
  return r.json();
};
const list = async path => {
  const values = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    values.push(...batch);
    if (batch.length < 100) return values;
  }
};
const statuses = sha => list(`commits/${sha}/statuses`);
const target = event.pull_request?.head.sha ?? process.env.GITHUB_SHA;
const output = (key, value) => appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
const post = (sha, context, result) => api(`statuses/${sha}`, {context, ...result,
  target_url: `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`});
const smokePassed = async sha => {
  const runs = await api(`actions/workflows/smoke.yml/runs?head_sha=${sha}&per_page=100`);
  const latest = runs.workflow_runs[0];
  if (!latest || latest.conclusion !== 'success') return false;
  const jobs = await api(`actions/runs/${latest.id}/jobs?per_page=100`);
  return jobs.jobs.some(j => j.name === 'Smoke' && j.conclusion === 'success');
};
const policy = async sha => {
  const pulls = (await list('pulls?state=open')).filter(p => p.head.sha === sha);
  if (!pulls.length) return;
  const state = await statuses(sha);
  const smoke = await smokePassed(sha);
  // All open PRs at this SHA must pass; a release PR cannot inherit a weaker PR's decision.
  const decisions = pulls.map(p => mergePolicy({smoke, full: latestStatus(state, 'ci/full'),
    local: latestStatus(state, 'local-ci/full'), labels: p.labels.map(l => l.name)}));
  await post(sha, 'ci/policy', decisions.find(d => d.state !== 'success') ?? decisions[0]);
};
if (mode === 'full-plan') {
  const success = latestStatus(await statuses(target), 'ci/full');
  output('sha', target);
  output('run', fullRequested(process.env.GITHUB_EVENT_NAME, event, success));
} else if (mode === 'full-result') {
  const sha = process.env.TESTED_SHA;
  const ok = process.env.UNIT_RESULT === 'success' && process.env.BROWSER_RESULT === 'success';
  await post(sha, 'ci/full', {state: ok ? 'success' : 'failure',
    description: ok ? 'Node full: Linux, Windows, macOS; Chromium; vendor hashes' : 'Full validation failed or was cancelled'});
  await policy(sha);
} else if (mode === 'policy') {
  const sha = event.pull_request?.head.sha ?? event.workflow_run?.head_sha ?? event.sha;
  if (!sha) throw new Error('Missing policy target SHA');
  await policy(sha);
} else if (mode === 'pages-guard') {
  const main = (await api('git/ref/heads/main')).object.sha;
  if (!latestStatus(await statuses(main), 'ci/full')) throw new Error('Current main lacks hosted full validation');
  output('sha', main);
} else throw new Error(`Unknown mode: ${mode}`);
