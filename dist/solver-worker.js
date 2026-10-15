import { runTrial } from './solver-trial.js';
self.onmessage=async event=>{
  try {
    const run=await runTrial(event.data.params);
    self.postMessage({run},Object.values(run.signals).map(a=>a.buffer));
  } catch(error) { self.postMessage({error:error.message}); }
};
