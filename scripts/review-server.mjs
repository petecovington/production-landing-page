// Production-isolated review server: static built assets + synthetic report; no credentials.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fixtureReport } from '../tests/fixtures.mjs';
const root = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-src 'none'; font-src 'self'; form-action 'none'; base-uri 'none'");
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method !== 'GET') { res.writeHead(403); return res.end('Local review: writes disabled'); }
  if (url.pathname === '/api/analytics/data') {
    res.setHeader('Content-Type', 'application/json');
    if (req.headers['x-dashboard-password'] !== 'preview-only') { res.writeHead(401); return res.end('{}'); }
    return res.end(JSON.stringify(fixtureReport(Number(url.searchParams.get('days')) || 30)));
  }
  const file = resolve(root, '.' + (url.pathname === '/dashboard' ? '/dashboard.html' : url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    let body = await readFile(file);
    if (extname(file) === '.html') body = body.toString().replace('<body>', '<body><div style="padding:12px;background:#dbeafe;color:#172554;font:14px sans-serif;text-align:center">LOCAL REVIEW · Synthetic dashboard data · External services blocked · Preview password: preview-only</div>');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Isolated local review: http://127.0.0.1:4173/dashboard'));
