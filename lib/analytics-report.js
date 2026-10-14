import { sanitizeEvent, originOnly } from './analytics-contract.js';

// Keyset pagination handles server-imposed caps smaller than our requested page size.
// Fail explicitly instead of returning an apparently complete truncated dashboard.
export async function readAll(makeQuery, key = 'id', maxPages = 200) {
  const rows = []; let cursor;
  for (let page = 0; page < maxPages; page++) {
    let query = makeQuery().order(key, { ascending: true }).limit(500);
    if (cursor !== undefined) query = query.gt(key, cursor);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) throw new Error('Analytics read failed');
    if (!data.length) return rows;
    const next = data[data.length - 1][key];
    if (next == null || next === cursor) throw new Error('Analytics pagination stalled');
    rows.push(...data); cursor = next;
  }
  throw new Error('Analytics report exceeds its query budget');
}
const mean = values => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
function breakdown(values, limit = 10) {
  const counts = new Map();
  values.forEach(value => counts.set(value || 'Unknown', (counts.get(value || 'Unknown') || 0) + 1));
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}
function latest(map, key, event) {
  if (!map.has(key) || event.metadata.sequence > map.get(key).metadata.sequence) map.set(key, event);
}
export function buildReport(sessions, inputEvents, { days, from, to }) {
  const ids = new Set(sessions.map(s => s.id));
  const seen = new Set(); let invalidEvents = 0, orphanEvents = 0;
  const events = [];
  for (const raw of inputEvents) {
    if (!ids.has(raw.session_id)) { orphanEvents++; continue; }
    let e;
    try { e = { ...sanitizeEvent(raw), created_at: raw.created_at }; } catch { invalidEvents++; continue; }
    if (e.metadata.measurement_version === 2) {
      const key = `${e.session_id}:${e.metadata.sequence}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    events.push(e);
  }
  const modern = events.filter(e => e.metadata.measurement_version === 2);
  const legacy = events.filter(e => e.metadata.measurement_version !== 2);
  const modernIds = new Set(modern.map(e => e.session_id));
  const snapshots = new Map(), sections = new Map(), audioTimes = new Map();
  modern.forEach(e => {
    if (e.event_type === 'session_snapshot') latest(snapshots, e.session_id, e);
    if (e.event_type === 'section_view') latest(sections, `${e.session_id}:${e.event_name}`, e);
    if (e.event_type === 'audio_progress') latest(audioTimes, `${e.session_id}:${e.event_name}:${e.metadata.version}`, e);
  });
  const visits = sessions.map(s => {
    const m = snapshots.get(s.id)?.metadata;
    // Legacy timing is never mixed into foreground-time or bounce calculations.
    return { id: s.id, started_at: s.started_at, country: s.country, device_type: s.device_type,
      referrer: originOnly(s.referrer) || 'Direct / unknown', measurement_version: modernIds.has(s.id) ? 2 : null,
      duration_seconds: m?.duration_seconds ?? null, max_scroll_depth: m?.max_scroll_depth ?? null,
      is_bounce: m ? (m.engaged ? false : m.final ? true : null) : null };
  });
  const measured = visits.filter(s => s.duration_seconds !== null);
  const classified = visits.filter(s => s.is_bounce !== null);
  const sectionReport = [...new Set([...sections.values()].map(e => e.event_name))].map(name => {
    const rows = [...sections.values()].filter(e => e.event_name === name);
    return { section: name, visits: rows.length, avg_seconds: mean(rows.map(e => e.metadata.duration_seconds)) };
  }).sort((a, b) => b.visits - a.visits);

  const forms = new Map();
  modern.filter(e => e.event_type === 'form').sort((a, b) => a.metadata.sequence - b.metadata.sequence).forEach(e => {
    const f = forms.get(e.session_id) || { started: false, attempted: false, accepted: false, error: false, fields: new Set(), attempts: new Set(), acceptedAttempts: new Set() };
    const m = e.metadata;
    if (e.event_name === 'Started') f.started = true;
    if (f.started && e.event_name === 'Progress') f.fields.add(m.field);
    if (f.started && e.event_name === 'Attempt') { f.attempted = true; f.attempts.add(m.attempt_id); }
    if (f.attempts.has(m.attempt_id) && e.event_name === 'Accepted') { f.accepted = true; f.acceptedAttempts.add(m.attempt_id); }
    if (f.attempts.has(m.attempt_id) && e.event_name === 'Error') f.error = true;
    forms.set(e.session_id, f);
  });
  const formVisits = [...forms.values()];
  const form = Object.fromEntries(['started', 'attempted', 'accepted', 'error'].map(k => [k, formVisits.filter(f => f[k]).length]));
  form.fields = Object.fromEntries(['name', 'email', 'musicLink', 'message'].map(k => [k, formVisits.filter(f => f.fields.has(k)).length]));
  form.attempts = formVisits.reduce((n, f) => n + f.attempts.size, 0);
  form.accepted_attempts = formVisits.reduce((n, f) => n + f.acceptedAttempts.size, 0);
  form.unmatched_accepted = modern.filter(e => e.event_type === 'form' && e.event_name === 'Accepted' && !forms.get(e.session_id)?.acceptedAttempts.has(e.metadata.attempt_id)).length;

  const exposed = new Map(), played = new Map(), plays = new Map();
  modern.forEach(e => {
    if (e.event_type === 'example_exposure') {
      if (!exposed.has(e.event_name)) exposed.set(e.event_name, new Set());
      exposed.get(e.event_name).add(e.session_id);
    }
    if (e.event_type === 'audio_play') {
      const key = `${e.event_name} · ${e.metadata.version}`;
      if (!played.has(key)) played.set(key, new Set());
      played.get(key).add(e.session_id); plays.set(key, (plays.get(key) || 0) + 1);
    }
  });
  const audio = [...new Set([...exposed.keys(), ...modern.filter(e => e.event_type === 'audio_play').map(e => e.event_name)])].flatMap(track => ['demo', 'produced'].map(version => {
    const key = `${track} · ${version}`;
    const rows = [...audioTimes.values()].filter(e => e.event_name === track && e.metadata.version === version);
    return { track, version, exposed_visits: exposed.get(track)?.size || 0, playing_visits: played.get(key)?.size || 0, play_events: plays.get(key) || 0,
      foreground_seconds: Math.round(rows.reduce((sum, e) => sum + e.metadata.duration_seconds, 0)) };
  }));
  const spotifyEvents = modern.filter(e => e.event_type === 'spotify');
  const spotifyNames = ['Exposed', 'Focus', 'Ready', 'Unavailable', 'Playback started'];
  const spotifySets = Object.fromEntries(spotifyNames.map(name => [name, new Set(spotifyEvents.filter(e => e.event_name === name).map(e => e.session_id))]));
  const interactions = spotifyEvents.filter(e => ['Focus', 'Playback started'].includes(e.event_name));
  const interacted = new Set(interactions.map(e => e.session_id));
  const afterInteraction = new Set(modern.filter(e => e.event_type === 'form' && e.event_name === 'Accepted'
    && forms.get(e.session_id)?.acceptedAttempts.has(e.metadata.attempt_id)
    && interactions.some(i => i.session_id === e.session_id && i.metadata.sequence < e.metadata.sequence)).map(e => e.session_id));
  const spotify = {
    exposed_visits: spotifySets.Exposed.size, focus_visits: spotifySets.Focus.size,
    ready_visits: spotifySets.Ready.size, unavailable_visits: spotifySets.Unavailable.size,
    playback_started_visits: spotifySets['Playback started'].size,
    interacted_visits: interacted.size,
    exposed_then_interacted_visits: new Set(interactions.filter(i => spotifyEvents.some(e => e.session_id === i.session_id && e.event_name === 'Exposed' && e.metadata.sequence < i.metadata.sequence)).map(e => e.session_id)).size,
    accepted_after_interaction_visits: afterInteraction.size,
    interacted_visitor_ids: new Set(sessions.filter(s => interacted.has(s.id)).map(s => s.visitor_id)).size,
    recent_interactions: visits.filter(s => interacted.has(s.id)).sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 25).map(s => ({
      visit: s.id.slice(-8), started_at: s.started_at, device: s.device_type || 'Unknown', source: s.referrer,
      exposed: spotifySets.Exposed.has(s.id), focused: spotifySets.Focus.has(s.id),
      playback_started: spotifySets['Playback started'].has(s.id), accepted_after: afterInteraction.has(s.id),
    })),
  };
  return {
    period_days: days, from, to, complete: true,
    overview: { total_sessions: visits.length, unique_visitors: new Set(sessions.map(s => s.visitor_id).filter(Boolean)).size,
      v2_visits: modernIds.size, legacy_visits: visits.length - modernIds.size, measured_visits: measured.length,
      unknown_bounce_visits: visits.length - classified.length,
      bounce_rate: classified.length ? Math.round(classified.filter(s => s.is_bounce).length / classified.length * 1000) / 10 : null,
      avg_duration_seconds: mean(measured.map(s => s.duration_seconds)), avg_scroll_depth: mean(measured.map(s => s.max_scroll_depth)),
      total_events: events.filter(e => e.event_type !== 'session_snapshot').length },
    referrers: breakdown(sessions.map(s => originOnly(s.referrer) || 'Direct / unknown')),
    utm_sources: breakdown(sessions.map(s => s.utm_source || 'Unattributed')),
    countries: breakdown(sessions.map(s => s.country)), devices: breakdown(sessions.map(s => s.device_type)),
    browsers: breakdown(sessions.map(s => s.browser)),
    sections: sectionReport, form_funnel: form, audio, spotify,
    events: breakdown(modern.filter(e => !['session_snapshot', 'section_view', 'audio_progress'].includes(e.event_type)).map(e => `${e.event_type}: ${e.event_name}`), 30),
    legacy: { events: legacy.length, submitted_events: legacy.filter(e => e.event_type === 'form' && e.event_name === 'Submitted').length,
      started_events: legacy.filter(e => e.event_type === 'form' && e.event_name === 'Started').length },
    diagnostics: { invalid_events: invalidEvents, outside_cohort_events: orphanEvents },
    recent_sessions: visits.sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 25),
  };
}

// Project only approved JSON properties. Historical raw form metadata is never fetched.
const META_FIELDS = ['measurement_version', 'sequence', 'duration_seconds', 'max_scroll_depth', 'engaged', 'final', 'field', 'attempt_id', 'error_code', 'status', 'version', 'position'];
export const EVENT_SELECT = ['id', 'session_id', 'visitor_id', 'event_type', 'event_name', 'seconds_on_page', 'created_at', ...META_FIELDS.map(k => `${k}:metadata->${k}`)].join(',');
export function dataHandler(db, password, clock = () => new Date()) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).end();
    if (!password || req.headers['x-dashboard-password'] !== password) return res.status(401).json({ error: 'Unauthorized' });
    const days = Number(req.query?.days || 30);
    if (![7, 30, 90].includes(days)) return res.status(400).json({ error: 'Invalid period' });
    const to = clock().toISOString(), from = new Date(new Date(to).getTime() - days * 86400000).toISOString();
    try {
      const [sessions, rawEvents] = await Promise.all([
        readAll(() => db.from('sessions').select('id, visitor_id, started_at, referrer, country, browser, device_type, utm_source').gte('started_at', from).lte('started_at', to)),
        readAll(() => db.from('events').select(EVENT_SELECT).gte('created_at', from).lte('created_at', to)),
      ]);
      const events = rawEvents.map(row => ({ ...row, metadata: Object.fromEntries(META_FIELDS.filter(k => row[k] != null).map(k => [k, row[k]])) }));
      return res.status(200).json(buildReport(sessions, events, { days, from, to }));
    } catch {
      return res.status(503).json({ error: 'Report unavailable or incomplete. Please retry; no partial totals are shown.' });
    }
  };
}
