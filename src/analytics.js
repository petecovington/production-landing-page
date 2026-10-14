import { sanitizeEvent, originOnly } from '../lib/analytics-contract.js';

// One visit per page lifetime. No tracking in local development or explicitly excluded browsers.
export function createAnalytics(env) {
  const { window: win, document: doc, navigator: nav, fetch: request, crypto, now, setInterval, clearInterval } = env;
  let sessionId, visitorId, sequence = 0, installed = false, timer, last = 0, visibleSeconds = 0, engaged = false, maxScroll = 0;
  let foreground = false;
  const sections = new Map(), audio = new Map(), exposures = new Map(), once = new Set();
  const listeners = [];
  function excluded() {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(win.location.hostname);
    const choice = new URLSearchParams(win.location.search).get('analytics');
    let disabled = choice === 'off';
    try {
      if (choice === 'off') win.localStorage.setItem('analytics_excluded', '1');
      if (choice === 'on') win.localStorage.removeItem('analytics_excluded');
      disabled ||= win.localStorage.getItem('analytics_excluded') === '1';
    } catch { /* exclusion still works for this load */ }
    return local || nav.webdriver || disabled;
  }
  const active = () => doc.visibilityState === 'visible' && doc.hasFocus();
  function send(path, data) {
    // keepalive permits lifecycle flushes; rejected writes are visible without logging payloads.
    try {
      Promise.resolve(request(`/api/analytics/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true }))
        .then(r => { if (!r.ok) console.warn('Analytics request failed'); })
        .catch(() => console.warn('Analytics unavailable'));
    } catch { console.warn('Analytics unavailable'); }
  }
  function accrue() {
    const current = now();
    const seconds = Math.max(0, (current - last) / 1000);
    if (foreground) {
      visibleSeconds += seconds;
      sections.forEach(s => { if (s.visible) s.seconds += seconds; });
      audio.forEach(a => { if (a.playing) a.seconds += seconds; });
    }
    last = current;
  }
  const round = n => Math.round(Math.min(n, 86400) * 10) / 10;
  function track(type, name, metadata = {}) {
    if (!installed || !sessionId) return;
    accrue();
    if (['click', 'form', 'audio_play', 'interaction'].includes(type) || (type === 'spotify' && ['Focus', 'Playback started'].includes(name))) engaged = true;
    const event = sanitizeEvent({ session_id: sessionId, visitor_id: visitorId, event_type: type, event_name: name,
      metadata: { ...metadata, measurement_version: 2, sequence: ++sequence }, seconds_on_page: round(visibleSeconds) });
    send('event', event);
  }
  function trackOnce(key, type, name, metadata) {
    if (!installed || once.has(key)) return;
    once.add(key); track(type, name, metadata);
  }
  function flush(final = false) {
    if (!installed) return;
    accrue();
    sections.forEach((s, name) => {
      if (round(s.seconds) > (s.sent || 0)) {
        s.sent = round(s.seconds); track('section_view', name, { duration_seconds: s.sent });
      }
    });
    audio.forEach(a => {
      if (round(a.seconds) > (a.sent || 0)) {
        a.sent = round(a.seconds); track('audio_progress', a.track, { version: a.version, duration_seconds: a.sent });
      }
    });
    track('session_snapshot', 'Foreground', { duration_seconds: round(visibleSeconds), max_scroll_depth: maxScroll,
      engaged: engaged || visibleSeconds >= 30, final });
  }
  function expose() {
    if (foreground) exposures.forEach((e, trackName) => {
      if (e.visible) trackOnce(`exposure:${trackName}`, 'example_exposure', trackName, { position: e.position });
    });
  }
  function visibility() {
    accrue(); foreground = active();
    flush(false); expose();
  }
  function scroll() {
    if (!active()) return;
    maxScroll = Math.max(maxScroll, Math.min(100, Math.round((win.scrollY + win.innerHeight) / Math.max(1, doc.documentElement.scrollHeight) * 100)));
  }
  function listen(target, event, fn) { target.addEventListener(event, fn); listeners.push(() => target.removeEventListener(event, fn)); }
  function cleanup() {
    if (!installed) return;
    flush(false); installed = false; clearInterval(timer);
    listeners.splice(0).forEach(remove => remove());
  }
  function init() {
    if (installed) return cleanup;
    if (excluded()) return () => {};
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      try {
        visitorId = win.localStorage.getItem('analytics_vid') || crypto.randomUUID();
        win.localStorage.setItem('analytics_vid', visitorId);
      } catch { visitorId = crypto.randomUUID(); }
      const params = new URLSearchParams(win.location.search);
      send('session', { id: sessionId, visitor_id: visitorId, measurement_version: 2, referrer: originOnly(doc.referrer),
        utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'),
        screen_width: win.screen.width, screen_height: win.screen.height, language: nav.language, user_agent: nav.userAgent });
    }
    installed = true; last = now(); foreground = active(); scroll();
    listen(doc, 'visibilitychange', visibility);
    listen(win, 'focus', visibility); listen(win, 'blur', visibility);
    listen(win, 'scroll', scroll);
    listen(win, 'pagehide', event => { accrue(); foreground = false; flush(!event.persisted); });
    listen(win, 'pageshow', visibility);
    timer = setInterval(() => { if (foreground) flush(false); }, 15000);
    flush(false);
    return cleanup;
  }
  function section(name, visible) {
    accrue(); const state = sections.get(name) || { seconds: 0 };
    state.visible = visible; sections.set(name, state);
    if (!visible) flush(false);
  }
  function playback(trackName, version, playing) {
    accrue(); const key = `${trackName}:${version}`;
    const state = audio.get(key) || { track: trackName, version, seconds: 0, playing: false };
    if (playing && !state.playing) track('audio_play', trackName, { version });
    state.playing = playing; audio.set(key, state);
    if (!playing) flush(false);
  }
  return { init, track, flush, cleanup, trackOnce, trackSectionEnter: name => section(name, true), trackSectionLeave: name => section(name, false), playback,
    exampleExposure(trackName, position, visible) { exposures.set(trackName, { position, visible }); expose(); } };
}
let singleton;
function client() {
  return singleton ||= createAnalytics({ window, document, navigator, fetch: (...args) => fetch(...args), crypto,
    now: () => performance.now(), setInterval, clearInterval });
}
export const init = () => client().init();
export const track = (...args) => client().track(...args);
export const trackOnce = (...args) => client().trackOnce(...args);
export const trackSectionEnter = id => client().trackSectionEnter(id);
export const trackSectionLeave = id => client().trackSectionLeave(id);
export const playback = (...args) => client().playback(...args);
export const exampleExposure = (...args) => client().exampleExposure(...args);
