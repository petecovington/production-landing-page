import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFunnel, cleanPost, funnelHandler } from '../lib/stables-funnel.js';
import { dayStart, fromLocal, localTime } from '../lib/stables-time.js';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const at = local => fromLocal(local);
const p = (n,local) => ({id:id(n), title:`Post ${n}`, url:'https://www.instagram.com/reel/Example/', published_at:at(local),views_48h:null,views_7d:null});
const visit=(n,time,extra={})=>({id:id(n),started_at:at(time),...extra});
const sent=(n,time)=>({visit_id:id(n),kind:'submission',created_at:at(time)});
const coverage=at('2026-09-01T00:00');
test('Sydney days follow daylight saving and invalid local times do not silently move',()=>{
  assert.equal(dayStart('2026-10-05')-dayStart('2026-10-04'),23*3600000);
  assert.equal(localTime(at('2026-10-15T09:30')),'2026-10-15T09:30');
  assert.throws(()=>at('2026-10-04T02:30')); assert.throws(()=>at('2026-04-05T02:30'));
});
test('day counts use visit start and first accepted signup, exclude tests and orphans',()=>{
  const r=buildFunnel([visit(1,'2026-10-14T23:55'),visit(2,'2026-10-15T10:00',{is_test:true})],[sent(1,'2026-10-15T00:05'),sent(1,'2026-10-15T00:10'),sent(2,'2026-10-15T10:01'),sent(99,'2026-10-15T10:02')],[],coverage,at('2026-10-15T12:00'),7);
  assert.deepEqual([r.daily.at(-2).visits,r.daily.at(-2).signups,r.daily.at(-1).visits,r.daily.at(-1).signups],[1,0,0,1]);
  assert.equal(r.daily.at(-1).partial,true);
});
test('missing coverage is not zero and unfinished windows never show a completed comparison',()=>{
  const posts=[p(1,'2026-09-30T12:00'),p(2,'2026-10-14T12:00'),p(3,'2026-10-20T12:00')];
  const r=buildFunnel([],[],posts,at('2026-10-01T12:00'),at('2026-10-15T12:00'),30);
  assert.equal(r.daily[0].visits,null);assert.equal(r.posts[0].windows[0].state,'missing');assert.equal(r.posts[0].windows[0].visits,null);
  assert.equal(r.posts[1].windows[0].state,'in_progress');assert.equal(r.posts[1].windows[0].expected,null);
  assert.equal(r.posts[2].windows[0].state,'not_started');assert.equal(r.posts[2].windows[0].visits,null);
  assert.equal(buildFunnel([],[],[],null,at('2026-10-15T12:00'),7).daily[0].visits,null);
});
test('baseline uses prior full days, excludes post windows, and requires seven usable days',()=>{
  const posts=[p(1,'2026-10-01T12:00'),p(2,'2026-10-10T12:00')];
  const r=buildFunnel([visit(1,'2026-09-20T12:00'),visit(2,'2026-10-03T12:00')],[],posts,coverage,at('2026-10-20T12:00'));
  assert.equal(r.posts[1].baseline.days,20); // Oct 1 through 8 excluded from 28 prior days.
  assert.equal(r.posts[1].baseline.visits,1/20);
  assert.equal(r.posts[1].windows[0].expected.visits,0.1);
  const short=buildFunnel([],[],[p(1,'2026-10-05T12:00')],at('2026-10-01T00:00'),at('2026-10-20T12:00'));
  assert.equal(short.posts[0].baseline.days,4);assert.equal(short.posts[0].baseline.visits,null);
});
test('windows have exact 48 hour boundaries, deduplicate, and report overlap',()=>{
  const r=buildFunnel([visit(1,'2026-10-10T12:00'),visit(2,'2026-10-12T12:00')],[sent(1,'2026-10-10T12:01'),sent(1,'2026-10-10T12:02')],[p(1,'2026-10-10T12:00'),p(2,'2026-10-11T12:00')],coverage,at('2026-10-20T12:00'));
  assert.equal(r.posts[0].windows[0].visits,1);assert.equal(r.posts[0].windows[0].signups,1);assert.deepEqual(r.posts[0].windows[0].overlaps,['Post 2']);
});
test('source groups preserve unknown history and never infer Instagram from missing tags',()=>{
  const r=buildFunnel([visit(1,'2026-10-14T12:00',{source:'instagram_bio'}),visit(2,'2026-10-14T12:00',{source:'other'}),visit(3,'2026-10-14T12:00')],[sent(1,'2026-10-14T12:01')],[],coverage,at('2026-10-15T12:00'));
  assert.deepEqual(r.sources.map(s=>[s.visits,s.signups]),[[1,1],[0,0],[1,0],[1,0]]);
});
test('post validation strips tracking query and arbitrary fields, preserves blank vs zero',()=>{
  const row=cleanPost({...p(1,'2026-10-14T12:00'),url:'https://www.instagram.com/reel/Example/?igsh=secret',views_48h:0,email:'private'});
  assert.equal(row.url,'https://www.instagram.com/reel/Example/');assert.equal(row.views_48h,0);assert.equal(row.views_7d,null);assert.equal(row.email,undefined);
  for(const change of [{url:'javascript:alert(1)'},{url:'https://evil.test/reel/x/'},{views_48h:-1},{views_7d:1.2},{published_at:'2026-10-14T12:00'},{title:''}]) assert.throws(()=>cleanPost({...p(1,'2026-10-14T12:00'),...change}));
});
const res=()=>({status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;},setHeader(){}});
test('writes require password; invalid data cannot reach database',async()=>{
  const db={from(){throw Error('must not query');}};
  for(const [headers,body,status] of [[{},p(1,'2026-10-14T12:00'),401],[{'x-dashboard-password':'pass'},{},400]]) {
    const r=res();await funnelHandler(db,'pass')({method:'POST',headers,body},r);assert.equal(r.code,status);
  }
});
test('editing checks prior version; stale writes get a conflict instead of overwriting',async()=>{
  const checks=[]; const db={from(table){assert.equal(table,'stables_posts');return {update(row){assert.equal(row.title,'Post 1');return this;},eq(k,v){checks.push([k,v]);return this;},select(){return this;},async maybeSingle(){return {data:null};}};}};
  const r=res();await funnelHandler(db,'pass')({method:'POST',headers:{'x-dashboard-password':'pass'},body:{...p(1,'2026-10-14T12:00'),updated_at:'2026-10-14T12:00:00Z'}},r);
  assert.equal(r.code,409);assert.deepEqual(checks,[['id',id(1)],['updated_at','2026-10-14T12:00:00Z']]);
});
