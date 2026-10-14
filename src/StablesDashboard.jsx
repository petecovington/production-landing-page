import React, { useEffect, useState } from 'react';
import StablesFunnel from './StablesFunnel.jsx';
const percentage = value => value == null ? '—' : `${value}%`;
function Card({ title, children }) { return <div className="bg-white border border-gray-200 rounded-lg p-5"><div className="text-xs uppercase font-mono text-gray-500 mb-2">{title}</div><div className="text-2xl font-bold">{children}</div></div>; }
export default function StablesDashboard({ password, days, refresh, onUnauthorized }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [kit, setKit] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError(''); setKit(null);
    const get = async url => {
      const response = await fetch(url, { headers: { 'x-dashboard-password': password }, signal: controller.signal });
      if (response.status === 401) { onUnauthorized(); throw Error('Please sign in again.'); }
      if (!response.ok) throw Error('Could not load Stables tracking. Please try again.');
      return response.json();
    };
    get(`/api/stables/data?days=${days}`).then(result => { if (!controller.signal.aborted) setData(result); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    get('/api/stables/kit').then(result => { if (!controller.signal.aborted) setKit(result); }).catch(e => { if (e.name !== 'AbortError') setKit({ status: 'unavailable' }); });
    return () => controller.abort();
  }, [password, days, refresh]);
  return <>
    {loading && <p role="status">Loading Stables…</p>}
    {error && <p role="alert" className="p-4 bg-red-50 border border-red-200 mb-6">{error}</p>}
    {data && <>
      <div className="grid md:grid-cols-3 gap-4 mb-4"><Card title="Visits">{data.visits}</Card><Card title="Email submissions">{data.submitted_visits}</Card><Card title="Submission rate">{percentage(data.submission_rate)}</Card></div>
      <p className="text-sm text-gray-600 mb-6">Visits with an email submission accepted by Kit. Each visit counts once. The current confirmed total is shown separately below.</p>
      <section className="bg-white border rounded-lg p-5 mb-6"><h2 className="font-mono text-sm uppercase mb-4">Signup pages</h2><table className="w-full text-left text-sm"><thead><tr>{['Page', 'Visits', 'Email submissions'].map(x => <th className="p-2 border-b" key={x}>{x}</th>)}</tr></thead><tbody>{data.forms.map(f => <tr key={f.name}><td className="p-2">{f.name}</td><td className="p-2">{f.visits}</td><td className="p-2">{f.submissions}</td></tr>)}</tbody></table></section>
      <section className="bg-white border rounded-lg p-5 mb-6"><h2 className="font-mono text-sm uppercase mb-4">Pages visited</h2>{data.pages.map(p => <div className="flex justify-between py-2 border-b text-sm" key={p.page}><span>{p.page === '/' ? 'Home' : p.page.slice(1).replace('.html', '').replaceAll('-', ' ')}</span><span>{p.visits}</span></div>)}</section>
    </>}
    <StablesFunnel password={password} days={days} refresh={refresh} onUnauthorized={onUnauthorized}/>
    <section className="bg-white border rounded-lg p-5 mb-6"><h2 className="font-mono text-sm uppercase mb-4">Confirmed subscribers · PDF breakdowns</h2>{!kit ? <p>Checking Kit…</p> : kit.status === 'connected' ? <><p className="text-2xl font-bold">{kit.total}</p><p className="text-sm text-gray-600 mt-2">Current confirmed subscribers in Kit, across all time. Includes people who were already subscribed.</p><p className="text-sm text-gray-600 mt-2">New confirmations by day are not available. The graph above shows successful website signups.</p><p className="text-xs text-gray-500 mt-2">Checked {new Date(kit.checked_at).toLocaleString('en-AU')}.</p></> : <p className="text-sm text-gray-600">{kit.status === 'not_connected' ? 'Kit is not connected yet.' : 'Kit is temporarily unavailable.'}</p>}</section>
  </>;
}
