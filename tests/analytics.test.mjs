import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from '../src/analytics.js';
import { submitContact } from '../src/submit-contact.js';
import { sanitizeEvent } from '../lib/analytics-contract.js';
import { buildReport, readAll, dataHandler, EVENT_SELECT } from '../lib/analytics-report.js';
import { eventHandler, sessionHandler, exitHandler } from '../lib/analytics-api.js';
import { uid, event, session, fixtureReport } from './fixtures.mjs';

function fakeBrowser({ hostname = 'example.test', search = '', storage = new Map() } = {}) {
  let ms = 0, id = 200, focus = true;
  const win = new EventTarget(), doc = new EventTarget(), requests = [], timers = new Set();
  Object.assign(win, { location: { hostname, search }, screen: { width: 1000, height: 800 }, innerHeight: 800, scrollY: 0,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } });
  Object.assign(doc, { visibilityState: 'visible', referrer: 'https://google.com/search?q=private', hasFocus: () => focus, documentElement: { scrollHeight: 1600 } });
  const client = createAnalytics({ window: win, document: doc, navigator: { userAgent: 'Safari', language: 'en', webdriver: false },
    crypto: { randomUUID: () => uid(id++) }, now: () => ms, fetch: async (url, options) => { requests.push({ url, ...JSON.parse(options.body) }); return { ok: true }; },
    setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn) });
  return { client, requests, doc, win, timers, storage, tick: seconds => { ms += seconds * 1000; },
    focus(value) { focus = value; win.dispatchEvent(new Event(value ? 'focus' : 'blur')); },
    visibility(value) { doc.visibilityState = value; doc.dispatchEvent(new Event('visibilitychange')); } };
}
const response = () => ({ code: null, body: null, status(n) { this.code = n; return this; }, json(x) { this.body = x; return this; }, end() { return this; }, setHeader() {} });
const period = { days: 30, from: '2026-09-14T10:00:00Z', to: '2026-10-14T10:00:00Z' };

test('legacy and modern form metadata never retain field contents or arbitrary errors', () => {
  const old = { ...event(1, 1, 'form', 'Filled email'), metadata: { value: 'private@example.test', message: 'secret' } };
  assert.deepEqual(sanitizeEvent(old).metadata, {});
  const next = sanitizeEvent(event(1, 2, 'form', 'Progress', { field: 'email', value: 'private@example.test' }));
  assert.equal(JSON.stringify(next).includes('private'), false);
  assert.throws(() => sanitizeEvent(event(1, 3, 'form', 'Error', { attempt_id: uid(500), error_code: 'personal text' })));
  assert.throws(() => sanitizeEvent(event(1, 4, 'form', 'private@example.test')));
});

test('foreground timing excludes hidden and unfocused time; cumulative snapshots are monotonic', () => {
  const b = fakeBrowser(); b.client.init(); b.client.trackSectionEnter('proof'); b.client.playback('Breathe', 'demo', true);
  b.tick(5); b.visibility('hidden'); b.tick(100); b.visibility('visible'); b.tick(3); b.focus(false); b.tick(100); b.focus(true); b.tick(2); b.client.flush();
  const last = type => b.requests.filter(x => x.event_type === type).at(-1).metadata.duration_seconds;
  assert.equal(last('session_snapshot'), 10); assert.equal(last('section_view'), 10); assert.equal(last('audio_progress'), 10);
  const snapshot = b.requests.filter(x => x.event_type === 'session_snapshot').at(-1);
  assert.equal(snapshot.metadata.engaged, true);
});

test('strict-mode mount/cleanup/remount creates one session and one timer; cleanup stops tracking', () => {
  const b = fakeBrowser(); const clean = b.client.init(); clean(); b.client.init();
  assert.equal(b.requests.filter(r => r.url.endsWith('/session')).length, 1); assert.equal(b.timers.size, 1);
  b.client.cleanup(); const count = b.requests.length; b.tick(50); b.win.dispatchEvent(new Event('scroll')); b.client.track('click', 'Substack');
  assert.equal(b.requests.length, count); assert.equal(b.timers.size, 0);
});

test('local and explicitly excluded browsers make no requests; opt-in clears exclusion only on next load', () => {
  for (const options of [{ hostname: 'localhost' }, { search: '?analytics=off' }, { storage: new Map([['analytics_excluded', '1']]) }]) {
    const b = fakeBrowser(options); b.client.init(); b.client.track('form', 'Started'); assert.equal(b.requests.length, 0);
  }
  const b = fakeBrowser({ search: '?analytics=on', storage: new Map([['analytics_excluded', '1']]) }); b.client.init(); assert.ok(b.requests.length > 0);
});

