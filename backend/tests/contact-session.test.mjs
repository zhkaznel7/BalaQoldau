import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {createApp} from '../dist/app.js';import {parseEnvironment} from '../dist/config/env.js';
test('explicit disabled-session marker does not enable any authentication route',async()=>{
 const server=createApp(parseEnvironment({CORS_ALLOWED_ORIGINS:'https://example.com'})).listen(0,'127.0.0.1');await once(server,'listening');
 try{const base='http://127.0.0.1:'+server.address().port+'/api/auth';let r=await fetch(base+'/session');assert.equal(r.status,404);assert.equal((await r.json()).error.code,'AUTH_DISABLED');r=await fetch(base+'/profile');assert.equal(r.status,404);assert.equal((await r.json()).error.code,'NOT_FOUND');}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
