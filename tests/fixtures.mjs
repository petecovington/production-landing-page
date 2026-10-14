import { buildReport } from '../lib/analytics-report.js';
export const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const stamp = '2026-10-14T09:00:00.000Z';
export const session = n => ({ id: uid(n), visitor_id: uid(n + 100), started_at: stamp, country: 'Australia', device_type: n % 2 ? 'mobile' : 'desktop', browser: 'Safari', referrer: 'https://www.google.com/search?private=removed' });
export const event = (n, seq, type, name, meta = {}) => ({ id: seq, session_id: uid(n), visitor_id: uid(n + 100), created_at: stamp, event_type: type, event_name: name, metadata: { measurement_version: 2, sequence: seq, ...meta } });
export function fixtureReport(days = 30, now = new Date()) {
  const sessions = [1, 2, 3, 4].map(n => ({ ...session(n), started_at: new Date(now.getTime() - n * 3600000).toISOString() }));
  const events = [
    event(1, 1, 'session_snapshot', 'Foreground', { duration_seconds: 52, max_scroll_depth: 100, engaged: true, final: true }),
    event(1, 2, 'section_view', 'hero', { duration_seconds: 12 }),
    event(1, 3, 'section_view', 'proof', { duration_seconds: 30 }),
    event(1, 4, 'example_exposure', 'Breathe', { position: 2 }),
    event(1, 5, 'audio_play', 'Breathe', { version: 'demo' }),
    event(1, 6, 'audio_progress', 'Breathe', { version: 'demo', duration_seconds: 19 }),
    event(1, 7, 'audio_play', 'Breathe', { version: 'produced' }),
    event(1, 8, 'audio_progress', 'Breathe', { version: 'produced', duration_seconds: 11 }),
    event(1, 16, 'spotify', 'Exposed'),
    event(1, 17, 'spotify', 'Ready'),
    event(1, 18, 'spotify', 'Focus'),
    event(1, 19, 'spotify', 'Playback started'),
    event(1, 20, 'form', 'Attempt', { attempt_id: uid(502) }),
    event(1, 21, 'form', 'Accepted', { attempt_id: uid(502) }),
    event(2, 3, 'spotify', 'Exposed'),
    event(2, 4, 'spotify', 'Unavailable'),
    event(1, 9, 'form', 'Started'),
    event(1, 10, 'form', 'Progress', { field: 'name' }),
    event(1, 11, 'form', 'Progress', { field: 'email' }),
    event(1, 12, 'form', 'Attempt', { attempt_id: uid(500) }),
    event(1, 13, 'form', 'Error', { attempt_id: uid(500), error_code: 'http', status: 429 }),
    event(1, 14, 'form', 'Attempt', { attempt_id: uid(501) }),
    event(1, 15, 'form', 'Accepted', { attempt_id: uid(501) }),
    event(2, 1, 'session_snapshot', 'Foreground', { duration_seconds: 3, max_scroll_depth: 12, engaged: false, final: true }),
    event(2, 2, 'section_view', 'hero', { duration_seconds: 3 }),
    event(3, 1, 'form', 'Started'),
    { ...event(4, 1, 'form', 'Submitted'), metadata: {} },
  ];
  return buildReport(sessions, events, { days, from: new Date(now.getTime() - days * 86400000).toISOString(), to: now.toISOString() });
}
