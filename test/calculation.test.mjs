import test from 'node:test';
import assert from 'node:assert/strict';
import { Calculation } from '../dist/calculation.js';
function fixture() {
  const workers=[],results=[],errors=[],busy=[];
  const job=new Calculation({
    createWorker:()=>{const w={terminated:false,postMessage(p){this.payload=p;},terminate(){this.terminated=true;}};workers.push(w);return w;},
    onBusy:value=>busy.push(value),onResult:(...values)=>results.push(values),onError:error=>errors.push(error)
  });
  return {job,workers,results,errors,busy};
}
test('cancel terminates active work and rejects late completion',()=>{
  const f=fixture(),ticket=f.job.begin();f.job.launch(ticket,{params:{}});
  const w=f.workers[0];f.job.cancel();w.onmessage({data:{run:'stale',milliseconds:1}});
  assert.equal(w.terminated,true);assert.deepEqual(f.results,[]);assert.deepEqual(f.busy,[true,false]);
});
test('cancel during file read prevents stale dispatch over a later setup',()=>{
  const f=fixture(),readTicket=f.job.begin();f.job.cancel();
  const next=f.job.begin();f.job.launch(next,{params:{mass:60}});
  f.job.launch(readTicket,{text:'stale file'});
  assert.equal(f.workers.length,1);
  f.workers[0].onmessage({data:{run:'current',milliseconds:1}});
  assert.deepEqual(f.results,[['current',1]]);
});
test('failed and duplicate worker messages cannot overwrite the accepted result',()=>{
  const f=fixture(),ticket=f.job.begin();f.job.launch(ticket,{params:{}});
  const w=f.workers[0];w.onmessage({data:{run:'accepted',milliseconds:2}});
  w.onmessage({data:{error:'late failure'}});
  assert.deepEqual(f.results,[['accepted',2]]);assert.deepEqual(f.errors,[]);
});
test('worker construction and execution failures unlock controls and permit retry',()=>{
  const f=fixture(),ticket=f.job.begin();f.job.launch(ticket,{params:{}});
  f.workers[0].onerror({message:'worker failed',preventDefault(){}});
  assert.deepEqual(f.errors,['worker failed']);assert.equal(f.busy.at(-1),false);
  const next=f.job.begin();f.job.launch(next,{params:{}});f.workers[1].onmessage({data:{run:'retried',milliseconds:1}});
  assert.deepEqual(f.results,[['retried',1]]);
  const failed=new Calculation({onBusy:v=>f.busy.push(v),onResult(){},onError:e=>f.errors.push(e),createWorker(){throw new Error('unavailable');}});
  failed.launch(failed.begin(),{});
  assert.equal(f.errors.at(-1),'unavailable');assert.equal(f.busy.at(-1),false);
});
