import { simulate, replay } from './physics.js';
import * as suspension from './suspension.js';
import { compareSuspension } from './suspension-reference.js';
self.onmessage = event => {
  try {
    const start = performance.now();
    if (event.data.station !== undefined && !['wheel', 'suspension'].includes(event.data.station)) throw new Error('Unknown station.');
    const model = event.data.station === 'suspension' ? suspension : { simulate, replay };
    const run = event.data.text === undefined ? model.simulate(event.data.params) : model.replay(event.data.text);
    const comparison = event.data.station === 'suspension' ? compareSuspension(run) : undefined;
    const buffers = [...Object.values(run.signals), ...Object.values(comparison?.signals ?? {})].map(a => a.buffer);
    self.postMessage({ run, comparison, milliseconds: performance.now() - start }, [...new Set(buffers)]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
