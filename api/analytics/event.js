import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', '*');

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = {
    session_id: body.session_id,
    visitor_id: body.visitor_id,
    event_type: body.event_type,
    event_name: body.event_name || null,
    metadata: body.metadata || null,
    seconds_on_page: body.seconds_on_page || null,
  };

  const { error } = await supabase.from('events').insert(event);
  if (error) console.error('Event insert error:', error);

  // Increment event count on session
  await supabase.rpc('increment_event_count', { session_id_param: body.session_id }).catch(() => {});

  return res.status(200).json({ ok: true });
}
