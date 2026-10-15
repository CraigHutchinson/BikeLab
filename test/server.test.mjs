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
    for(const asset of ['suspension.html','suspension.js','suspension-app.js','suspension-ui-model.js'])
      assert.equal((await get('/'+asset)).status,200);
    assert.equal((await get('/physics.js?reload=1')).status,200);
    assert.equal((await get('/AGENTS.md')).status,404);
    assert.equal((await get('/../.git/config')).status,404);
    assert.equal((await get('/','POST')).status,405);
    assert.equal((await get('/','HEAD')).body,'');
  } finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
});
