import React, { useState, useEffect } from 'react';
import StablesDashboard from './StablesDashboard.jsx';

const duration = seconds => {
  if (seconds == null) return '—';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
};
const percent = value => value == null ? '—' : `${value}%`;
const date = value => new Date(value).toLocaleString('en-AU', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
function Card({ label, children }) {
  return <div className="bg-white border border-gray-200 rounded-lg p-5"><div className="text-xs uppercase font-mono text-gray-500 mb-2">{label}</div><div className="text-2xl font-bold">{children}</div></div>;
}
function Panel({ title, children }) {
  return <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6"><h2 className="font-mono text-sm uppercase mb-4">{title}</h2>{children}</section>;
}
function Table({ columns, rows }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{columns.map(c => <th key={c} className="p-2 border-b font-medium text-gray-500">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="p-2 border-b border-gray-100">{c}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="text-gray-500 py-3">—</p>}</div>;
}
export default function Dashboard() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('dash_pw') || '');
  const [input, setInput] = useState('');
  const [site, setSite] = useState('production');
  const [days, setDays] = useState(30), [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!password || site !== 'production') return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    fetch(`/api/analytics/data?days=${days}`, { headers: { 'x-dashboard-password': password }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { sessionStorage.removeItem('dash_pw'); setPassword(''); throw new Error('Incorrect dashboard password.'); }
        if (!response.ok) throw new Error('Could not load the report. Please try again.');
        return response.json();
      }).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [password, days, refresh, site]);
  if (!password) return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><form className="bg-white p-8 rounded border space-y-4" onSubmit={e => { e.preventDefault(); sessionStorage.setItem('dash_pw', input); setPassword(input); }}><h1 className="text-2xl">Analytics dashboard</h1><label className="block">Password<input type="password" required value={input} onChange={e => setInput(e.target.value)} className="block border p-2 mt-2" /></label><button className="bg-[#8B1E1E] text-white px-4 py-2 rounded">Sign in</button>{error && <p role="alert">{error}</p>}</form></main>;
  const o = data?.overview, f = data?.form_funnel;
  return <main className="min-h-screen bg-gray-50 text-gray-900"><div className="max-w-7xl mx-auto p-6 md:p-8">
    <header className="flex flex-wrap justify-between items-center gap-4 mb-6"><div><h1 className="text-2xl font-bold">Analytics</h1><p className="text-gray-500">{site === 'stables' ? 'thestables.music' : 'petecovington.com'}</p></div><div className="flex gap-3 items-center"><select aria-label="Reporting period" value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded p-2">{[7, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}</select><button onClick={() => setRefresh(n => n + 1)} className="border rounded p-2">Refresh</button><button onClick={() => { sessionStorage.removeItem('dash_pw'); setPassword(''); setData(null); }} className="text-gray-500">Sign out</button></div></header>
    <nav aria-label="Website" className="flex gap-2 mb-6">{[['production', 'Production'], ['stables', 'The Stables']].map(([value, label]) => <button key={value} aria-pressed={site === value} onClick={() => setSite(value)} className={`px-4 py-2 rounded border ${site === value ? 'bg-[#8B1E1E] text-white border-[#8B1E1E]' : 'bg-white'}`}>{label}</button>)}</nav>
    {site === 'stables' ? <StablesDashboard password={password} days={days} refresh={refresh} onUnauthorized={() => { sessionStorage.removeItem('dash_pw'); setPassword(''); }} /> : <>
    {loading && <p role="status">Loading report…</p>}{error && <p role="alert" className="p-4 bg-red-50 border border-red-200 mb-6">{error}</p>}
    {data && <>
      <p className="text-sm text-gray-600 mb-4">Visits starting {date(data.from)} – {date(data.to)} UTC</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6"><Card label="Visits">{o.total_sessions}</Card><Card label="Different browsers">{o.unique_visitors}</Card><Card label="Visits with an enquiry">{f.accepted}</Card><Card label="Average active time">{duration(o.avg_duration_seconds)}</Card><Card label="Bounce rate">{percent(o.bounce_rate)}</Card><Card label="Average page depth">{percent(o.avg_scroll_depth)}</Card></div>

      <div className="grid md:grid-cols-3 gap-6">{[['Where visits came from', data.referrers], ['Tracked links', data.utm_sources], ['Devices', data.devices]].map(([title, rows]) => <Panel key={title} title={title}><Table columns={['Source or device', 'Visits']} rows={rows.map(r => [r.key, r.count])} /></Panel>)}</div>
      <div className="grid md:grid-cols-2 gap-6">{[['Countries', data.countries], ['Browsers', data.browsers]].map(([title, rows]) => <Panel key={title} title={title}><Table columns={['Group', 'Visits']} rows={rows.map(r => [r.key, r.count])} /></Panel>)}</div>
      <Panel title="Time on each section"><Table columns={['Section', 'Visits', 'Average active time']} rows={data.sections.map(s => [s.section, s.visits, duration(s.avg_seconds)])} /></Panel>
      <Panel title="Enquiry progress"><Table columns={['Stage', 'Visits', '% of form starts']} rows={[[ 'Started the form', f.started ], ['Tried to send', f.attempted], ['Enquiry sent', f.accepted]].map(([label, n]) => [label, n, f.started ? `${Math.round(n / f.started * 100)}%` : '—'])} /><p className="text-sm text-gray-600 mt-3">Send attempts: {f.attempts} · Successful sends: {f.accepted_attempts} · Sending errors: {f.error}</p><details className="mt-4"><summary className="cursor-pointer">Fields filled in</summary><Table columns={['Field', 'Visits']} rows={Object.entries(f.fields)} /></details></Panel>
      <Panel title="Audio examples"><Table columns={['Track', 'Recording', 'Example viewed (visits)', 'Played (visits)', 'Play starts', 'Active playback time']} rows={data.audio.map(a => [a.track, a.version, a.exposed_visits, a.playing_visits, a.play_events, duration(a.foreground_seconds)])} /></Panel>
      <Panel title="Spotify activity">
        <Table columns={['Activity', 'Visits']} rows={[
          ['Player seen', data.spotify.exposed_visits], ['Player loaded', data.spotify.ready_visits],
          ['Clicked or tabbed into player', data.spotify.focus_visits],
          ['Playback started', data.spotify.playback_started_visits],
          ['Saw and used player', data.spotify.exposed_then_interacted_visits], ['Enquiry after using player', data.spotify.accepted_after_interaction_visits],
        ]} />
        <p className="text-sm text-gray-500 my-3">Player use: {data.spotify.interacted_visits} visits · {data.spotify.interacted_visitor_ids} browsers</p>
        <Table columns={['Visit', 'Started (UTC)', 'Device', 'Source', 'Player seen', 'Clicked or tabbed into player', 'Playback started', 'Enquiry afterward']} rows={data.spotify.recent_interactions.map(s => [s.visit, date(s.started_at), s.device, s.source, s.exposed ? 'Yes' : '—', s.focused ? 'Yes' : '—', s.playback_started ? 'Yes' : '—', s.accepted_after ? 'Yes' : '—'])} />
      </Panel>
      <Panel title="Things visitors did"><Table columns={['Event', 'Count']} rows={data.events.map(e => [e.key, e.count])} /></Panel>
      <Panel title="Recent visits"><Table columns={['Started (UTC)', 'Country', 'Device', 'Active time', 'Bounce']} rows={data.recent_sessions.map(s => [date(s.started_at), s.country || '—', s.device_type || '—', duration(s.duration_seconds), s.is_bounce == null ? '—' : s.is_bounce ? 'Yes' : 'No'])} /></Panel>

    </>}
    </>}
  </div></main>;
}
