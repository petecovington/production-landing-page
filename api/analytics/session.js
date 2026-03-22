import { supabase } from './_supabase.js';

function parseUA(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /MSIE|Trident/.test(ua) ? 'IE'
    : 'Other';

  const os = /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows NT/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Other';

  const device = /iPhone|Android.*Mobile|Windows Phone/.test(ua) ? 'mobile'
    : /iPad|Android(?!.*Mobile)/.test(ua) ? 'tablet'
    : 'desktop';

  return { browser, os, device };
}

function isPrivateIP(ip) {
  return !ip
    || ip === '::1'
    || ip.startsWith('127.')
    || ip.startsWith('10.')
    || ip.startsWith('192.168.')
    || ip.startsWith('172.16.')
    || ip.startsWith('::ffff:127.');
}

async function geoLookup(ip) {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon,isp`,
      { signal: AbortSignal.timeout(3000) }
    );
    const data = await res.json();
    if (data.status === 'success') return data;
  } catch {
    // Geo lookup failed — not critical
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', '*');

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const ua = body.user_agent || req.headers['user-agent'] || '';
  const { browser, os, device } = parseUA(ua);

  // Get real client IP from x-forwarded-for
  const clientIP = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || null;

  // Geo lookup via ip-api.com (skip for private/local IPs)
  const geo = !isPrivateIP(clientIP) ? await geoLookup(clientIP) : null;

  const session = {
    id: body.id,
    visitor_id: body.visitor_id,
    referrer: body.referrer || null,
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    country: geo?.country || req.headers['x-vercel-ip-country'] || null,
    city: geo?.city || req.headers['x-vercel-ip-city'] || null,
    region: geo?.regionName || req.headers['x-vercel-ip-country-region'] || null,
    latitude: geo?.lat || null,
    longitude: geo?.lon || null,
    isp: geo?.isp || null,
    user_agent: ua,
    browser,
    os,
    device_type: device,
    screen_width: body.screen_width || null,
    screen_height: body.screen_height || null,
    language: body.language || null,
    timezone: body.timezone || null,
  };

  const { error } = await supabase.from('sessions').insert(session);
  if (error) console.error('Session insert error:', error);

  return res.status(200).json({ ok: true });
}
