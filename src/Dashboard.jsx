import React, { useState, useEffect } from 'react';

const duration = seconds => {
  if (seconds == null) return 'Unknown';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
};
const percent = value => value == null ? 'Unknown' : `${value}%`;
const date = value => new Date(value).toLocaleString('en-AU', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
function Card({ label, children }) {
  return <div className="bg-white border border-gray-200 rounded-lg p-5"><div className="text-xs uppercase font-mono text-gray-500 mb-2">{label}</div><div className="text-2xl font-bold">{children}</div></div>;
}
function Panel({ title, children }) {
  return <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6"><h2 className="font-mono text-sm uppercase mb-4">{title}</h2>{children}</section>;
}
function Table({ columns, rows }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{columns.map(c => <th key={c} className="p-2 border-b font-medium text-gray-500">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="p-2 border-b border-gray-100">{c}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="text-gray-500 py-3">No measurements in this period.</p>}</div>;
}
export default function Dashboard() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('dash_pw') || '');
  const [input, setInput] = useState('');
  const [days, setDays] = useState(30), [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!password) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    fetch(`/api/analytics/data?days=${days}`, { headers: { 'x-dashboard-password': password }, signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { sessionStorage.removeItem('dash_pw'); setPassword(''); throw new Error('Incorrect dashboard password.'); }
        if (!response.ok) throw new Error('Report unavailable or incomplete. Retry to load verified totals.');
        return response.json();
      }).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [password, days, refresh]);
  if (!password) return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><form className="bg-white p-8 rounded border space-y-4" onSubmit={e => { e.preventDefault(); sessionStorage.setItem('dash_pw', input); setPassword(input); }}><h1 className="text-2xl">Analytics dashboard</h1><label className="block">Password<input type="password" required value={input} onChange={e => setInput(e.target.value)} className="block border p-2 mt-2" /></label><button className="bg-[#8B1E1E] text-white px-4 py-2 rounded">Sign in</button>{error && <p role="alert">{error}</p>}</form></main>;
  const o = data?.overview, f = data?.form_funnel;
  return <main className="min-h-screen bg-gray-50 text-gray-900"><div className="max-w-7xl mx-auto p-6 md:p-8">
    <header className="flex flex-wrap justify-between items-center gap-4 mb-6"><div><h1 className="text-2xl font-bold">Analytics</h1><p className="text-gray-500">petecovington.com</p></div><div className="flex gap-3 items-center"><select aria-label="Reporting period" value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded p-2">{[7, 30, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}</select><button onClick={() => setRefresh(n => n + 1)} className="border rounded p-2">Refresh</button><button onClick={() => { sessionStorage.removeItem('dash_pw'); setPassword(''); setData(null); }} className="text-gray-500">Sign out</button></div></header>
    {loading && <p role="status">Loading complete report…</p>}{error && <p role="alert" className="p-4 bg-red-50 border border-red-200 mb-6">{error}</p>}
    {data && <>
      <p className="text-sm text-gray-600 mb-4">Visits starting {date(data.from)} – {date(data.to)} UTC. Events through the same cutoff. Refreshed {date(data.to)} UTC.</p>
      <p className="text-sm text-gray-600 mb-6">Visitor IDs represent browsers, not identified people.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6"><Card label="Recorded visits">{o.total_sessions}</Card><Card label="Visitor IDs">{o.unique_visitors}</Card><Card label="Visitors who inquired">{f.accepted}</Card><Card label="Average foreground time">{duration(o.avg_duration_seconds)}</Card><Card label="Bounce · classified visits only">{percent(o.bounce_rate)}</Card><Card label="Average recorded scroll">{percent(o.avg_scroll_depth)}</Card></div>
      <p className="text-sm text-gray-600 mb-6">Time coverage: {o.measured_visits}/{o.total_sessions} visits. Bounce unknown for {o.unknown_bounce_visits} visits. A bounce requires a recorded exit without interaction or 30 seconds of foreground time; visits without an exit or a positive engagement signal stay unknown. Closing a tab is best effort.</p>
      <div className="grid md:grid-cols-3 gap-6">{[['Referrers', data.referrers], ['UTM sources', data.utm_sources], ['Devices', data.devices]].map(([title, rows]) => <Panel key={title} title={title}><Table columns={['Source / type', 'Visits']} rows={rows.map(r => [r.key, r.count])} /></Panel>)}</div>
      <div className="grid md:grid-cols-2 gap-6">{[['Countries', data.countries], ['Browsers', data.browsers]].map(([title, rows]) => <Panel key={title} title={title}><Table columns={['Group', 'Visits']} rows={rows.map(r => [r.key, r.count])} /></Panel>)}</div>
      <Panel title="Section engagement"><p className="text-sm text-gray-500 mb-3">Distinct visits with recorded foreground visibility; times accumulate across revisits. Visibility means any part of the section is in view, not proof of reading.</p><Table columns={['Section', 'Visits', 'Average foreground time']} rows={data.sections.map(s => [s.section, s.visits, duration(s.avg_seconds)])} /></Panel>
      <Panel title="Enquiry funnel · ordered visits"><Table columns={['Stage', 'Distinct visits', '% of starts']} rows={[[ 'Started', f.started ], ['Attempted after start', f.attempted], ['Accepted after matching attempt', f.accepted]].map(([label, n]) => [label, n, f.started ? `${Math.round(n / f.started * 100)}%` : '—'])} /><p className="text-sm text-gray-600 mt-3">{f.error} visits had an error; these can also succeed on retry. {f.attempts} attempts; {f.accepted_attempts} accepted attempts. Acceptance means Formspree returned success, not delivery or a qualified lead. {f.unmatched_accepted} acceptance events lacked a matching observed start/attempt.</p><details className="mt-4"><summary className="cursor-pointer">Field progress · independent, optional steps</summary><Table columns={['Field', 'Visits with progress']} rows={Object.entries(f.fields)} /><p className="text-sm text-gray-500 mt-2">Only field identifiers are measured. No names, addresses, music links or messages are displayed or collected by analytics.</p></details></Panel>
      <Panel title="Audio and example exposure"><Table columns={['Track', 'Recording', 'Exposed visits', 'Playing visits', 'Play starts', 'Foreground playback']} rows={data.audio.map(a => [a.track, a.version, a.exposed_visits, a.playing_visits, a.play_events, duration(a.foreground_seconds)])} /><p className="text-sm text-gray-500 mt-3">Playback starts only when media reports playing. Time excludes pauses, buffering and background windows. Exposures count cards that entered view; random example selection is not an experiment. Playback is not proof that sound was audible.</p></Panel>
      <Panel title="Hear more · Spotify · anonymous visits">
        <Table columns={['Observed signal', 'Distinct visits']} rows={[
          ['Player exposed', data.spotify.exposed_visits], ['Player ready · API', data.spotify.ready_visits],
          ['API unavailable / no ready signal', data.spotify.unavailable_visits], ['Iframe focus · interaction proxy', data.spotify.focus_visits],
          ['Playback started · API-reported', data.spotify.playback_started_visits],
          ['Exposed then interacted', data.spotify.exposed_then_interacted_visits], ['Accepted enquiry after interaction', data.spotify.accepted_after_interaction_visits],
        ]} />
        <p className="text-sm text-gray-500 my-3">{data.spotify.interacted_visits} interacting visits from {data.spotify.interacted_visitor_ids} browser IDs. Playback starts require Spotify’s official API signal. Focus may be a click or keyboard navigation, not a confirmed play. Missing API signals mean unobserved, not zero actual listening. Enquiries after interaction show sequence, not causation. No Spotify account identity, track history or off-site listening is collected.</p>
        <Table columns={['Anonymous visit', 'Started (UTC)', 'Device', 'Referral origin', 'Exposed', 'Focus', 'API start', 'Later accepted enquiry']} rows={data.spotify.recent_interactions.map(s => [s.visit, date(s.started_at), s.device, s.source, s.exposed ? 'Yes' : 'Unobserved', s.focused ? 'Yes' : 'Unobserved', s.playback_started ? 'Yes' : 'Unobserved', s.accepted_after ? 'Yes' : 'Unobserved'])} />
      </Panel>
      <Panel title="Interaction events"><Table columns={['Event', 'Count']} rows={data.events.map(e => [e.key, e.count])} /></Panel>
      <Panel title="Recent visits · selected period"><Table columns={['Started (UTC)', 'Country', 'Device', 'Foreground time', 'Bounce']} rows={data.recent_sessions.map(s => [date(s.started_at), s.country || 'Unknown', s.device_type || 'Unknown', duration(s.duration_seconds), s.is_bounce == null ? 'Unknown' : s.is_bounce ? 'Yes' : 'No'])} /></Panel>
      <p className="text-xs text-gray-500">Excluded from event summaries: {data.diagnostics.invalid_events} unsupported events, {data.diagnostics.outside_cohort_events} events outside the visit cohort. No partial report is shown when a database read fails.</p>
    </>}
  </div></main>;
}