test('pagehide flushes a final snapshot, bfcache pageshow resumes foreground measurement', () => {
  const b = fakeBrowser(); b.client.init(); b.tick(4); b.win.dispatchEvent(new Event('pagehide'));
  assert.equal(b.requests.at(-1).metadata.final, true); b.tick(40); b.win.dispatchEvent(new Event('pageshow')); b.tick(2); b.client.flush();
  assert.equal(b.requests.at(-1).metadata.duration_seconds, 6); assert.equal(b.requests.at(-1).metadata.final, false);
});

test('example exposure requires foreground visibility and deduplicates per visit', () => {
  const b = fakeBrowser(); b.client.init(); b.visibility('hidden'); b.client.exampleExposure('Breathe', 1, true);
  assert.equal(b.requests.filter(e => e.event_type === 'example_exposure').length, 0);
  b.visibility('visible'); b.client.exampleExposure('Breathe', 1, true); b.client.exampleExposure('Breathe', 1, false); b.client.exampleExposure('Breathe', 1, true);
  assert.equal(b.requests.filter(e => e.event_type === 'example_exposure').length, 1);
});

test('audio separates recordings, starts only on playback signal, and stops accumulating when paused', () => {
  const b = fakeBrowser(); b.client.init(); b.tick(4); assert.equal(b.requests.filter(e => e.event_type === 'audio_play').length, 0);
  b.client.playback('Breathe', 'demo', true); b.tick(3); b.client.playback('Breathe', 'demo', false); b.tick(5);
  b.client.playback('Breathe', 'produced', true); b.tick(2); b.client.playback('Breathe', 'produced', false);
  const progress = b.requests.filter(e => e.event_type === 'audio_progress');
  assert.equal(progress.find(e => e.metadata.version === 'demo').metadata.duration_seconds, 3);
  assert.equal(progress.find(e => e.metadata.version === 'produced').metadata.duration_seconds, 2);
});

test('submission helper preserves Formspree delivery but reports only allowlisted success/failure metadata', async () => {
  for (const outcome of [200, 422, 'network']) {
    const tracked = [], delivered = [];
    const ok = await submitContact({ name: 'PRIVATE', email: 'private@example.test', message: 'PRIVATE' }, {
      attemptId: uid(500), track: (...args) => tracked.push(args), request: async (url, options) => {
        delivered.push({ url, options }); if (outcome === 'network') throw new Error('PRIVATE'); return { ok: outcome === 200, status: outcome };
      },
    });
    assert.equal(delivered[0].url, 'https://formspree.io/f/mbdlpyno'); assert.match(delivered[0].options.body, /PRIVATE/);
    assert.equal(JSON.stringify(tracked).includes('PRIVATE'), false); assert.equal(ok, outcome === 200);
    assert.deepEqual(tracked.map(e => e[1]), ['Attempt', outcome === 200 ? 'Accepted' : 'Error']);
  }
});

test('ordered visit funnel ignores acceptance before attempt, tolerates network reorder, deduplicates retries', () => {
  const es = [event(1, 1, 'form', 'Started'), event(1, 2, 'form', 'Progress', { field: 'email' }), event(1, 3, 'form', 'Progress', { field: 'email' }),
    event(1, 4, 'form', 'Attempt', { attempt_id: uid(500) }), event(1, 5, 'form', 'Error', { attempt_id: uid(500), error_code: 'network' }),
    event(1, 6, 'form', 'Attempt', { attempt_id: uid(501) }), event(1, 7, 'form', 'Accepted', { attempt_id: uid(501) }),
    event(2, 1, 'form', 'Accepted', { attempt_id: uid(502) }), event(2, 2, 'form', 'Started'), event(2, 3, 'form', 'Attempt', { attempt_id: uid(502) })];
  const r = buildReport([session(1), session(2)], [...es.reverse(), es[0]], period);
  assert.equal(r.form_funnel.started, 2); assert.equal(r.form_funnel.accepted, 1); assert.equal(r.form_funnel.fields.email, 1);
  assert.equal(r.form_funnel.error, 1); assert.equal(r.form_funnel.unmatched_accepted, 1);
});

