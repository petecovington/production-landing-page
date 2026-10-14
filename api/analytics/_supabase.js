import { createClient } from '@supabase/supabase-js';
let client;
export function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) throw new Error('Analytics configuration missing');
  return client ||= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}
export async function withDatabase(req, res, factory) {
  try { return await factory(getSupabase())(req, res); }
  catch { return res.status(503).json({ error: 'Analytics temporarily unavailable' }); }
}
