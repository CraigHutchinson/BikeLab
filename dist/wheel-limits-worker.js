import {experiment} from './wheel-limits.js';
self.onmessage=event=>{try{self.postMessage({result:experiment(event.data)});}catch(error){self.postMessage({error:error.message});}};