test('missing timing remains unknown, legacy figures stay separate, form content is absent from response', () => {
  const es = [{ ...event(1, 1, 'form', 'Filled email'), metadata: { value: 'PRIVATE' } }, { ...event(1, 2, 'form', 'Submitted'), metadata: {} }];
  const r = buildReport([{ ...session(1), duration_seconds: 5000, is_bounce: true }], es, period);
  assert.equal(r.overview.avg_duration_seconds, null); assert.equal(r.overview.bounce_rate, null); assert.equal(r.legacy.submitted_events, 1);
  assert.equal(r.form_funnel.accepted, 0); assert.equal(r.recent_sessions[0].is_bounce, null); assert.equal(JSON.stringify(r).includes('PRIVATE'), false);
  assert.equal(r.form_entries, undefined); assert.equal(EVENT_SELECT.includes('metadata->value'), false);
});

test('latest cumulative snapshots win independent of delivery order; no double-counted section time', () => {
  const es = [event(1, 3, 'section_view', 'proof', { duration_seconds: 10 }), event(1, 1, 'section_view', 'proof', { duration_seconds: 3 }),
    event(1, 4, 'session_snapshot', 'Foreground', { duration_seconds: 12, max_scroll_depth: 0, engaged: true, final: false }),
    event(1, 2, 'session_snapshot', 'Foreground', { duration_seconds: 3, max_scroll_depth: 0, engaged: false, final: true })];
  const r = buildReport([session(1)], es, period);
  assert.equal(r.sections[0].visits, 1); assert.equal(r.sections[0].avg_seconds, 10); assert.equal(r.overview.avg_duration_seconds, 12);
  assert.equal(r.overview.avg_scroll_depth, 0); assert.equal(r.overview.bounce_rate, 0);
});

function queryMock(rows, cap = 1000, failAt = Infinity) {
  let calls = 0;
  return () => { let cursor = -Infinity; return { order() { return this; }, limit() { return this; }, gt(k, v) { cursor = v; return this; },
    then(resolve) { calls++; return Promise.resolve(calls >= failAt ? { error: { message: 'private failure' } } : { data: rows.filter(r => r.id > cursor).slice(0, cap) }).then(resolve); } }; };
}
test('pagination crosses 1,000 rows and even a smaller server cap, with no silent truncation', async () => {
  const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
  assert.equal((await readAll(queryMock(rows, 137))).length, 1201);
  await assert.rejects(readAll(queryMock(rows, 137, 3)));
  await assert.rejects(readAll(queryMock(rows, 1), 'id', 2));
});

test('write errors return failure; malformed requests never reach the database; cached fields are stripped', async () => {
  let inserted;
  const db = { from: () => ({ insert: row => { inserted = row; return Promise.resolve({ error: { message: 'PRIVATE' } }); } }) };
  const res = response(); await eventHandler(db)({ method: 'POST', body: event(1, 1, 'form', 'Progress', { field: 'email', value: 'PRIVATE' }) }, res);
  assert.equal(res.code, 503); assert.equal(JSON.stringify(inserted).includes('PRIVATE'), false); assert.equal(JSON.stringify(res.body).includes('PRIVATE'), false);
  const bad = response(); await eventHandler(db)({ method: 'POST', body: null }, bad); assert.equal(bad.code, 400);
});

test('session and legacy exit failures are surfaced, missing duration is rejected', async () => {
  const db = { from: () => ({ upsert: () => Promise.resolve({ error: {} }), update: () => ({ eq: () => Promise.resolve({ error: {} }) }) }) };
  const res = response(); await sessionHandler(db)({ method: 'POST', headers: { 'user-agent': 'Safari' }, body: { id: uid(1), visitor_id: uid(101) } }, res); assert.equal(res.code, 503);
  const bad = response(); await exitHandler(db)({ method: 'POST', body: { session_id: uid(1), is_bounce: true } }, bad); assert.equal(bad.code, 400);
  const fail = response(); await exitHandler(db)({ method: 'POST', body: { session_id: uid(1), duration_seconds: 0, max_scroll_depth: 0, is_bounce: true } }, fail); assert.equal(fail.code, 503);
});

test('dashboard auth/period validation and read failures never expose partial totals', async () => {
  const db = { from: () => ({ select() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, limit() { return Promise.resolve({ error: {} }); } }) };
  const handler = dataHandler(db, 'local-test-password');
  for (const [headers, days, expected] of [[{}, 30, 401], [{ 'x-dashboard-password': 'local-test-password' }, 365, 400], [{ 'x-dashboard-password': 'local-test-password' }, 30, 503]]) {
    const res = response(); await handler({ method: 'GET', headers, query: { days } }, res); assert.equal(res.code, expected); assert.equal(res.body.overview, undefined);
  }
});

