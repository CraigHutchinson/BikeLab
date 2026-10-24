import {run} from './trail-bike.js';
self.onmessage=async e=>{
 let lastPhase=null,lastPosted=-Infinity;
 try{
  const result=await run(e.data,(phase,acceptedSteps,totalSteps,dt)=>{
   // The engine calls at bounded step checkpoints, not on every step. Only
   // this presentation boundary reads wall time or allocates message payloads.
   const now=performance.now();
   if(phase!==lastPhase||acceptedSteps===totalSteps||now-lastPosted>=100){
    self.postMessage({progress:{phase,acceptedSteps,totalSteps,dt}});lastPhase=phase;lastPosted=now;
   }
  });
  self.postMessage({result});
 }catch(error){self.postMessage({error:error.message});}
};
