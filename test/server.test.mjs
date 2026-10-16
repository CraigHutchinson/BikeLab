import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createPreviewServer } from '../server.mjs';
test('loopback server serves only assets and survives malformed requests',async()=>{
  const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=server.address().port;
  const get=(path,method='GET')=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path,method},res=>{
      let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });req.on('error',reject);req.setTimeout(3000,()=>req.destroy(new Error('HTTP test timeout')));req.end();
  });
  try {
    assert.equal((await get('//[')).status,400);
    assert.equal((await get('/')).status,200);
    assert.match((await get('/worker.js')).headers['content-type'],/javascript/);
    assert.equal((await get('/ui-model.js')).status,200);
    for(const asset of ['suspension.html','suspension.js','suspension-app.js','suspension-ui-model.js','terrain.html','terrain.js','terrain-app.js','solver.html','solver-app.js','solver-config.js','solver-trial.js','solver-worker.js','vendor/rapier-0.21.0/rapier.mjs'])
      assert.equal((await get('/'+asset)).status,200);
    assert.equal((await get('/physics.js?reload=1')).status,200);
    assert.match((await get('/vendor/rapier-0.21.0/rapier.mjs')).headers['content-type'],/javascript/);
    assert.match((await get('/vendor/rapier-0.21.0/LICENSE')).headers['content-type'],/text\/plain/);
    assert.equal((await get('/vendor/rapier-0.21.0/provenance.json')).status,200);
    assert.equal((await get('/vendor/mujoco-3.16.0/mujoco.wasm','HEAD')).headers['content-type'],'application/wasm');
    for(const asset of ['bike.html','bike-app.js','terrain-request.html','terrain-request.js','terrain-request-app.js','linkage.js','bike-geometry.js','bike-rig.js','bike-worker.js','vendor/mujoco-3.16.0/NOTICES.txt'])assert.equal((await get('/'+asset)).status,200);
    assert.equal((await get('/AGENTS.md')).status,404);
    assert.equal((await get('/../.git/config')).status,404);
    assert.equal((await get('/','POST')).status,405);
    assert.equal((await get('/','HEAD')).body,'');
  } finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
});
