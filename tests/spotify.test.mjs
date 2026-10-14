import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSpotifyEmbed, SPOTIFY_URI } from '../src/spotify-embed.js';

function setup({ local = false, unavailable = false } = {}) {
  const doc = new EventTarget(), win = new EventTarget(), host = new EventTarget();
  const calls = [], once = new Set(), timers = new Map(), handlers = {}, children = [];
  let observer, destroyed = 0, loaded = 0;
  Object.assign(doc, { visibilityState: 'visible', hasFocus: () => true, activeElement: null,
    createElement: tag => ({ tagName: tag.toUpperCase(), style: {} }) });
  Object.assign(host, { appendChild: frame => children.push(frame), contains: frame => children.includes(frame),
    querySelector: () => children[0], replaceChildren: () => { children.length = 0; } });
  Object.assign(win, { location: { hostname: local ? '127.0.0.1' : 'example.test' },
    setTimeout: (fn, delay) => { const id = Symbol(); timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) });
  class Observer { constructor(cb) { observer = cb; } observe() {} disconnect() { observer = null; } }
  const analytics = { trackOnce(key, type, name) { if (!once.has(key)) { once.add(key); calls.push({ type, name }); } } };
  const loadApi = async () => {
    loaded++;
    if (unavailable) throw new Error('PRIVATE');
    return { createController(frame, options, callback) {
      assert.equal(options.uri, SPOTIFY_URI);
      callback({ addListener: (name, fn) => { handlers[name] = fn; }, destroy: () => destroyed++ });
    } };
  };
  const cleanup = mountSpotifyEmbed(host, { window: win, document: doc, analytics, loadApi, Observer });
  return { doc, win, host, calls, handlers, cleanup, get loaded() { return loaded; }, get destroyed() { return destroyed; },
    visible() { observer([{ isIntersecting: true }]); },
    focus() { doc.activeElement = children[0]; win.dispatchEvent(new Event('blur')); [...timers].filter(([, t]) => t.delay === 0).forEach(([id, t]) => { timers.delete(id); t.fn(); }); } };
}

test('Spotify focus/exposure cannot become a playback start; only official callback can, bounded per visit', async () => {
  const s = setup(); await new Promise(resolve => setImmediate(resolve));
  s.visible(); s.focus(); s.focus();
  assert.deepEqual(s.calls.map(e => e.name), ['Exposed', 'Focus']);
  s.handlers.ready(); s.handlers.playback_started({ data: { playingURI: 'PRIVATE' } }); s.handlers.playback_started({ data: { playingURI: 'PRIVATE' } });
  assert.deepEqual(s.calls.map(e => e.name), ['Exposed', 'Focus', 'Ready', 'Playback started']);
  assert.equal(JSON.stringify(s.calls).includes('PRIVATE'), false);
  s.cleanup(); assert.equal(s.destroyed, 1); s.handlers.playback_started(); assert.equal(s.calls.length, 4);
});

test('Spotify blocked SDK preserves fallback and reports unavailable without inventing playback', async () => {
  const s = setup({ unavailable: true }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.host.querySelector('iframe').tagName, 'IFRAME');
  assert.deepEqual(s.calls.map(e => e.name), ['Unavailable']);
  s.visible(); assert.equal(s.calls.some(e => e.name === 'Playback started'), false); s.cleanup();
});

test('local review never loads the Spotify SDK', () => {
  const s = setup({ local: true }); assert.equal(s.loaded, 0); s.cleanup();
});
