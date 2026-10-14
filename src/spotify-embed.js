// Official API: https://developer.spotify.com/documentation/embeds/references/iframe-api
export const SPOTIFY_URL = 'https://open.spotify.com/embed/playlist/6WfTR6zdI7Z0mUzL2ycqiF?utm_source=generator';
export const SPOTIFY_URI = 'spotify:playlist:6WfTR6zdI7Z0mUzL2ycqiF';
let apiPromise;
export function loadSpotifyApi(win, doc) {
  return apiPromise ||= new Promise((resolve, reject) => {
    const previous = win.onSpotifyIframeApiReady;
    const timer = win.setTimeout(() => reject(new Error('API unavailable')), 8000);
    win.onSpotifyIframeApiReady = api => {
      win.clearTimeout(timer);
      if (previous) previous(api);
      resolve(api);
    };
    const script = doc.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.onerror = () => { win.clearTimeout(timer); reject(new Error('API unavailable')); };
    doc.head.appendChild(script);
  });
}
export function mountSpotifyEmbed(host, { window: win, document: doc, analytics, loadApi = loadSpotifyApi, Observer = win.IntersectionObserver }) {
  let disposed = false, visible = false, controller, readyTimer, blurTimer;
  const frame = doc.createElement('iframe');
  frame.src = SPOTIFY_URL; frame.title = 'Pete Covington selected discography on Spotify';
  frame.width = '100%'; frame.height = '380'; frame.style.borderRadius = '12px'; frame.style.border = '0';
  frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  frame.allowFullscreen = true; frame.loading = 'lazy';
  host.appendChild(frame);
  const measure = name => { if (!disposed) analytics.trackOnce(`spotify:${name}`, 'spotify', name); };
  const exposure = () => { if (visible && doc.visibilityState === 'visible' && doc.hasFocus()) measure('Exposed'); };
  // Cross-origin focus is only an interaction signal, never a playback assertion.
  const focused = () => { if (doc.visibilityState === 'visible' && host.contains(doc.activeElement) && doc.activeElement?.tagName === 'IFRAME') measure('Focus'); };
  const blur = () => { win.clearTimeout(blurTimer); blurTimer = win.setTimeout(focused, 0); };
  const observer = new Observer(entries => { visible = entries.some(entry => entry.isIntersecting); exposure(); }, { threshold: 0 });
  observer.observe(host);
  doc.addEventListener('visibilitychange', exposure);
  win.addEventListener('focus', exposure); win.addEventListener('blur', blur);
  host.addEventListener('focusin', focused);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(win.location.hostname);
  // The safe review server intentionally never loads Spotify's SDK or iframe.
  if (!local) loadApi(win, doc).then(api => {
    if (disposed) return;
    readyTimer = win.setTimeout(() => measure('Unavailable'), 8000);
    api.createController(frame, { uri: SPOTIFY_URI, width: '100%', height: 380 }, next => {
      if (disposed) { next.destroy(); return; }
      controller = next;
      controller.addListener('ready', () => {
        win.clearTimeout(readyTimer);
        const embed = host.querySelector('iframe');
        if (embed) embed.title = frame.title;
        measure('Ready');
      });
      controller.addListener('playback_started', () => measure('Playback started'));
      // Ignore playingURI and account/player data. No autoplay or undocumented postMessage sniffing.
    });
  }).catch(() => measure('Unavailable'));
  return () => {
    disposed = true; observer.disconnect();
    win.clearTimeout(readyTimer); win.clearTimeout(blurTimer);
    doc.removeEventListener('visibilitychange', exposure);
    win.removeEventListener('focus', exposure); win.removeEventListener('blur', blur);
    host.removeEventListener('focusin', focused);
    controller?.destroy();
    host.replaceChildren();
  };
}
