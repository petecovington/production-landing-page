import { authorized, readAll } from './stables.js';
import { dayKey, dayStart, shiftDay } from './stables-time.js';
const DAY = 86400000;
const columns = 'id,title,url,published_at,views_48h,views_7d,updated_at';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function cleanPost(body) {
  if (typeof body === 'string') { if (body.length > 4096) throw Error(); body = JSON.parse(body); }
  if (!body || !uuid(body.id) || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120) throw Error();
  const url = new URL(body.url);
  if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.username || url.password || !/^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) throw Error();
  if (typeof body.published_at !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(body.published_at) || !Number.isFinite(Date.parse(body.published_at))) throw Error();
  const row = { id: body.id, title: body.title.trim(), url: url.origin + url.pathname, published_at: new Date(body.published_at).toISOString() };
  for (const field of ['views_48h', 'views_7d']) {
    if (body[field] != null && (!Number.isSafeInteger(body[field]) || body[field] < 0)) throw Error();
    row[field] = body[field] ?? null;
  }
  return row;
}
export function buildFunnel(visits, events, posts, coverage, now, days = 30) {
  const end = Date.parse(now), start = Date.parse(coverage);
  const clean = visits.filter(v => !v.is_test && Date.parse(v.started_at) <= end);
  const ids = new Set(clean.map(v => v.id));
  const first = new Map();
  for (const e of events) {
    const time = Date.parse(e.created_at);
    if (e.kind === 'submission' && ids.has(e.visit_id) && time <= end && (!first.has(e.visit_id) || time < first.get(e.visit_id))) first.set(e.visit_id, time);
  }
  const count = (a, b) => ({ visits: clean.filter(v => Date.parse(v.started_at) >= a && Date.parse(v.started_at) < b).length, signups: [...first.values()].filter(t => t >= a && t < b).length });
  const daily = Array.from({ length: days }, (_, i) => {
    const date = shiftDay(dayKey(end), i - days + 1), a = dayStart(date), b = dayStart(shiftDay(date, 1));
    return { date, ...(Number.isFinite(start) && b > start ? count(Math.max(a, start), Math.min(b, end + 1)) : { visits: null, signups: null }), partial: a < start || b > end };
  });
  const summaries = posts.map(post => {
    const at = Date.parse(post.published_at), baselineDays = [];
    for (let i = 28; i >= 1; i--) {
      const date = shiftDay(dayKey(at), -i), a = dayStart(date), b = dayStart(shiftDay(date, 1));
      if (a < start || !Number.isFinite(start) || b > end) continue;
      if (posts.some(p => Date.parse(p.published_at) < b && Date.parse(p.published_at) + 7 * DAY > a)) continue;
      baselineDays.push(count(a, b));
    }
    const baseline = { days: baselineDays.length, visits: null, signups: null };
    if (baselineDays.length >= 7) for (const metric of ['visits', 'signups']) baseline[metric] = baselineDays.reduce((s, d) => s + d[metric], 0) / baselineDays.length;
    const windows = [2, 7].map(length => {
      const until = at + length * DAY;
      const state = !Number.isFinite(start) || at < start ? 'missing' : at >= end ? 'not_started' : until > end ? 'in_progress' : 'complete';
      const counts = ['complete', 'in_progress'].includes(state) ? count(at, Math.min(until, end + 1)) : { visits: null, signups: null };
      const expected = state === 'complete' && baseline.days >= 7 ? { visits: baseline.visits * length, signups: baseline.signups * length } : null;
      return { days: length, state, until: new Date(until).toISOString(), ...counts, expected,
        overlaps: posts.filter(p => p.id !== post.id && Date.parse(p.published_at) < Math.min(until, end) && Date.parse(p.published_at) + 7 * DAY > at).map(p => p.title) };
    });
    return { ...post, baseline, windows };
  });
  const chartFrom = dayStart(daily[0].date);
  const inRange = clean.filter(v => Date.parse(v.started_at) >= chartFrom);
  const sources = ['instagram_bio', 'instagram_story', 'other', 'unknown'].map(source => {
    const matching = inRange.filter(v => (v.source || 'unknown') === source), matchingIds = new Set(matching.map(v => v.id));
    return { source, visits: matching.length, signups: [...first].filter(([id,t]) => matchingIds.has(id) && t >= chartFrom).length };
  });
  return { daily, posts: summaries, sources, coverage_start: coverage, as_of: now, timezone: 'Australia/Sydney' };
}
export function funnelHandler(db, password, clock = () => new Date()) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).end();
    if (!authorized(req, password)) return res.status(401).json({ error: 'Please sign in again.' });
    if (req.method === 'POST') {
      let row, previous;
      try { const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; row = cleanPost(body); previous = body.updated_at; if (previous != null && !Number.isFinite(Date.parse(previous))) throw Error(); }
      catch { return res.status(400).json({ error: 'Check the title, Instagram post link, date and view counts.' }); }
      try {
        const write = previous ? db.from('stables_posts').update({ ...row, updated_at: clock().toISOString() }).eq('id', row.id).eq('updated_at', previous) : db.from('stables_posts').insert(row);
        const result = await write.select(columns).maybeSingle();
        if (result.error?.code === '23505' || (!result.error && !result.data)) return res.status(409).json({ error: 'This post changed. Refresh and try again.' });
        if (result.error) throw Error();
        return res.status(200).json(result.data);
      } catch { return res.status(503).json({ error: 'Could not save the post. Your entries are still here.' }); }
    }
    try {
      const [visits, events, posts, settings] = await Promise.all([
        readAll(() => db.from('stables_visits').select('id,started_at,source').eq('is_test', false).order('started_at').order('id')),
        readAll(() => db.from('stables_events').select('visit_id,kind,created_at').eq('kind', 'submission').order('created_at').order('id')),
        readAll(() => db.from('stables_posts').select(columns).order('published_at', { ascending: false }).order('id')),
        db.from('stables_reporting').select('coverage_start').eq('id', 1).single()
      ]);
      if (settings.error) throw Error();
      return res.status(200).json(buildFunnel(visits, events, posts, settings.data.coverage_start, clock().toISOString(), [7,30,90].includes(Number(req.query?.days)) ? Number(req.query.days) : 30));
    } catch { return res.status(503).json({ error: 'Could not load daily visits and posts. Please try again.' }); }
  };
}
