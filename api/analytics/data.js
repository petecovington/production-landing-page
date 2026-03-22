import { supabase } from './_supabase.js';

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function topN(obj, n = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', '*');

  // Password check
  const password = req.headers['x-dashboard-password'];
  if (!password || password !== process.env.ANALYTICS_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const days = parseInt(req.query.days) || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch sessions and events in parallel
  const [{ data: sessions }, { data: events }, { data: recentSessions }] = await Promise.all([
    supabase
      .from('sessions')
      .select('visitor_id, duration_seconds, is_bounce, max_scroll_depth, referrer, country, city, browser, os, device_type, utm_source, utm_medium')
      .gte('started_at', cutoff),
    supabase
      .from('events')
      .select('event_type, event_name, metadata, seconds_on_page, created_at')
      .gte('created_at', cutoff)
      .limit(50000),
    supabase
      .from('sessions')
      .select('id, started_at, country, city, referrer, duration_seconds, is_bounce, device_type, browser, utm_source')
      .order('started_at', { ascending: false })
      .limit(25),
  ]);

  const s = sessions || [];
  const e = events || [];

  // Overview
  const uniqueVisitors = new Set(s.map(x => x.visitor_id)).size;
  const completedSessions = s.filter(x => x.duration_seconds != null);
  const avgDuration = completedSessions.length
    ? Math.round(completedSessions.reduce((acc, x) => acc + x.duration_seconds, 0) / completedSessions.length)
    : 0;
  const bounceRate = s.length
    ? parseFloat((s.filter(x => x.is_bounce).length / s.length * 100).toFixed(1))
    : 0;
  const avgScrollDepth = completedSessions.length
    ? Math.round(completedSessions.filter(x => x.max_scroll_depth).reduce((acc, x) => acc + (x.max_scroll_depth || 0), 0) / completedSessions.filter(x => x.max_scroll_depth).length)
    : 0;

  // Traffic sources
  const referrerCounts = groupBy(s.filter(x => x.referrer), 'referrer');
  const utmCounts = groupBy(s.filter(x => x.utm_source), 'utm_source');

  // Geo
  const countryCounts = groupBy(s.filter(x => x.country), 'country');
  const cityCounts = groupBy(s.filter(x => x.city), 'city');

  // Devices
  const browserCounts = groupBy(s, 'browser');
  const osCounts = groupBy(s, 'os');
  const deviceCounts = groupBy(s, 'device_type');

  // Events breakdown
  const eventGroups = {};
  e.forEach(ev => {
    const key = `${ev.event_type}||${ev.event_name || ''}`;
    eventGroups[key] = (eventGroups[key] || 0) + 1;
  });
  const eventBreakdown = Object.entries(eventGroups)
    .map(([key, count]) => {
      const [type, name] = key.split('||');
      return { type, name, count };
    })
    .sort((a, b) => b.count - a.count);

  // Section engagement
  const sectionEvents = e.filter(ev => ev.event_type === 'section_view');
  const sectionGroups = {};
  sectionEvents.forEach(ev => {
    if (!sectionGroups[ev.event_name]) sectionGroups[ev.event_name] = { total: 0, count: 0 };
    sectionGroups[ev.event_name].total += ev.metadata?.duration_seconds || 0;
    sectionGroups[ev.event_name].count += 1;
  });
  const sectionEngagement = Object.entries(sectionGroups)
    .map(([name, { total, count }]) => ({
      section: name,
      avg_seconds: Math.round(total / count),
      views: count,
    }))
    .sort((a, b) => b.avg_seconds - a.avg_seconds);

  // Form funnel
  const formEvents = e.filter(ev => ev.event_type === 'form');
  const formFunnel = {
    started: formEvents.filter(ev => ev.event_name === 'Started').length,
    filled_name: formEvents.filter(ev => ev.event_name === 'Filled name').length,
    filled_email: formEvents.filter(ev => ev.event_name === 'Filled email').length,
    filled_musicLink: formEvents.filter(ev => ev.event_name === 'Filled musicLink').length,
    filled_message: formEvents.filter(ev => ev.event_name === 'Filled message').length,
    submitted: formEvents.filter(ev => ev.event_name === 'Submitted').length,
  };

  // Audio plays
  const audioEvents = e.filter(ev => ev.event_type === 'audio_play');
  const audioCounts = groupBy(audioEvents, 'event_name');

  // Form entries - group filled fields by session
  const formFilledEvents = e.filter(ev => ev.event_type === 'form' && ev.event_name?.startsWith('Filled'));
  const formEntriesMap = {};
  formFilledEvents.forEach(ev => {
    const field = ev.event_name.replace('Filled ', '');
    if (!formEntriesMap[ev.session_id]) {
      formEntriesMap[ev.session_id] = { session_id: ev.session_id, at: ev.created_at, fields: {} };
    }
    formEntriesMap[ev.session_id].fields[field] = ev.metadata?.value || '';
    // Keep latest timestamp
    if (ev.created_at > formEntriesMap[ev.session_id].at) {
      formEntriesMap[ev.session_id].at = ev.created_at;
    }
  });
  const formEntries = Object.values(formEntriesMap)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  return res.status(200).json({
    period_days: days,
    overview: {
      total_sessions: s.length,
      unique_visitors: uniqueVisitors,
      bounce_rate: bounceRate,
      avg_duration_seconds: avgDuration,
      total_events: e.length,
      avg_scroll_depth: avgScrollDepth,
    },
    referrers: topN(referrerCounts),
    utm_sources: topN(utmCounts),
    countries: topN(countryCounts),
    cities: topN(cityCounts, 8),
    browsers: topN(browserCounts, 6),
    os: topN(osCounts, 6),
    devices: topN(deviceCounts, 4),
    sections: sectionEngagement,
    events: eventBreakdown.slice(0, 30),
    form_funnel: formFunnel,
    form_entries: formEntries,
    audio_plays: topN(audioCounts),
    recent_sessions: recentSessions || [],
  });
}
