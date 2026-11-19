const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('./server');

let server;
let baseUrl;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET /api/health returns service status', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.service, 'fastdl-alt-backend');
  assert.ok(data.supportedTypes.includes('reels'));
});

test('GET /api/languages returns localized strings', async () => {
  const res = await fetch(`${baseUrl}/api/languages?lang=es`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.lang, 'es');
  assert.equal(data.strings.download, 'Descargar');
});

test('POST /api/validate validates Instagram URLs and rejects others', async () => {
  const okRes = await fetch(`${baseUrl}/api/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.instagram.com/reel/DO5tIDME6t-/' }),
  });
  assert.equal(okRes.status, 200);
  const okData = await okRes.json();
  assert.equal(okData.valid, true);
  assert.equal(okData.detectedType, 'reels');
  assert.equal(okData.shortcode, 'DO5tIDME6t-');

  const badRes = await fetch(`${baseUrl}/api/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/not-instagram' }),
  });
  assert.equal(badRes.status, 400);
  const badData = await badRes.json();
  assert.equal(badData.ok, false);
});

test('POST /api/resolve returns media formats for valid Instagram URL', async () => {
  const res = await fetch(`${baseUrl}/api/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.instagram.com/reel/DO5tIDME6t-/', type: 'reels' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.media.type, 'reels');
  assert.ok(Array.isArray(data.media.formats) && data.media.formats.length > 0);
});

test('GET /api/download streams attachment and blocks non-Instagram CDN hosts', async () => {
  const demoRes = await fetch(`${baseUrl}/api/download?filename=sample.mp4&ext=mp4&quality=1080p&demo=1`);
  assert.equal(demoRes.status, 200);
  assert.equal(demoRes.headers.get('content-type'), 'video/mp4');
  assert.match(demoRes.headers.get('content-disposition'), /attachment; filename="sample\.mp4"/);
  const buf = Buffer.from(await demoRes.arrayBuffer());
  assert.ok(buf.length > 20);

  const ssrfRes = await fetch(`${baseUrl}/api/download?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data')}&demo=0`);
  assert.equal(ssrfRes.status, 400);
});

test('GET address-bar shortcut redirects to /?url=...', async () => {
  const res = await fetch(`${baseUrl}/https://www.instagram.com/reel/DO5tIDME6t-/`, {
    redirect: 'manual',
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^\/\?url=/);
});

test('GET / serves index.html', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /FastDL/);
});
