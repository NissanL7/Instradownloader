const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { parseInstagramUrl, isAllowedCdnUrl } = require('./backend/igParser');
const { resolveInstagramMedia } = require('./backend/resolver');
const { getLanguageBundle } = require('./backend/i18n');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeFilename(name, fallback = 'fastdl_media.bin') {
  const cleaned = String(name || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || fallback;
}

function createDemoPayload(ext, quality, sourceUrl) {
  if (ext === 'jpg' || ext === 'jpeg') {
    // Minimal 1x1 valid JPEG bytes
    return {
      mime: 'image/jpeg',
      buffer: Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64'
      ),
    };
  }
  if (ext === 'mp4') {
    // Minimal valid ftyp+moov MP4 header placeholder for offline/sandbox download verification
    const info = JSON.stringify({
      generator: 'FastDL Alt Backend',
      mode: 'sandbox-demo',
      quality: quality || '1080p',
      sourceUrl: sourceUrl || '',
      note: 'Generated in offline sandbox mode because external Instagram CDN access is restricted.',
    });
    return {
      mime: 'video/mp4',
      buffer: Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d]),
        Buffer.from(`\n${info}\n`, 'utf8'),
      ]),
    };
  }
  return {
    mime: 'application/json; charset=utf-8',
    buffer: Buffer.from(JSON.stringify({ quality, sourceUrl, mode: 'sandbox-demo' }, null, 2)),
  };
}

async function handleDownload(reqUrl, res) {
  const mediaUrl = reqUrl.searchParams.get('url') || '';
  const filename = sanitizeFilename(reqUrl.searchParams.get('filename') || 'fastdl_media.mp4');
  const ext = (reqUrl.searchParams.get('ext') || path.extname(filename).slice(1) || 'mp4').toLowerCase();
  const quality = reqUrl.searchParams.get('quality') || 'HD';
  const isDemo = reqUrl.searchParams.get('demo') === '1' || !mediaUrl;

  if (!isDemo) {
    if (!isAllowedCdnUrl(mediaUrl)) {
      sendJson(res, 400, { ok: false, error: 'Blocked media URL: only Instagram CDN hosts are permitted.' });
      return;
    }

    try {
      const upstream = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!upstream.ok || !upstream.body) {
        sendJson(res, 502, { ok: false, error: `Upstream CDN returned HTTP ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || (ext === 'jpg' ? 'image/jpeg' : 'video/mp4');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      });
      Readable.fromWeb(upstream.body).pipe(res);
      return;
    } catch (err) {
      sendJson(res, 502, { ok: false, error: `Failed to stream upstream media: ${err.message}` });
      return;
    }
  }

  const demo = createDemoPayload(ext, quality, reqUrl.searchParams.get('source') || '');
  res.writeHead(200, {
    'Content-Type': demo.mime,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': demo.buffer.length,
    'X-FastDL-Mode': 'sandbox-demo',
    'Cache-Control': 'no-store',
  });
  res.end(demo.buffer);
}

function serveStaticFile(pathname, res) {
  const target = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(ROOT_DIR, `.${target}`);
  if (!resolved.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    // Address-bar shortcut: /https://www.instagram.com/... (or collapsed /https:/...) -> /?url=...
    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      (pathname.startsWith('/https://') ||
        pathname.startsWith('/http://') ||
        pathname.startsWith('/https:/') ||
        pathname.startsWith('/http:/'))
    ) {
      let targetUrl = req.url.slice(1);
      targetUrl = targetUrl.replace(/^(https?:)\/+/, '$1//');
      res.writeHead(302, { Location: `/?url=${encodeURIComponent(targetUrl)}` });
      res.end();
      return;
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && pathname === '/api/health') {
      if (req.method === 'HEAD') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end();
        return;
      }
      sendJson(res, 200, {
        ok: true,
        service: 'fastdl-alt-backend',
        uptimeSeconds: Math.floor(process.uptime()),
        supportedTypes: ['video', 'photo', 'reels', 'story', 'igtv', 'carousel', 'viewer'],
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/languages') {
      const lang = reqUrl.searchParams.get('lang') || 'en';
      sendJson(res, 200, { ok: true, ...getLanguageBundle(lang) });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/validate') {
      try {
        const body = await readJsonBody(req);
        const result = parseInstagramUrl(body.url, body.type || 'auto');
        sendJson(res, result.valid ? 200 : 400, { ok: result.valid, ...result });
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/resolve') {
      try {
        const body = await readJsonBody(req);
        const result = await resolveInstagramMedia(body.url, body.type || 'auto');
        sendJson(res, result.ok ? 200 : result.status || 400, result);
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'GET' && pathname === '/api/download') {
      await handleDownload(reqUrl, res);
      return;
    }

    if (req.method === 'GET') {
      serveStaticFile(pathname, res);
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`FastDL Alt server listening at http://${HOST}:${PORT}`);
  });
}

module.exports = { createServer };
