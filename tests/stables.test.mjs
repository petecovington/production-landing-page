import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sanitize, eventHandler, buildReport, authorized, dataHandler } from '../lib/stables.js';
import { confirmedTotal, kitHandler } from '../lib/kit-report.js';
const source = await readFile(process.env.STABLES_SOURCE || new URL('../../the-stables/analytics.js', import.meta.url), 'utf8');
const { startTracking } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const res = () => ({ code: 0, status(n) { this.code=n;return this; }, json(body) { this.body=body;return this; }, end() {return this;}, setHeader() {} });
const settle = () => new Promise(resolve => setImmediate(resolve));
let counter = 1;
function browser(path, storage=new Map(), requestOK=true) {
  const requests=[], listeners={}, redirect={ value: 'unchanged' };
  const win={ location:new URL('https://www.thestables.music'+path), navigator:{webdriver:false}, crypto:{randomUUID:()=>id(counter++)}, sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}, history:{replaceState:(_,__,path)=>{win.location=new URL(path,win.location.origin);}}, setTimeout:()=>{} };
  const form={querySelector:()=>redirect,addEventListener:(name,fn)=>{listeners[name]=fn;}};
  startTracking(win,{querySelector:()=>form},async(url,options)=>{requests.push({url,...JSON.parse(options.body)});return {ok:requestOK};});
  return {win,requests,redirect,submit:()=>listeners.submit(),storage};
}
test('direct, wrong-receipt and expired confirmation visits never count',()=>{
  assert.equal(browser('/confirmation.html').requests.some(e=>e.kind==='submission'),false);
  const b=browser('/breakdowns.html');b.submit();
  assert.equal(browser('/confirmation.html?stables_receipt=wrong',b.storage).requests.some(e=>e.kind==='submission'),false);
  const p=JSON.parse(b.storage.get('stables_pending'));p.at-=31*60000;b.storage.set('stables_pending',JSON.stringify(p));
  assert.equal(browser('/confirmation.html?stables_receipt='+p.id,b.storage).requests.some(e=>e.kind==='submission'),false);
});
test('matched return counts once; refresh never counts again; no email fields are read',async()=>{
  const b=browser('/breakdowns.html');b.submit();const target=new URL(b.redirect.value);
  assert.equal(target.origin,'https://www.thestables.music');
  const returned=browser(target.pathname+target.search,b.storage);await settle();
  assert.equal(returned.requests.filter(e=>e.kind==='submission').length,1);assert.equal(returned.win.location.search,'');
  assert.equal(browser('/confirmation.html',b.storage).requests.some(e=>e.kind==='submission'),false);
  assert.equal(JSON.stringify(b.requests).includes('email_address'),false);
});
test('failed delivery retries with stable event ID after refresh',async()=>{
  const b=browser('/workshops.html');b.submit();const target=new URL(b.redirect.value);
  const failed=browser(target.pathname+target.search,b.storage,false);await settle();
  const retried=browser('/workshops-confirmation.html',b.storage);await settle();
  assert.equal(failed.requests.find(e=>e.kind==='submission').id,retried.requests.find(e=>e.kind==='submission').id);
});
test('server drops arbitrary data and rejects unknown forms, pages and missing attempts',()=>{
  const row={id:id(90),visit_id:id(91),kind:'attempt',page:'/breakdowns.html',form_id:'9485257',email:'private@example.test',metadata:{secret:'private'}};
  assert.equal(JSON.stringify(sanitize(row)).includes('private'),false);
  assert.throws(()=>sanitize({...row,form_id:'other'}));assert.throws(()=>sanitize({...row,kind:'submission'}));assert.throws(()=>sanitize({...row,page:'/breakdowns.html?email=private'}));
});
function database(attempt=null) {
  const writes=[];return {writes,from(table){assert.ok(['stables_events','stables_visits'].includes(table));return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:attempt};},async upsert(row){writes.push({table,row});return {};}};}};
}
const submission={id:id(1),visit_id:id(2),kind:'submission',page:'/confirmation.html',form_id:'9485257',attempt_id:id(3)};
test('server refuses unmatched, cross-visit and expired returns without any writes',async()=>{
  for(const attempt of [null,{visit_id:id(4),kind:'attempt',form_id:'9485257',created_at:new Date().toISOString()},{visit_id:id(2),kind:'attempt',form_id:'9485257',created_at:new Date(Date.now()-31*60000).toISOString()}]) {
    const db=database(attempt),r=res();await eventHandler(db)({method:'POST',headers:{origin:'https://www.thestables.music'},body:submission},r);assert.equal(r.code,409);assert.equal(db.writes.length,0);
  }
});
test('matched returns write only to Stables tables and unknown origins are blocked',async()=>{
  const db=database({visit_id:id(2),kind:'attempt',form_id:'9485257',created_at:new Date().toISOString()});const r=res();
  await eventHandler(db)({method:'POST',headers:{origin:'https://www.thestables.music'},body:submission},r);assert.equal(r.code,200);assert.equal(db.writes.length,2);
  const forbidden=res();await eventHandler(db)({method:'POST',headers:{origin:'https://other.test'},body:submission},forbidden);assert.equal(forbidden.code,403);
});
test('report deduplicates successful visits and separates forms from unmatched visits',()=>{
  const r=buildReport([{id:id(1)},{id:id(2)}],[{visit_id:id(1),kind:'page',page:'/breakdowns.html'},...['9485257','9485257','9486070'].map(form_id=>({visit_id:id(1),kind:'submission',form_id})),{visit_id:id(9),kind:'submission',form_id:'9485257'}],{});
  assert.equal(r.visits,2);assert.equal(r.submitted_visits,1);assert.equal(r.submission_rate,50);assert.equal(r.forms[0].submissions,1);assert.equal(r.forms[1].submissions,1);assert.equal(buildReport([],[],{}).submission_rate,null);
});
test('dashboard authentication precedes any Kit or database call',async()=>{
  assert.equal(authorized({headers:{'x-dashboard-password':'pass'}},'pass'),true);assert.equal(authorized({headers:{}},undefined),false);
  const r=res();await kitHandler('pass','test-key',()=>{throw Error('must not call');})({method:'GET',headers:{}},r);assert.equal(r.code,401);
  const d=res();await dataHandler({from(){throw Error('must not call');}},'pass')({method:'GET',headers:{}},d);assert.equal(d.code,401);
});
test('Kit pages count unique active members including existing subscribers without personal output',async()=>{
  const calls=[];const pages=[{subscribers:[{id:1,state:'active',email_address:'private@example.test',created_at:'2020-01-01'}],pagination:{has_next_page:true,end_cursor:'next'}},{subscribers:[{id:1,state:'active'},{id:2,state:'active'}],pagination:{has_next_page:false}}];
  const total=await confirmedTotal('test-key',async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>pages.shift()};});
  assert.equal(total,2);assert.match(calls[1].url,/after=next/);assert.match(calls[0].url,/status=active/);assert.equal(calls[0].options.redirect,'error');
});
test('Kit errors never return partial totals and missing key makes no request',async()=>{
  await assert.rejects(()=>confirmedTotal('test-key',async()=>({ok:false})));
  await assert.rejects(()=>confirmedTotal('test-key',async()=>({ok:true,json:async()=>({subscribers:[{id:1,state:'inactive'}],pagination:{has_next_page:false}})})));
  const r=res();await kitHandler('pass',undefined,()=>{throw Error();})({method:'GET',headers:{'x-dashboard-password':'pass'}},r);assert.deepEqual(r.body,{status:'not_connected',total:null});
});

test('Stables report pagination tolerates a smaller database row cap',async()=>{
  const { readAll }=await import('../lib/stables.js');const rows=Array.from({length:1201},(_,id)=>({id}));
  const result=await readAll(()=>({range:async start=>({data:rows.slice(start,start+500)})}));
  assert.equal(result.length,1201);
});


test('test visits retain measurements but stay out of ordinary totals', async () => {
  const b = browser('/breakdowns.html?analytics=test'); b.submit();
  assert.ok(b.requests.every(e => e.is_test === true));
  const target = new URL(b.redirect.value);
  const returned = browser(target.pathname + target.search, b.storage); await settle();
  assert.ok(returned.requests.every(e => e.is_test === true));
  assert.equal(buildReport([{id:'test',is_test:true}], [{visit_id:'test',kind:'submission',form_id:'9485257'}], {}).visits, 0);
  const normal = browser('/?analytics=on', b.storage);
  assert.ok(normal.requests.every(e => e.is_test === false));
  assert.notEqual(normal.requests[0].visit_id, b.requests[0].visit_id);
});