test('synthetic report includes explicit mixed coverage and visit-level accepted enquiries', () => {
  const r = fixtureReport(); assert.equal(r.overview.total_sessions, 4); assert.equal(r.overview.v2_visits, 3); assert.equal(r.overview.unknown_bounce_visits, 2);
  assert.equal(r.form_funnel.accepted, 1); assert.equal(r.form_funnel.error, 1); assert.equal(r.audio.length, 2);
});

test('an analytics exception never changes Formspree success or prevents delivery', async () => {
  let calls = 0;
  const ok = await submitContact({ message: 'PRIVATE' }, { attemptId: uid(500), track: () => { throw new Error('tracking broken'); }, request: async () => { calls++; return { ok: true }; } });
  assert.equal(ok, true); assert.equal(calls, 1);
});

test('report API projects allowlisted metadata, retains session IDs and hydrates JSON properties', async () => {
  const rows = { sessions: [session(1)], events: [
    { ...event(1, 1, 'form', 'Started'), measurement_version: 2, sequence: 1 },
    { ...event(1, 2, 'form', 'Attempt'), measurement_version: 2, sequence: 2, attempt_id: uid(500) },
    { ...event(1, 3, 'form', 'Accepted'), measurement_version: 2, sequence: 3, attempt_id: uid(500) },
  ] };
  const selections = [];
  const db = { from(table) { let cursor; return {
    select(columns) { selections.push(columns); return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, limit() { return this; }, gt(key, value) { cursor = value; return this; },
    then(resolve) { return Promise.resolve({ data: cursor === undefined ? rows[table] : [] }).then(resolve); },
  }; } };
  const res = response(); await dataHandler(db, 'test', () => new Date(period.to))({ method: 'GET', headers: { 'x-dashboard-password': 'test' }, query: { days: 30 } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.form_funnel.accepted, 1);
  assert.ok(selections.some(s => s.includes('session_id'))); assert.ok(selections.every(s => !s.includes('metadata->value')));
});

test('new session writes minimise referral/UA data and initialise bounce as unknown', async () => {
  let stored;
  const db = { from: () => ({ upsert: row => { stored = row; return Promise.resolve({ error: null }); } }) };
  const res = response(); await sessionHandler(db)({ method: 'POST', headers: { 'user-agent': 'Safari' }, body: {
    id: uid(1), visitor_id: uid(101), referrer: 'https://example.test/path?email=PRIVATE', user_agent: 'PRIVATE', message: 'PRIVATE', utm_source: 'ig',
  } }, res);
  assert.equal(res.code, 200); assert.equal(stored.referrer, 'https://example.test'); assert.equal(stored.is_bounce, null);
  assert.equal(JSON.stringify(stored).includes('PRIVATE'), false); assert.equal(stored.user_agent, undefined);
});

test('Spotify report separates exposure/focus from API starts and links later acceptance anonymously', () => {
  const es = [event(1, 1, 'spotify', 'Exposed'), event(1, 2, 'spotify', 'Focus'), event(1, 3, 'spotify', 'Playback started'),
    event(1, 4, 'form', 'Started'), event(1, 5, 'form', 'Attempt', { attempt_id: uid(500) }), event(1, 6, 'form', 'Accepted', { attempt_id: uid(500) }),
    event(2, 1, 'form', 'Started'), event(2, 2, 'form', 'Attempt', { attempt_id: uid(501) }), event(2, 3, 'form', 'Accepted', { attempt_id: uid(501) }), event(2, 4, 'spotify', 'Focus')];
  const r = buildReport([session(1), session(2)], es, period);
  assert.equal(r.spotify.focus_visits, 2); assert.equal(r.spotify.playback_started_visits, 1);
  assert.equal(r.spotify.accepted_after_interaction_visits, 1); assert.equal(r.spotify.exposed_then_interacted_visits, 1);
  assert.equal(r.spotify.recent_interactions.length, 2);
  const filtered = sanitizeEvent(event(1, 7, 'spotify', 'Playback started', { playingURI: 'PRIVATE', spotifyAccount: 'PRIVATE', value: 'PRIVATE' }));
  assert.equal(JSON.stringify(filtered).includes('PRIVATE'), false);
});
