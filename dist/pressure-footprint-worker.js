import {solveFootprint,record} from './pressure-footprint.js';
self.onmessage=({data})=>{
 try {const states=[];for(const state of solveFootprint(data.input)){states.push(state);self.postMessage({id:data.id,type:'progress',count:states.length});}self.postMessage({id:data.id,type:'complete',record:record(data.input,states)});}
 catch(error){self.postMessage({id:data.id,type:'error',message:error.message});}
};
