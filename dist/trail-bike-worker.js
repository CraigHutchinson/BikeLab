import {run} from './trail-bike.js';
self.onmessage=async e=>{try{self.postMessage({result:await run(e.data)});}catch(error){self.postMessage({error:error.message});}};
