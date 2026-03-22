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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const ua = body.user_agent || req.headers['user-agent'] || '';
  const { browser, os, device } = parseUA(ua);

  const session = {
    id: body.id,
    visitor_id: body.visitor_id,
    referrer: body.referrer || null,
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    country: req.headers['x-vercel-ip-country'] || null,
    city: req.headers['x-vercel-ip-city'] || null,
    region: req.headers['x-vercel-ip-country-region'] || null,
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
