import { simulate, replay } from './physics.js';
self.onmessage = event => {
  try {
    const start = performance.now();
    const run = event.data.text === undefined ? simulate(event.data.params) : replay(event.data.text);
    self.postMessage({ run, milliseconds: performance.now() - start }, Object.values(run.signals).map(a => a.buffer));
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
