import {fromWindow,run} from './tyre-fixture.js';
self.onmessage=async event=>{
 let phase=null,posted=-Infinity;
 try{
  let input=event.data.input,transfer=null;
  if(event.data.window){self.postMessage({progress:{phase:'extracting',acceptedSteps:0,totalSteps:1,dt:0}});const exported=await fromWindow(event.data.window,event.data.wheel);input=exported.input;transfer=exported.transfer;}
  const result=await run(input,(next,acceptedSteps,totalSteps,dt)=>{
   const now=performance.now();if(next!==phase||acceptedSteps===totalSteps||now-posted>=100){self.postMessage({progress:{phase:next,acceptedSteps,totalSteps,dt}});phase=next;posted=now;}
  });
  self.postMessage({result,transfer});
 }catch(error){self.postMessage({error:error.message});}
};
