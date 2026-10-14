import React, { useEffect, useState } from 'react';
import { dayKey, fromLocal, localTime } from '../lib/stables-time.js';
const number = n => n == null ? '—' : Number(n.toFixed(1)).toLocaleString('en-AU');
const date = value => new Date(value).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const shortDate = day => new Date(day + 'T12:00:00Z').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
const panel = 'bg-white border border-gray-200 rounded-lg p-5 mb-6';
const blank = () => ({ id: crypto.randomUUID(), title: '', url: '', published_at: '', views_48h: '', views_7d: '' });
export function DailyChart({ daily, posts }) {
  const [table, setTable] = useState(false);
  const width = 900, height = 260, left = 40, bottom = 215, top = 25;
  const max = Math.max(4, ...daily.map(d => d.visits || 0), ...daily.map(d => d.signups || 0));
  const ceiling = Math.ceil(max / 4) * 4;
  const x = i => left + i * (width - left - 20) / Math.max(1, daily.length - 1);
  const y = value => bottom - value / ceiling * (bottom - top);
  const visiblePosts = posts.filter(p => daily.some(d => d.date === dayKey(p.published_at)));
  const path = metric => daily.map((d,i) => d[metric] == null ? '' : `${i && daily[i-1][metric] != null ? 'L' : 'M'}${x(i)},${y(d[metric])}`).join(' ');
  return <section className={panel}>
    <h2 className="font-bold text-lg">Daily visits and signups</h2>
    <p className="text-sm text-gray-600 mt-1">Sydney time. Signups are visits with an email accepted by Kit, counted on the first acceptance day.</p>
    <div className="flex gap-5 text-sm mt-4"><span className="text-blue-700">● Visits</span><span className="text-emerald-700">● Signups</span><span className="text-gray-500">┊ Post published</span></div>
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" role="img" aria-label="Daily visits and successful website signups, with numbered post markers. Use Show daily numbers for exact values.">
      {[0,1,2,3,4].map(i => <g key={i}><line x1={left} x2={width-20} y1={y(ceiling*i/4)} y2={y(ceiling*i/4)} stroke="#e5e7eb"/><text x={left-8} y={y(ceiling*i/4)+4} textAnchor="end" fontSize="11" fill="#6b7280">{ceiling*i/4}</text></g>)}
      {visiblePosts.map((p,i) => { const at = daily.findIndex(d => d.date === dayKey(p.published_at)); return <g key={p.id}><title>{p.title} · {date(p.published_at)}</title><line x1={x(at)} x2={x(at)} y1={top} y2={bottom} stroke="#9ca3af" strokeDasharray="4 4"/><text x={x(at)} y={14+(i%2)*10} textAnchor="middle" fontSize="11">{i+1}</text></g>; })}
      {[['visits','#1d4ed8'],['signups','#047857']].map(([metric,color]) => <g key={metric}><path d={path(metric)} stroke={color} strokeWidth="2" fill="none"/>{daily.map((d,i) => d[metric] != null && <circle key={d.date} cx={x(i)} cy={y(d[metric])} r={d.partial ? 4 : 2.5} fill={d.partial ? '#fff' : color} stroke={color}><title>{shortDate(d.date)}: {d[metric]} {metric}{d.partial ? ' · Partial day' : ''}</title></circle>)}</g>)}
      {daily.map((d,i) => (i === 0 || i === daily.length-1 || i % Math.ceil(daily.length/5) === 0) && <text key={d.date} x={x(i)} y={240} textAnchor={i===0?'start':i===daily.length-1?'end':'middle'} fontSize="11" fill="#6b7280">{shortDate(d.date)}</text>)}
    </svg></div>
    <p className="text-xs text-gray-500">Open circles are partial days. Gaps mean data is unavailable.</p>
    {visiblePosts.length > 0 && <ol className="mt-3 space-y-1 text-sm">{visiblePosts.map((p,i) => <li key={p.id}>{i+1}. {shortDate(dayKey(p.published_at))} · <a className="underline" href={p.url} target="_blank" rel="noreferrer">{p.title}</a></li>)}</ol>}
    <button className="text-sm underline mt-4" onClick={() => setTable(!table)} aria-expanded={table}>{table ? 'Hide' : 'Show'} daily numbers</button>
    {table && <div className="overflow-auto max-h-80 mt-3"><table className="w-full text-sm text-left"><thead><tr><th>Date</th><th>Visits</th><th>Signups</th><th>Coverage</th></tr></thead><tbody>{daily.map(d => <tr key={d.date} className="border-t"><td className="py-2">{shortDate(d.date)}</td><td>{number(d.visits)}</td><td>{number(d.signups)}</td><td>{d.visits == null ? 'No data' : d.partial ? 'Partial day' : 'Full day'}</td></tr>)}</tbody></table></div>}
  </section>;
}
function Window({ window: w, views }) {
  const label = w.days === 2 ? 'First 48 hours' : 'First 7 days';
  const status = { missing: 'Data missing for this window', not_started: 'Not started', in_progress: 'Still counting', complete: 'Complete' }[w.state];
  return <div className="bg-gray-50 rounded p-4"><h4 className="font-semibold">{label}</h4><p className="text-xs text-gray-600 my-2">{status}{w.state === 'in_progress' ? ` · Ends ${date(w.until)}` : ''}</p>
    <p>{number(w.visits)} visits · {number(w.signups)} signups</p>
    {w.expected && <p className="text-sm text-gray-600 mt-2">Usual: {number(w.expected.visits)} visits · {number(w.expected.signups)} signups<br/>Difference: {number(w.visits-w.expected.visits)} visits · {number(w.signups-w.expected.signups)} signups</p>}
    <p className="text-sm text-gray-500 mt-2">Post views: {number(views)}{views == null ? ' (not entered)' : ' (entered by you)'}</p>
    {!!w.overlaps.length && <p className="text-sm text-amber-800 mt-2">Overlaps: {w.overlaps.join(', ')}. These totals include other posts’ activity.</p>}
  </div>;
}
export default function StablesFunnel({ password, days, refresh, onUnauthorized }) {
  const [data,setData]=useState(null), [error,setError]=useState(''), [loading,setLoading]=useState(true), [draft,setDraft]=useState(null), [saving,setSaving]=useState(false), [saveError,setSaveError]=useState(''), [saved,setSaved]=useState(''), [revision,setRevision]=useState(0);
  useEffect(() => {
    const controller=new AbortController(); setLoading(true); setError(''); setData(null);
    fetch(`/api/stables/funnel?days=${days}`,{headers:{'x-dashboard-password':password},signal:controller.signal}).then(async r=>{if(r.status===401) onUnauthorized(); if(!r.ok) throw Error('Could not load daily visits and posts. Please try again.'); return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[password,days,refresh,revision]);
  const edit=post=>{setSaveError('');setSaved('');setDraft(post ? {...post,published_at:localTime(post.published_at),views_48h:post.views_48h??'',views_7d:post.views_7d??''} : blank());};
  async function save(e) {
    e.preventDefault(); const values=Object.fromEntries(new FormData(e.currentTarget)); setSaving(true);setSaveError('');
    try {
      const body={...draft,...values,published_at:fromLocal(values.published_at),views_48h:values.views_48h===''?null:Number(values.views_48h),views_7d:values.views_7d===''?null:Number(values.views_7d)};
      // Do not send derived report fields back to the server.
      const payload=Object.fromEntries(['id','title','url','published_at','views_48h','views_7d','updated_at'].map(k=>[k,body[k]]));
      const response=await fetch('/api/stables/funnel',{method:'POST',headers:{'Content-Type':'application/json','x-dashboard-password':password},body:JSON.stringify(payload)});
      if(response.status===401)onUnauthorized();
      if(!response.ok){const result=await response.json();throw Error(result.error||'Could not save the post.');}
      setDraft(null);setSaved('Post saved.');setRevision(v=>v+1);
    }catch(e){setSaveError(e.message);}finally{setSaving(false);}
  }
  return <>
    {loading && <p className="mb-4" role="status">Loading daily visits and posts…</p>}
    {error && <p className="p-4 bg-red-50 mb-4" role="alert">{error}</p>}
    {data && <>
      <DailyChart daily={data.daily} posts={data.posts}/>
      <section className={panel}><div className="flex justify-between gap-4"><h2 className="font-bold text-lg">Lyric breakdown posts</h2><button className="border rounded px-3 py-1 text-sm" disabled={!!draft} onClick={()=>edit(null)}>Add post</button></div>
        <p className="text-sm text-gray-600 mt-2">Website activity after each post. This does not prove which post caused a signup.</p>
        <p className="text-xs text-gray-500 mt-2">Usual daily numbers use the previous 28 full days, leaving out each logged post’s first 7 days. At least 7 usable days are needed.</p>
        <p className="text-xs text-gray-500 mt-1">Comparison data starts {data.coverage_start ? date(data.coverage_start) : 'when tracking is ready'}. All times are Sydney time.</p>
        {saved && <p role="status" className="mt-3 text-green-800">{saved}</p>}
        {draft && <form key={draft.id} onSubmit={save} className="border rounded p-4 mt-4 grid sm:grid-cols-2 gap-4">
          <h3 className="font-semibold sm:col-span-2">{draft.updated_at ? 'Edit post' : 'Add post'}</h3>
          {[['title','Title','text'],['url','Instagram post link','url'],['published_at','Published · Sydney time','datetime-local'],['views_48h','Views at 48 hours · optional','number'],['views_7d','Views at 7 days · optional','number']].map(([key,label,type])=><label className="text-sm" key={key}>{label}<input className="block border rounded p-2 w-full mt-1" type={type} required={!key.startsWith('views')} min={type==='number'?'0':undefined} step={type==='number'?'1':undefined} maxLength={key==='title'?120:undefined} name={key} defaultValue={draft[key]}/></label>)}
          {saveError&&<p className="sm:col-span-2 text-red-700" role="alert">{saveError}</p>}
          <div className="sm:col-span-2 flex gap-3"><button disabled={saving} className="bg-gray-900 text-white px-4 py-2 rounded">{saving?'Saving…':'Save post'}</button><button type="button" disabled={saving} onClick={()=>setDraft(null)} className="px-4 py-2 border rounded">Cancel</button></div>
        </form>}
        {!data.posts.length && <p className="text-sm mt-5 text-gray-600">Add a post to see its first 48 hours and 7 days here.</p>}
        {data.posts.map(post=><article key={post.id} className="mt-6 pt-5 border-t"><div className="flex justify-between gap-3"><div><h3 className="font-semibold"><a className="underline" href={post.url} target="_blank" rel="noreferrer">{post.title}</a></h3><p className="text-sm text-gray-500">{date(post.published_at)}</p></div><button className="text-sm underline" disabled={!!draft} onClick={()=>edit(post)}>Edit</button></div>
          <p className="text-sm my-3">{post.baseline.days>=7 ? `Usual day: ${number(post.baseline.visits)} visits · ${number(post.baseline.signups)} signups (${post.baseline.days} days used).` : `Usual day: not enough data yet (${post.baseline.days} of 7 days needed).`}</p>
          <div className="grid sm:grid-cols-2 gap-3">{post.windows.map(w=><Window key={w.days} window={w} views={w.days===2?post.views_48h:post.views_7d}/>)}</div>
        </article>)}
      </section>
      <section className={panel}><h2 className="font-bold text-lg">Where visits started</h2><p className="text-sm text-gray-600 mt-1">First link used in a visit. Untagged links do not identify Instagram.</p><table className="w-full text-sm text-left mt-4"><thead><tr><th>Link</th><th>Visits</th><th>Signups</th></tr></thead><tbody>{data.sources.map(s=><tr className="border-t" key={s.source}><td className="py-2">{{instagram_bio:'Instagram bio',instagram_story:'Instagram Story',other:'Other or untagged',unknown:'Source not recorded'}[s.source]}</td><td>{s.visits}</td><td>{s.signups}</td></tr>)}</tbody></table>
        <details className="mt-4 text-sm"><summary className="cursor-pointer">Links to paste into Instagram</summary>{[['Bio','bio'],['Story','story']].map(([label,medium])=><label className="block mt-3" key={medium}>{label}<input readOnly aria-label={`${label} link`} className="border p-2 rounded w-full mt-1" value={`https://www.thestables.music/breakdowns.html?utm_source=instagram&utm_medium=${medium}`} onFocus={e=>e.target.select()}/></label>)}</details>
      </section>
    </>}
  </>;
}
