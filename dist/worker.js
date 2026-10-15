import { simulate, replay } from './physics.js';
import * as suspension from './suspension.js';
self.onmessage = event => {
  try {
    const start = performance.now();
    if (event.data.station !== undefined && !['wheel', 'suspension'].includes(event.data.station)) throw new Error('Unknown station.');
    const model = event.data.station === 'suspension' ? suspension : { simulate, replay };
    const run = event.data.text === undefined ? model.simulate(event.data.params) : model.replay(event.data.text);
    self.postMessage({ run, milliseconds: performance.now() - start }, Object.values(run.signals).map(a => a.buffer));
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
