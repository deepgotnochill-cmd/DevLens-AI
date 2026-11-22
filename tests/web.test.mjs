import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {slug,buckets,signals,safe,loadRepo} from '../src/model.ts';
test('URL allowlist rejects userinfo, ports, extra paths, and traversal',()=>{
  for(const url of ['https://github.com.evil.test/a/b','https://github.com/x/..','https://a@github.com/x/y','https://github.com/a/b?x','https://github.com:443/a/b','https://github.com/a/b/tree/main']) assert.throws(()=>slug(url));
  assert.equal(slug(' https://github.com/deep/my-app.git/ '),'deep/my-app');
});
test('UTC buckets include the final day and exclude future commits',()=>{
  const commits=['2026-01-02T23:59:59Z','2026-01-03T00:01:00Z','2026-01-04T00:00:00Z'].map(date=>({date}));
  assert.deepEqual(buckets(commits,new Date('2026-01-03T12:00:00Z'),2).map(b=>b.count),[1,1]);
});
test('partial trees preserve uncertainty and untrusted strings are escaped',()=>{
  const s=signals({files:[{path:'docs/README.md',type:'blob'}],truncated:true});
  assert.equal(s[0].path,'docs/README.md');assert.ok(s[1].uncertain);assert.equal(safe('<x>'),'&lt;x&gt;');
});
test('featured snapshot source and history agree',async()=>{
  const r=JSON.parse(await readFile('public/featured.json','utf8'));
  assert.equal(r.head,r.commits[0].sha);assert.ok(r.truncated);assert.ok(Object.values(r.languages).every(x=>Number.isSafeInteger(x)&&x>=0));
  assert.ok(r.sources.files.startsWith('https://api.github.com/repos/'));
});
test('successful requests are cached; failures are retryable',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return calls===1?new Response('{}',{status:429}):Response.json({full_name:'a/b'})};
  try{await assert.rejects(loadRepo('https://github.com/a/b','/api'));await loadRepo('https://github.com/a/b','/api');await loadRepo('https://github.com/a/b','/api');assert.equal(calls,2)}finally{globalThis.fetch=original}
});

