import { sanitizeEvent, originOnly, validId, finite } from './analytics-contract.js';

export function parseBody(req) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  if (JSON.stringify(body).length > 8192) throw new Error('Body too large');
  return body;
}
export async function writeResult(res, query) {
  try {
    const { error } = await query;
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch {
    // Do not log database error details, which can contain request values.
    console.error('Analytics database write failed');
    return res.status(503).json({ error: 'Analytics temporarily unavailable' });
  }
}
export function eventHandler(db) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();
    let event;
    try {
      const body = parseBody(req);
      if (body.metadata?.measurement_version !== 2) return res.status(410).json({ error: 'Unsupported measurement version' });
      event = sanitizeEvent(body);
    } catch { return res.status(400).json({ error: 'Invalid event' }); }
    // Counts are derived from events. Avoid a separate, non-transactional counter RPC.
    return writeResult(res, db.from('events').insert(event));
  };
}
function parseUA(ua) {
  return {
    browser: /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other',
    os: /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other',
    device_type: /iPhone|Android.*Mobile/.test(ua) ? 'mobile' : /iPad|Android/.test(ua) ? 'tablet' : 'desktop',
  };
}
const campaign = value => typeof value === 'string' && /^[a-zA-Z0-9_. -]{1,80}$/.test(value) ? value : null;
export function sessionHandler(db) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();
    let body;
    try {
      body = parseBody(req);
      if (body.measurement_version !== 2) return res.status(410).json({ error: 'Unsupported measurement version' });
      if (!validId(body.id) || !validId(body.visitor_id)) throw new Error();
    }
    catch { return res.status(400).json({ error: 'Invalid session' }); }
    const ua = String(req.headers['user-agent'] || body.user_agent || '').slice(0, 500);
    if (/Headless|bot|crawl|spider|prerender|phantom|selenium|webdriver|Vercel/i.test(ua)) return res.status(200).json({ ok: true, ignored: true });
    const session = { id: body.id, visitor_id: body.visitor_id, referrer: originOnly(body.referrer),
      utm_source: campaign(body.utm_source), utm_medium: campaign(body.utm_medium), utm_campaign: campaign(body.utm_campaign),
      ...parseUA(ua), screen_width: finite(body.screen_width, 20000) ? body.screen_width : null,
      screen_height: finite(body.screen_height, 20000) ? body.screen_height : null,
      country: req.headers['x-vercel-ip-country'] || null, city: req.headers['x-vercel-ip-city'] || null,
      // No IP lookup or raw user-agent retention. Unknown is distinct from bounced.
      is_bounce: null,
    };
    return writeResult(res, db.from('sessions').upsert(session, { onConflict: 'id', ignoreDuplicates: true }));
  };
}
export function exitHandler() {
  // V2 uses session_snapshot events. Retired clients must not restore legacy state.
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();
    return res.status(410).json({ error: 'Legacy exit tracking retired' });
  };
}
