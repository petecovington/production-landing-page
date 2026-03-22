import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', '*');

  let body;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    body = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: body.duration_seconds,
      is_bounce: body.is_bounce,
      max_scroll_depth: body.max_scroll_depth,
    })
    .eq('id', body.session_id);

  if (error) console.error('Exit update error:', error);

  return res.status(200).json({ ok: true });
}
