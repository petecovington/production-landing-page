import React, { useState, useEffect, useCallback } from 'react';

function formatDuration(seconds) {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-sm text-gray-500 uppercase tracking-wider font-mono mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function BarList({ title, items, maxCount }) {
  if (!items?.length) return null;
  const max = maxCount || items[0]?.count || 1;
  return (
    <div>
      <h3 className="text-sm font-mono uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 truncate max-w-[200px]">{item.key || 'Direct'}</span>
              <span className="text-gray-500 font-mono ml-2">{item.count}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded">
              <div className="h-1.5 bg-[#8B1E1E] rounded" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm text-gray-600 text-right">{label}</div>
      <div className="flex-1 h-6 bg-gray-100 rounded relative">
        <div className="h-6 bg-[#8B1E1E]/80 rounded" style={{ width: `${pct}%` }} />
        <span className="absolute left-2 top-0.5 text-xs text-white font-mono">{value} ({pct}%)</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('dash_pw') || '');
  const [input, setInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (pw, d) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/data?days=${d}`, {
        headers: { 'x-dashboard-password': pw },
      });
      if (res.status === 401) {
        setAuthError(true);
        setPassword('');
        sessionStorage.removeItem('dash_pw');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (password) fetchData(password, days);
  }, [password, days, fetchData]);

  const handleLogin = (e) => {
    e.preventDefault();
    sessionStorage.setItem('dash_pw', input);
    setPassword(input);
    setAuthError(false);
  };

  // Password gate
  if (!password || authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg p-8 w-80">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Analytics Dashboard</h1>
          {authError && <p className="text-red-600 text-sm mb-4">Incorrect password.</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#8B1E1E]"
              autoFocus
            />
            <button type="submit" className="w-full py-2 bg-[#8B1E1E] text-white rounded font-medium hover:bg-[#681212]">
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-600">{error}</div>;
  }

  if (!data) return null;

  const { overview, referrers, utm_sources, countries, cities, browsers, os, devices, sections, events, form_funnel, audio_plays, recent_sessions } = data;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-gray-500 text-sm">petecovington.com</p>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="text-sm text-gray-400">Refreshing...</span>}
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm bg-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={() => fetchData(password, days)}
              className="border border-gray-200 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              onClick={() => { sessionStorage.removeItem('dash_pw'); setPassword(''); }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Sessions" value={overview.total_sessions.toLocaleString()} />
          <StatCard label="Visitors" value={overview.unique_visitors.toLocaleString()} />
          <StatCard label="Bounce Rate" value={`${overview.bounce_rate}%`} />
          <StatCard label="Avg Duration" value={formatDuration(overview.avg_duration_seconds)} />
          <StatCard label="Avg Scroll" value={`${overview.avg_scroll_depth || 0}%`} />
          <StatCard label="Events" value={overview.total_events.toLocaleString()} />
        </div>

        {/* Traffic & Geo */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarList title="Referrers" items={referrers} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarList title="UTM Sources" items={utm_sources} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarList title="Countries" items={countries} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarList title="Cities" items={cities} />
          </div>
        </div>

        {/* Devices */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarList title="Device Type" items={devices} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarList title="Browsers" items={browsers} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <BarList title="Operating System" items={os} />
          </div>
        </div>

        {/* Section Engagement */}
        {sections?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
            <h3 className="text-sm font-mono uppercase tracking-wider text-gray-500 mb-4">Section Engagement</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-mono uppercase text-xs">Section</th>
                    <th className="pb-2 font-mono uppercase text-xs">Views</th>
                    <th className="pb-2 font-mono uppercase text-xs">Avg Time</th>
                    <th className="pb-2 w-48"></th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 font-medium">{s.section}</td>
                      <td className="py-2 text-gray-500">{s.views}</td>
                      <td className="py-2 text-gray-500">{formatDuration(s.avg_seconds)}</td>
                      <td className="py-2">
                        <div className="h-2 bg-gray-100 rounded">
                          <div
                            className="h-2 bg-[#8B1E1E]/70 rounded"
                            style={{ width: `${Math.min((s.avg_seconds / (sections[0]?.avg_seconds || 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Form Funnel & Audio Plays */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-mono uppercase tracking-wider text-gray-500 mb-4">Contact Form Funnel</h3>
            <div className="space-y-3">
              {[
                ['Started', form_funnel.started],
                ['Filled Name', form_funnel.filled_name],
                ['Filled Email', form_funnel.filled_email],
                ['Filled Music Link', form_funnel.filled_musicLink],
                ['Filled Message', form_funnel.filled_message],
                ['Submitted', form_funnel.submitted],
              ].map(([label, value]) => (
                <FunnelBar key={label} label={label} value={value} max={form_funnel.started || 1} />
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-mono uppercase tracking-wider text-gray-500 mb-4">Audio Plays</h3>
            {audio_plays?.length > 0
              ? <BarList title="" items={audio_plays} />
              : <p className="text-gray-400 text-sm">No plays recorded yet.</p>
            }
          </div>
        </div>

        {/* Events Breakdown */}
        {events?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
            <h3 className="text-sm font-mono uppercase tracking-wider text-gray-500 mb-4">All Events</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-mono uppercase text-xs">Type</th>
                    <th className="pb-2 font-mono uppercase text-xs">Name</th>
                    <th className="pb-2 font-mono uppercase text-xs text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-500 font-mono text-xs">{ev.type}</td>
                      <td className="py-1.5">{ev.name || '—'}</td>
                      <td className="py-1.5 text-right font-mono">{ev.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        {recent_sessions?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-mono uppercase tracking-wider text-gray-500 mb-4">Recent Sessions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-mono uppercase text-xs">Time</th>
                    <th className="pb-2 font-mono uppercase text-xs">Country</th>
                    <th className="pb-2 font-mono uppercase text-xs">City</th>
                    <th className="pb-2 font-mono uppercase text-xs">Referrer</th>
                    <th className="pb-2 font-mono uppercase text-xs">Device</th>
                    <th className="pb-2 font-mono uppercase text-xs">Duration</th>
                    <th className="pb-2 font-mono uppercase text-xs">Bounce</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_sessions.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-500 whitespace-nowrap">{formatDate(s.started_at)}</td>
                      <td className="py-1.5">{s.country || '—'}</td>
                      <td className="py-1.5 text-gray-500">{s.city || '—'}</td>
                      <td className="py-1.5 text-gray-500 max-w-[150px] truncate">{s.referrer || 'Direct'}</td>
                      <td className="py-1.5 text-gray-500">{s.device_type || '—'}</td>
                      <td className="py-1.5 font-mono">{formatDuration(s.duration_seconds)}</td>
                      <td className="py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${s.is_bounce ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                          {s.is_bounce ? 'yes' : 'no'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
