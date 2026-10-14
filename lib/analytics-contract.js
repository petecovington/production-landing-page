// Shared allowlist: never accept arbitrary event labels, form values or error text.
export const SECTIONS = ['hero', 'proof', 'process', 'reviews', 'listen', 'contact'];
export const TRACKS = ['Nepotism Baby', '5 Minutes', 'Mr Moonlight', 'Breathe', 'Idea of You'];
export const FIELDS = ['name', 'email', 'musicLink', 'message'];
export const CLICKS = ['Email Form - Hero', 'Tell me about your project - Process', 'Substack'];
export const INTERACTIONS = ['Spotify Focus', 'Reviews Widget'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validId = value => typeof value === 'string' && UUID.test(value);
export const finite = (value, max = 86400) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
export function originOnly(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.origin : null; } catch { return null; }
}
export function sanitizeEvent(body) {
  if (!body || !validId(body.session_id) || !validId(body.visitor_id)) throw new Error('Invalid identifiers');
  const { event_type: type, event_name: name } = body;
  const input = body.metadata || {};
  const v2 = input.measurement_version === 2;
  const metadata = {};
  if (v2) {
    if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) throw new Error('Invalid sequence');
    Object.assign(metadata, { measurement_version: 2, sequence: input.sequence });
  }
  if (type === 'form') {
    const legacy = ['Started', 'Submitted', ...FIELDS.map(f => `Filled ${f}`)];
    if (!(v2 ? ['Started', 'Progress', 'Attempt', 'Accepted', 'Error'] : legacy).includes(name)) throw new Error('Invalid form event');
    if (name === 'Progress') {
      if (!FIELDS.includes(input.field)) throw new Error('Invalid field');
      metadata.field = input.field;
    }
    if (['Attempt', 'Accepted', 'Error'].includes(name)) {
      if (!validId(input.attempt_id)) throw new Error('Invalid attempt');
      metadata.attempt_id = input.attempt_id;
    }
    if (name === 'Error') {
      if (!['network', 'http'].includes(input.error_code)) throw new Error('Invalid error code');
      metadata.error_code = input.error_code;
      if (input.error_code === 'http' && Number.isInteger(input.status) && input.status >= 400 && input.status <= 599) metadata.status = input.status;
    }
  } else if (type === 'spotify' && v2 && ['Exposed', 'Focus', 'Ready', 'Unavailable', 'Playback started'].includes(name)) {
    // Bounded, content-free signals. Ignore account IDs, playingURI and arbitrary metadata.
  } else if (type === 'session_snapshot' && v2 && name === 'Foreground') {
    if (!finite(input.duration_seconds) || !finite(input.max_scroll_depth, 100) || typeof input.engaged !== 'boolean' || typeof input.final !== 'boolean') throw new Error('Invalid snapshot');
    Object.assign(metadata, { duration_seconds: input.duration_seconds, max_scroll_depth: input.max_scroll_depth, engaged: input.engaged, final: input.final });
  } else if (type === 'section_view' && SECTIONS.includes(name)) {
    if (!finite(input.duration_seconds)) throw new Error('Invalid duration');
    metadata.duration_seconds = input.duration_seconds;
  } else if (['audio_play', 'audio_progress', 'example_exposure'].includes(type) && TRACKS.includes(name)) {
    if (v2 && type !== 'example_exposure') {
      if (!['demo', 'produced'].includes(input.version)) throw new Error('Invalid recording version');
      metadata.version = input.version;
    }
    if (type === 'audio_progress') {
      if (!v2 || !finite(input.duration_seconds)) throw new Error('Invalid audio duration');
      metadata.duration_seconds = input.duration_seconds;
    }
    if (type === 'example_exposure') {
      if (!v2 || !Number.isInteger(input.position) || input.position < 1 || input.position > 5) throw new Error('Invalid exposure');
      metadata.position = input.position;
    }
  } else if (type === 'click' && CLICKS.includes(name)) {
    // No arbitrary metadata.
  } else if (type === 'interaction' && [...INTERACTIONS, ...(!v2 ? ['Spotify Play'] : [])].includes(name)) {
    // Focus is deliberately not labelled playback.
  } else throw new Error('Unknown event');
  return { session_id: body.session_id, visitor_id: body.visitor_id, event_type: type, event_name: name,
    metadata, seconds_on_page: finite(body.seconds_on_page) ? body.seconds_on_page : null };
}
