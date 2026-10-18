import {solveFootprint} from './footprint.js';
self.onmessage=event=>{try{self.postMessage({result:solveFootprint(event.data.params,event.data.profile)});}catch(error){self.postMessage({error:error.message});}};
