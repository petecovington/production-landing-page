const ENDPOINT = '/api/analytics';

let sessionId = null;
let visitorId = null;
let sessionStartTime = null;
let isBounce = true;
let maxScrollDepth = 0;
const sectionTimers = {};

function getOrCreateId(key) {
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function init() {
  // Don't track headless browsers or bots
  if (navigator.webdriver) return;

  visitorId = getOrCreateId('analytics_vid');
  sessionId = crypto.randomUUID();
  sessionStartTime = Date.now();

  const params = new URLSearchParams(window.location.search);

  fetch(`${ENDPOINT}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: sessionId,
      visitor_id: visitorId,
      referrer: document.referrer || null,
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      user_agent: navigator.userAgent,
    }),
  }).catch(() => {});

  window.addEventListener('scroll', () => {
    const depth = Math.round(((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100);
    if (depth > maxScrollDepth) maxScrollDepth = Math.min(depth, 100);
  }, { passive: true });

  window.addEventListener('beforeunload', () => {
    Object.keys(sectionTimers).forEach(id => _flushSection(id));
    navigator.sendBeacon(
      `${ENDPOINT}/exit`,
      new Blob([JSON.stringify({
        session_id: sessionId,
        duration_seconds: Math.round((Date.now() - sessionStartTime) / 1000),
        is_bounce: isBounce,
        max_scroll_depth: maxScrollDepth,
      })], { type: 'application/json' })
    );
  });

  setTimeout(() => { isBounce = false; }, 30000);
}

export function track(eventType, eventName = null, metadata = null) {
  if (!sessionId) return;
  isBounce = false;
  fetch(`${ENDPOINT}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      visitor_id: visitorId,
      event_type: eventType,
      event_name: eventName,
      metadata,
      seconds_on_page: sessionStartTime ? parseFloat(((Date.now() - sessionStartTime) / 1000).toFixed(1)) : 0,
    }),
  }).catch(() => {});
}

export function trackSectionEnter(sectionId) {
  sectionTimers[sectionId] = Date.now();
  isBounce = false;
}

function _flushSection(sectionId) {
  if (!sectionTimers[sectionId]) return;
  const duration = (Date.now() - sectionTimers[sectionId]) / 1000;
  delete sectionTimers[sectionId];
  if (duration > 1) {
    track('section_view', sectionId, { duration_seconds: parseFloat(duration.toFixed(1)) });
  }
}

export function trackSectionLeave(sectionId) {
  _flushSection(sectionId);
}
