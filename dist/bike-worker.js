import {runRig} from './bike-rig.js';
self.onmessage=async ({data})=>{
  const start=performance.now();
  try {const run=await runRig(data.params);self.postMessage({run,milliseconds:performance.now()-start},Object.values(run.signals).map(v=>v.buffer));}
  catch(error){self.postMessage({error:error.message});}
};
