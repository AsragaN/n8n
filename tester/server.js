// Mini servidor local para testear los webhooks de "La Anonima" en n8n.
// Sirve index.html en GET /  y  proxea POST /proxy/{app|status|amd} al n8n real.
// No requiere npm install. Solo: node server.js
//
// Uso:
//   node server.js                                              (puerto 8080 por defecto)
//   PORT=9000 node server.js                                    (cambiar puerto)
//   N8N_BASE=https://otro-host/webhook node server.js           (apuntar a otro n8n)

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 8080;
const N8N_BASE = process.env.N8N_BASE || 'https://n8n.geellow.com/webhook';

const ROUTES = {
  app: `${N8N_BASE}/la-anonima`,
  status: `${N8N_BASE}/la-anonima-status`,
  amd: `${N8N_BASE}/la-anonima-amd`,
};

const INDEX_PATH = path.join(__dirname, 'index.html');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function proxyTo(targetUrl, body) {
  return new Promise((resolve) => {
    const u = new URL(targetUrl);
    const isHttps = u.protocol === 'https:';
    const client = isHttps ? https : http;
    const opts = {
      method: 'POST',
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'user-agent': 'jambonz-tester/1.0',
      },
    };
    const req = client.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', (err) => {
      resolve({ status: 0, headers: {}, body: JSON.stringify({ proxyError: err.message }) });
    });
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS abierto para que la UI pueda hacer fetch al server local sin drama
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Servir index.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(INDEX_PATH, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Cannot read index.html: ' + err.message);
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // GET /config -> devuelve URLs configuradas para que la UI las muestre
  if (req.method === 'GET' && req.url === '/config') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ n8nBase: N8N_BASE, routes: ROUTES }));
  }

  // POST /proxy/app | /proxy/status | /proxy/amd
  const proxyMatch = req.method === 'POST' && req.url.match(/^\/proxy\/(app|status|amd)$/);
  if (proxyMatch) {
    const target = ROUTES[proxyMatch[1]];
    const body = await readBody(req);
    const t0 = Date.now();
    const r = await proxyTo(target, body);
    const elapsed = Date.now() - t0;
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(
      JSON.stringify({
        target,
        upstreamStatus: r.status,
        upstreamHeaders: r.headers,
        upstreamBody: r.body,
        elapsedMs: elapsed,
      })
    );
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Jambonz Tester corriendo en  http://localhost:${PORT}`);
  console.log(`  Apuntando a n8n base:        ${N8N_BASE}`);
  console.log(`  Rutas:`);
  for (const [k, v] of Object.entries(ROUTES)) console.log(`    POST /proxy/${k}  ->  ${v}`);
  console.log('');
});
