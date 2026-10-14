// Production-isolated review server: static built assets + synthetic report; no credentials.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { buildFunnel, cleanPost } from '../lib/stables-funnel.js';
import { buildReport } from '../lib/stables.js';
import { fixtureReport } from '../tests/fixtures.mjs';
const root = resolve('dist');
const now = Date.now(), day = 86400000;
let demoPosts = [2, 5, 12].map((ago,i) => ({id:`00000000-0000-4000-8000-00000000000${i}`,title:['A new lyric breakdown','Another song breakdown','Earlier breakdown'][i],url:'https://www.instagram.com/reel/LocalExample/',published_at:new Date(now-ago*day).toISOString(),views_48h:i?1200:null,views_7d:i===2?4100:null,updated_at:new Date(now).toISOString()}));
const demoVisits = Array.from({length:45},(_,d)=>Array.from({length:8+(d%7)*3},(_,i)=>({id:`v${d}-${i}`,started_at:new Date(now-(44-d)*day-i*60000).toISOString(),source:['instagram_bio','instagram_story','other',null][i%4]}))).flat();
const demoEvents = demoVisits.filter((_,i)=>i%6===0).map(v=>({visit_id:v.id,kind:'submission',created_at:v.started_at}));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-src 'none'; font-src 'self'; form-action 'self'; base-uri 'none'");
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/stables/funnel') {
    res.setHeader('Content-Type','application/json');
    if(req.headers['x-dashboard-password']!=='preview-only'){res.writeHead(401);return res.end('{}');}
    if(req.method==='POST') {
      try { let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),row=cleanPost(body);const old=demoPosts.find(p=>p.id===row.id);if(old&&old.updated_at!==body.updated_at){res.writeHead(409);return res.end(JSON.stringify({error:'This post changed. Refresh and try again.'}));}const saved={...row,updated_at:new Date().toISOString()};demoPosts=[saved,...demoPosts.filter(p=>p.id!==row.id)];return res.end(JSON.stringify(saved)); }
      catch {res.writeHead(400);return res.end(JSON.stringify({error:'Check the post details.'}));}
    }
    return res.end(JSON.stringify(buildFunnel(demoVisits,demoEvents,demoPosts,new Date(now-44*day).toISOString(),new Date().toISOString(),Number(url.searchParams.get('days'))||30)));
  }
  if (req.method !== 'GET') { res.writeHead(403); return res.end('Local review: writes disabled'); }
  if (url.pathname.startsWith('/api/stables/')) {
    res.setHeader('Content-Type', 'application/json');
    if (req.headers['x-dashboard-password'] !== 'preview-only') { res.writeHead(401); return res.end('{}'); }
    if (url.pathname === '/api/stables/kit') return res.end(JSON.stringify({ status: 'not_connected', total: null }));
    const visits = Array.from({length: 40}, (_, i) => ({id: String(i)}));
    const events = visits.map(v => ({visit_id:v.id,kind:'page',page:'/breakdowns.html'}));
    events.push(...visits.slice(0,8).map(v => ({visit_id:v.id,kind:'submission',form_id:'9485257'})));
    return res.end(JSON.stringify(buildReport(visits,events,{})));
  }
  if (url.pathname === '/api/analytics/data') {
    res.setHeader('Content-Type', 'application/json');
    if (req.headers['x-dashboard-password'] !== 'preview-only') { res.writeHead(401); return res.end('{}'); }
    return res.end(JSON.stringify(fixtureReport(Number(url.searchParams.get('days')) || 30)));
  }
  const file = resolve(root, '.' + (url.pathname === '/dashboard' ? '/dashboard.html' : url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    let body = await readFile(file);
    if (extname(file) === '.html') body = body.toString().replace('<body>', '<body><div style="padding:12px;background:#dbeafe;color:#172554;font:14px sans-serif;text-align:center">LOCAL REVIEW · Synthetic dashboard data · External services blocked · Post edits stay in this local preview · Preview password: preview-only</div>');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4175, '127.0.0.1', () => console.log('Isolated local review: http://127.0.0.1:4175/dashboard'));
