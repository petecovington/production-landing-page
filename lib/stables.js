import { timingSafeEqual } from 'node:crypto';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const FORMS = { '9485257': { name: 'PDF breakdowns', page: '/breakdowns.html', thanks: '/confirmation.html' }, '9486070': { name: 'Workshops', page: '/workshops.html', thanks: '/workshops-confirmation.html' } };
const pages = new Set(['/', '/the-archive.html', ...Object.values(FORMS).flatMap(f => [f.page, f.thanks])]);
export function sanitize(body) {
  if (typeof body === 'string') { if (body.length > 1024) throw Error(); body = JSON.parse(body); }
  if (!body || !uuid(body.id) || !uuid(body.visit_id) || !pages.has(body.page)) throw Error();
  const row = { id: body.id, visit_id: body.visit_id, page: body.page, kind: body.kind };
  if (body.kind === 'page') return row;
  const form = FORMS[body.form_id];
  if (!form || !['attempt', 'submission'].includes(body.kind) || !((body.kind === 'attempt' ? [form.page] : [form.page, form.thanks]).includes(body.page))) throw Error();
  row.form_id = body.form_id;
  if (body.kind === 'submission') { if (!uuid(body.attempt_id)) throw Error(); row.attempt_id = body.attempt_id; }
  return row;
}
export function authorized(req, password) {
  const value = req.headers['x-dashboard-password'];
  return typeof password === 'string' && password.length > 0 && typeof value === 'string' && Buffer.byteLength(value) === Buffer.byteLength(password) && timingSafeEqual(Buffer.from(value), Buffer.from(password));
}
export function cors(req, res) {
  const origin = req.headers.origin;
  if (!['https://thestables.music', 'https://www.thestables.music'].includes(origin)) { res.status(403).end(); return false; }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}
export function eventHandler(db) {
  return async (req, res) => {
    if (!cors(req, res)) return;
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).end();
    let row, isTest;
    try { const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; row = sanitize(body); isTest = body.is_test === true; } catch { return res.status(400).json({ error: 'Invalid measurement' }); }
    if (/bot|crawl|spider|Headless|selenium|webdriver|Vercel/i.test(req.headers['user-agent'] || '')) return res.status(200).json({ ok: true });
    try {
      if (row.kind === 'submission') {
        const { data: attempt, error } = await db.from('stables_events').select('id,visit_id,kind,form_id,created_at').eq('id', row.attempt_id).maybeSingle();
        const age = Date.now() - Date.parse(attempt?.created_at);
        if (error) throw Error();
        if (!attempt || attempt.kind !== 'attempt' || attempt.visit_id !== row.visit_id || attempt.form_id !== row.form_id || !Number.isFinite(age) || age < 0 || age > 30 * 60 * 1000) return res.status(409).json({ error: 'No matching recent submission' });
      }
      const visit = await db.from('stables_visits').upsert({ id: row.visit_id, is_test: isTest }, { onConflict: 'id', ignoreDuplicates: true });
      if (visit.error) throw Error();
      const event = await db.from('stables_events').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
      if (event.error) throw Error();
      return res.status(200).json({ ok: true });
    } catch { return res.status(503).json({ error: 'Tracking unavailable' }); }
  };
}
export function buildReport(visits, events, period) {
  const ids = new Set(visits.filter(v => !v.is_test).map(v => v.id));
  const valid = events.filter(e => ids.has(e.visit_id));
  const submitted = new Set(valid.filter(e => e.kind === 'submission').map(e => e.visit_id));
  return { ...period, visits: ids.size, submitted_visits: submitted.size, submission_rate: ids.size ? Math.round(submitted.size / ids.size * 1000) / 10 : null,
    forms: Object.entries(FORMS).map(([id, f]) => { const viewed = new Set(valid.filter(e => e.kind === 'page' && e.page === f.page).map(e => e.visit_id)); const sent = new Set(valid.filter(e => e.kind === 'submission' && e.form_id === id).map(e => e.visit_id)); return { name: f.name, visits: viewed.size, submissions: sent.size }; }),
    pages: [...pages].map(page => ({ page, visits: new Set(valid.filter(e => e.kind === 'page' && e.page === page).map(e => e.visit_id)).size })) };
}
export async function readAll(query) {
  const rows = [];
  for (let offset = 0; offset < 100000;) {
    const { data, error } = await query().range(offset, offset + 999);
    if (error || !Array.isArray(data)) throw Error();
    if (!data.length) return rows;
    rows.push(...data); offset += data.length;
  }
  throw Error('Report too large');
}
export function dataHandler(db, password, clock = () => new Date()) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).end();
    if (!authorized(req, password)) return res.status(401).json({ error: 'Unauthorized' });
    const days = [7, 30, 90].includes(Number(req.query?.days)) ? Number(req.query.days) : 30;
    const to = clock().toISOString(), from = new Date(Date.parse(to) - days * 86400000).toISOString();
    try {
      const visits = await readAll(() => db.from('stables_visits').select('id,started_at').eq('is_test', false).gte('started_at', from).lte('started_at', to).order('started_at').order('id'));
      const events = await readAll(() => db.from('stables_events').select('visit_id,kind,page,form_id').gte('created_at', from).lte('created_at', to).order('created_at').order('id'));
      return res.status(200).json(buildReport(visits, events, { from, to, days }));
    } catch { return res.status(503).json({ error: 'Stables tracking is not available yet.' }); }
  };
}
