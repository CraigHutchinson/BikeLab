import {run} from './fixed-hub.js';
self.onmessage=async e=>{try{const result=await run(e.data,(phase,step,total)=>self.postMessage({progress:{phase,step,total}}));self.postMessage({result});}catch(error){self.postMessage({error:error.message});}};

