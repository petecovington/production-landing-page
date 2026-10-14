import { authorized } from './stables.js';
// Server only. Never return or retain subscriber details in analytics.
export async function confirmedTotal(key, request = fetch) {
  const ids = new Set(), cursors = new Set();
  let after;
  for (let page = 0; page < 100; page++) {
    const url = new URL('https://api.kit.com/v4/forms/9485257/subscribers');
    url.searchParams.set('status', 'active'); url.searchParams.set('per_page', '500'); url.searchParams.set('slim', 'true');
    if (after) url.searchParams.set('after', after);
    const response = await request(url.href, { headers: { 'X-Kit-Api-Key': key }, redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Error('Kit unavailable');
    const body = await response.json();
    if (!Array.isArray(body.subscribers) || typeof body.pagination?.has_next_page !== 'boolean') throw Error('Invalid Kit response');
    for (const subscriber of body.subscribers) {
      if (!Number.isSafeInteger(subscriber.id) || subscriber.state !== 'active') throw Error('Invalid Kit subscriber');
      ids.add(subscriber.id);
    }
    if (!body.pagination.has_next_page) return ids.size;
    after = body.pagination.end_cursor;
    if (typeof after !== 'string' || !after || cursors.has(after)) throw Error('Invalid Kit pagination');
    cursors.add(after);
  }
  throw Error('Kit report too large');
}
export function kitHandler(password, key, request = fetch) {
  let cached, inflight;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).end();
    if (!authorized(req, password)) return res.status(401).json({ error: 'Unauthorized' });
    if (!key) return res.status(200).json({ status: 'not_connected', total: null });
    try {
      if (!cached || Date.now() - cached.at > 60000) {
        inflight ||= confirmedTotal(key, request).then(total => ({ total, at: Date.now() })).finally(() => { inflight = null; });
        cached = await inflight;
      }
      return res.status(200).json({ status: 'connected', total: cached.total, checked_at: new Date(cached.at).toISOString(), form_id: '9485257' });
    } catch { return res.status(503).json({ status: 'unavailable', total: null }); }
  };
}
