import test from 'node:test';
import assert from 'node:assert/strict';
import {mergePolicy, latestStatus, fullRequested} from '../scripts/ci-policy.mjs';

test('merge gate needs smoke and exact-head full evidence, with a release override', () => {
  const baseline = {smoke: true, full: false, local: false, labels: []};
  assert.equal(mergePolicy(baseline).state, 'failure');
  assert.equal(mergePolicy({...baseline, full: true}).state, 'success');
  assert.equal(mergePolicy({...baseline, full: true, smoke: false}).state, 'failure');
  assert.equal(mergePolicy({...baseline, local: true}).state, 'failure');
  assert.equal(mergePolicy({...baseline, labels: ['ci:local-verified']}).state, 'failure');
  const local = {...baseline, local: true, labels: ['ci:local-verified']};
  assert.equal(mergePolicy(local).state, 'success');
  assert.equal(mergePolicy({...local, labels: [...local.labels, 'ci:release']}).state, 'failure');
  assert.equal(mergePolicy({...local, full: true, labels: ['ci:release']}).state, 'success');
});

test('newest status wins and unrelated contexts cannot authorize a merge', () => {
  assert.equal(latestStatus([], 'ci/full'), false);
  assert.equal(latestStatus([{context: 'local-ci/full', state: 'success'}], 'ci/full'), false);
  assert.equal(latestStatus([{context: 'ci/full', state: 'failure'},
    {context: 'ci/full', state: 'success'}], 'ci/full'), false);
  assert.equal(latestStatus([{context: 'ci/full', state: 'pending'},
    {context: 'ci/full', state: 'success'}], 'ci/full'), false);
});

test('weekly full skips an already verified head; explicit requests can rerun it', () => {
  assert.equal(fullRequested('schedule', {}, true), false);
  assert.equal(fullRequested('schedule', {}, false), true);
  assert.equal(fullRequested('workflow_dispatch', {}, true), true);
  assert.equal(fullRequested('push', {ref: 'refs/heads/main'}, false), false);
  assert.equal(fullRequested('push', {ref: 'refs/tags/v1.0'}, false), true);
  assert.equal(fullRequested('push', {ref: 'refs/tags/milestone/rider'}, false), true);
});

test('full PR jobs require an explicit label and cannot execute forks with write credentials', () => {
  const event = {repository: {full_name: 'a/b'}, pull_request: {
    head: {repo: {full_name: 'a/b'}}, labels: []}};
  assert.equal(fullRequested('pull_request', event, false), false);
  event.pull_request.labels = [{name: 'ci:full'}];
  assert.equal(fullRequested('pull_request', event, false), true);
  event.pull_request.labels = [{name: 'ci:release'}];
  assert.equal(fullRequested('pull_request', event, false), true);
  event.action = 'labeled';
  event.label = {name: 'documentation'};
  assert.equal(fullRequested('pull_request', event, false), false);
  event.label.name = 'ci:full';
  assert.equal(fullRequested('pull_request', event, false), true);
  event.pull_request.head.repo.full_name = 'fork/b';
  assert.equal(fullRequested('pull_request', event, false), false);
});
