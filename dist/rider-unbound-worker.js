import {runUnbound} from './rider-unbound.js';
self.onmessage = async event => {
  try {const result = await runUnbound(event.data, progress => self.postMessage({progress}));self.postMessage({result});}
  catch (error) {self.postMessage({error: error.message});}
};
