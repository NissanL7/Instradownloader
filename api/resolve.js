const { resolveInstagramMedia } = require('../backend/resolver');

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
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

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
    return;
  }
  try {
    const body = await parseBody(req);
    const result = await resolveInstagramMedia(body.url, body.type || 'auto');
    res.statusCode = result.ok ? 200 : result.status || 400;
    res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
};
