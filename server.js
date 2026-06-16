import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb, get, query, run } from './server/db.js';

const PORT = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

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

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function intBools(obj, fields) {
  for (const f of fields) {
    if (f in obj) obj[f] = obj[f] ? 1 : 0;
  }
  return obj;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method;

  try {
    // ── Personas ──
    if (parts[1] === 'personas') {
      const id = parts[2];
      if (method === 'GET' && !id) {
        const rows = query('SELECT * FROM personas ORDER BY updated_at DESC');
        return json(res, 200, rows);
      }
      if (method === 'GET' && id) {
        const row = get('SELECT * FROM personas WHERE id = @id', { id });

        return row ? json(res, 200, row) : json(res, 404, { error: 'Not found' });
      }
      if (method === 'POST' && !id) {
        const body = await readBody(req);
        const now = Date.now();
        const personaId = body.id || crypto.randomUUID();
        run(`INSERT INTO personas (id, name, description, system_prompt, temperature, max_tokens, created_at, updated_at)
          VALUES (@id, @name, @description, @systemPrompt, @temperature, @maxTokens, @createdAt, @updatedAt)`, {
          id: personaId, name: body.name || 'Assistant',
          description: body.description || '', systemPrompt: body.systemPrompt || '',
          temperature: body.temperature ?? 0.7, maxTokens: body.maxTokens ?? 2048,
          createdAt: now, updatedAt: now
        });
        return json(res, 201, { id: personaId });
      }
      if (method === 'PUT' && id) {
        const body = await readBody(req);
        const fields = [];
        const params = { id };
        for (const [key, value] of Object.entries(body)) {
          if (key === 'id') continue;
          const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          fields.push(`${col} = @${key}`);
          params[key] = value;
        }
        if (fields.length > 0) {
          fields.push('updated_at = @updatedAt');
          params.updatedAt = Date.now();
          run(`UPDATE personas SET ${fields.join(', ')} WHERE id = @id`, params);
        }
        return json(res, 200, { ok: true });
      }
      if (method === 'DELETE' && id) {
        run('DELETE FROM personas WHERE id = @id', { id });
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    // ── User Profile ──
    if (parts[1] === 'user-profile') {
      if (method === 'GET') {
        const row = get('SELECT * FROM user_profiles WHERE id = @id', { id: 'main' });
        return json(res, 200, row || { id: 'main', content: '' });
      }
      if (method === 'PUT') {
        const body = await readBody(req);
        run('UPDATE user_profiles SET content = @content, updated_at = @updatedAt WHERE id = @id', {
          id: 'main', content: body.content || '', updatedAt: Date.now()
        });
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    // ── Conversations ──
    if (parts[1] === 'conversations') {
      const id = parts[2];

      if (method === 'GET' && !id) {
        const rows = query(`SELECT c.id, c.title, c.summary, c.created_at, c.updated_at,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
          FROM conversations c ORDER BY c.updated_at DESC`);
        return json(res, 200, rows);
      }

      if (method === 'POST' && !id) {
        const body = await readBody(req);
        const now = Date.now();
        const convId = body.id || crypto.randomUUID();
        run(`INSERT INTO conversations (id, title, created_at, updated_at) VALUES (@id, @title, @createdAt, @updatedAt)`, {
          id: convId, title: body.title || `New Chat ${new Date().toLocaleDateString()}`,
          createdAt: now, updatedAt: now
        });
        return json(res, 201, { id: convId });
      }

      if (method === 'GET' && id) {
        const conv = get('SELECT * FROM conversations WHERE id = @id', { id });
        if (!conv) return json(res, 404, { error: 'Not found' });
        const messages = query('SELECT * FROM messages WHERE conversation_id = @conversationId ORDER BY timestamp ASC', { conversationId: id });
        const parsed = messages.map(m => ({
          ...m,
          attachments: safeParse(m.attachments)
        }));
        return json(res, 200, { ...conv, messages: parsed });
      }

      if (method === 'PUT' && id) {
        const body = await readBody(req);
        intBools(body, ['isDefault']);
        const fields = [];
        const params = { id };
        for (const [key, value] of Object.entries(body)) {
          if (key === 'id' || key === 'messages') continue;
          const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          fields.push(`${col} = @${key}`);
          params[key] = value;
        }
        fields.push('updated_at = @updatedAt');
        params.updatedAt = Date.now();
        run(`UPDATE conversations SET ${fields.join(', ')} WHERE id = @id`, params);

        if (body.messages && Array.isArray(body.messages)) {
          const del = getDb().prepare('DELETE FROM messages WHERE conversation_id = ?');
          const ins = getDb().prepare(`INSERT INTO messages (id, conversation_id, role, content, attachments, token_estimate, timestamp)
            VALUES (@id, @conversationId, @role, @content, @attachments, @tokenEstimate, @timestamp)`);
          const tx = getDb().transaction((messages, convId) => {
            del.run(convId);
            for (const msg of messages) {
              ins.run({
                id: msg.id,
                conversationId: convId,
                role: msg.role,
                content: msg.content || '',
                attachments: JSON.stringify(msg.attachments || []),
                tokenEstimate: msg.tokenEstimate || Math.ceil((msg.content || '').length / 4),
                timestamp: msg.timestamp || Date.now()
              });
            }
          });
          tx(body.messages, id);
        }
        return json(res, 200, { ok: true });
      }

      if (method === 'DELETE' && id) {
        getDb().transaction((convId) => {
          run('DELETE FROM messages WHERE conversation_id = @conversationId', { conversationId: convId });
          run('DELETE FROM conversations WHERE id = @id', { id: convId });
        })(id);
        return json(res, 200, { ok: true });
      }

      return json(res, 405, { error: 'Method not allowed' });
    }

    // ── Upload ──
    if (parts[1] === 'upload' && parts.length === 2 && method === 'POST') {
      const body = await readBody(req);
      if (!body.data || !body.name) {
        return json(res, 400, { error: 'Missing data or name' });
      }

      const matches = body.data.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        return json(res, 400, { error: 'Invalid data URL format' });
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const fileId = body.id || crypto.randomUUID();
      const safeName = `${fileId}_${body.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(UPLOADS_DIR, safeName);

      try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
      fs.writeFileSync(filePath, buffer);

      const now = Date.now();
      const fileUrl = `/uploads/${safeName}`;
      run(`INSERT INTO file_library (id, name, type, size, url, created_at)
        VALUES (@id, @name, @type, @size, @url, @createdAt)`, {
        id: fileId, name: body.name, type: mimeType,
        size: buffer.length, url: fileUrl, createdAt: now
      });

      return json(res, 201, { id: fileId, name: body.name, type: mimeType, size: buffer.length, url: fileUrl, createdAt: now });
    }

    // ── File Library ──
    if (parts[1] === 'files') {
      const id = parts[2];

      if (method === 'GET' && !id) {
        const rows = query('SELECT * FROM file_library ORDER BY created_at DESC');
        return json(res, 200, rows);
      }

      if (method === 'GET' && id) {
        const row = get('SELECT * FROM file_library WHERE id = @id', { id });
        return row ? json(res, 200, row) : json(res, 404, { error: 'Not found' });
      }

      if (method === 'POST' && !id) {
        const body = await readBody(req);
        const fileId = body.id || crypto.randomUUID();
        const now = Date.now();
        run(`INSERT INTO file_library (id, name, type, size, url, created_at)
          VALUES (@id, @name, @type, @size, @url, @createdAt)`, {
          id: fileId, name: body.name || '', type: body.type || '',
          size: body.size || 0, url: body.url || '', createdAt: now
        });
        return json(res, 201, { id: fileId });
      }

      if (method === 'DELETE' && id) {
        const file = get('SELECT * FROM file_library WHERE id = @id', { id });
        if (file && file.url && file.url.startsWith('/uploads/')) {
          const filePath = path.join(DATA_DIR, file.url.replace('/uploads/', ''));
          try { fs.unlinkSync(filePath); } catch {}
        }
        run('DELETE FROM file_library WHERE id = @id', { id });
        return json(res, 200, { ok: true });
      }

      return json(res, 405, { error: 'Method not allowed' });
    }

    // ── API Configs ──
    if (parts[1] === 'configs') {
      const id = parts[2];
      if (method === 'GET' && !id) {
        const rows = query('SELECT * FROM api_configs');
        return json(res, 200, rows);
      }
      if (method === 'POST' && !id) {
        const body = await readBody(req);
        const cfgId = body.id || crypto.randomUUID();
        run(`INSERT INTO api_configs (id, name, api_key, base_url, model, is_default)
          VALUES (@id, @name, @apiKey, @baseUrl, @model, @isDefault)`, {
          id: cfgId, name: body.name || '', apiKey: body.apiKey || '',
          baseUrl: body.baseUrl || '', model: body.model || '',
          isDefault: body.isDefault ? 1 : 0
        });
        return json(res, 201, { id: cfgId });
      }
      if (method === 'PUT' && id) {
        const body = await readBody(req);
        intBools(body, ['isDefault']);
        const fields = [];
        const params = { id };
        for (const [key, value] of Object.entries(body)) {
          if (key === 'id') continue;
          const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          fields.push(`${col} = @${key}`);
          params[key] = value;
        }
        if (fields.length > 0) {
          run(`UPDATE api_configs SET ${fields.join(', ')} WHERE id = @id`, params);
        }
        return json(res, 200, { ok: true });
      }
      if (method === 'DELETE' && id) {
        run('DELETE FROM api_configs WHERE id = @id', { id });
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    // ── Preferences ──
    if (parts[1] === 'preferences') {
      if (method === 'GET') {
        const row = get('SELECT * FROM preferences WHERE id = @id', { id: 'user-preferences' });
        return json(res, 200, row || { id: 'user-preferences', theme: 'system', fontSize: 'medium', streaming: true, soundEnabled: true, streamDebounceMs: 50 });
      }
      if (method === 'PUT') {
        const body = await readBody(req);
        intBools(body, ['streaming', 'soundEnabled']);
        const fields = [];
        const params = { id: 'user-preferences' };
        for (const [key, value] of Object.entries(body)) {
          const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          fields.push(`${col} = @${key}`);
          params[key] = value;
        }
        if (fields.length > 0) {
          run(`UPDATE preferences SET ${fields.join(', ')} WHERE id = @id`, params);
        }
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    // ── Active State ──
    if (parts[1] === 'active-state') {
      if (method === 'GET') {
        const row = get('SELECT * FROM active_state WHERE id = @id', { id: 'active' });
        return json(res, 200, row || { id: 'active', conversationId: null });
      }
      if (method === 'PUT') {
        const body = await readBody(req);
        run('UPDATE active_state SET conversation_id = @conversationId WHERE id = @id', {
          id: 'active', conversationId: body.conversationId ?? null
        });
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: 'Method not allowed' });
    }

    // ── Web Search (DuckDuckGo) ──
    if (parts[1] === 'search') {
      const q = url.searchParams.get('q');
      if (!q) return json(res, 400, { error: 'Missing query' });

      const ddgRes = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `q=${encodeURIComponent(q)}&b=kd`,
      });
      const html = await ddgRes.text();

      const results = [];
      const blockRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
      let match;
      while ((match = blockRe.exec(html)) !== null) {
        results.push({
          title: match[2].replace(/<[^>]*>/g, '').trim(),
          snippet: match[3].replace(/<[^>]*>/g, '').trim(),
          url: match[1],
        });
      }

      return json(res, 200, { results, query: q });
    }

    // ── Unknown API route
    return json(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('API error:', err);
    return json(res, 500, { error: err.message });
  }
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return []; }
}

function serveStatic(req, res) {
  const url = req.url === '/' ? '/index.html' : req.url;

  if (url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, url.replace('/uploads/', ''));
    if (!filePath.startsWith(UPLOADS_DIR)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
    return;
  }

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
          if (err2) { res.writeHead(500); res.end(); return; }
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
    return json(res, 400, { error: 'Missing X-Target-Url header' });
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try { parsed = new URL(targetUrl); }
    catch { return json(res, 400, { error: 'Invalid target URL' }); }

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
      json(res, 502, { error: 'Cannot reach target server' });
    });

    proxyReq.end(body);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/proxy') {
    proxyRequest(req, res);
  } else if (req.url.startsWith('/api/')) {
    handleApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`Fynix Chat running on http://localhost:${PORT}`);
});
