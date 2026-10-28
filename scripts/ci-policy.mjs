// Pure policy decisions shared with local tests; API orchestration lives in ci-github.mjs.
export function mergePolicy({smoke, full, local, labels}) {
  if (!smoke) return {state: 'failure', description: 'Exact-head smoke has not passed'};
  if (full) return {state: 'success', description: 'Exact-head smoke and hosted full passed'};
  if (labels.includes('ci:release'))
    return {state: 'failure', description: 'Release PR requires hosted full validation'};
  if (labels.includes('ci:local-verified') && local)
    return {state: 'success', description: 'Exact-head smoke and local full passed'};
  return {state: 'failure', description: 'Need hosted full or labelled exact-head local full'};
}

export function latestStatus(statuses, context) {
  // The REST API returns newest first. Never let an older success mask a newer failure.
  return statuses.find(s => s.context === context)?.state === 'success';
}

export function fullRequested(eventName, event, successfulFull) {
  if (eventName === 'schedule') return !successfulFull;
  if (eventName === 'pull_request') return (event.action !== 'labeled' ||
    ['ci:full', 'ci:release'].includes(event.label?.name)) && event.pull_request.head.repo?.full_name ===
    event.repository.full_name && event.pull_request.labels.some(l => ['ci:full', 'ci:release'].includes(l.name));
  return eventName === 'workflow_dispatch' || (eventName === 'push' &&
    /^refs\/tags\/(v|milestone\/)/.test(event.ref));
}
