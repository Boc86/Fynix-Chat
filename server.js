import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  const url = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(DIST, url);

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const ext = path.extname(url);
      if (ext) {
        res.writeHead(404);
        res.end();
      } else {
        fs.readFile(path.join(DIST, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(500);
            res.end();
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
      }
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyRequest(req, res) {
  const targetUrl = req.headers['x-target-url'];
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing X-Target-Url header' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid target URL' }));
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (!['x-target-url', 'host', 'connection', 'content-length'].includes(key)) {
        headers[key] = value;
      }
    }

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: req.method,
      headers,
    };

    const proxyReq = client.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cannot reach target server' }));
    });

    proxyReq.end(body);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/proxy') {
    proxyRequest(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`Fynix Chat running on http://localhost:${PORT}`);
});
