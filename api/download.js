const path = require('node:path');
const { Readable } = require('node:stream');
const { isAllowedCdnUrl } = require('../backend/igParser');

function sanitizeFilename(name, fallback = 'fastdl_media.bin') {
  const cleaned = String(name || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || fallback;
}

module.exports = async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const mediaUrl = reqUrl.searchParams.get('url') || '';
  const filename = sanitizeFilename(reqUrl.searchParams.get('filename') || 'fastdl_media.mp4');
  const ext = (reqUrl.searchParams.get('ext') || path.extname(filename).slice(1) || 'mp4').toLowerCase();
  const quality = reqUrl.searchParams.get('quality') || 'HD';
  const isDemo = reqUrl.searchParams.get('demo') === '1' || !mediaUrl;

  if (!isDemo) {
    if (!isAllowedCdnUrl(mediaUrl)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Blocked media URL: only Instagram CDN hosts are permitted.' }));
      return;
    }

    try {
      const upstream = await fetch(mediaUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!upstream.ok || !upstream.body) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: `Upstream CDN returned HTTP ${upstream.status}` }));
        return;
      }
      const contentType = upstream.headers.get('content-type') || (ext === 'jpg' ? 'image/jpeg' : 'video/mp4');
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      Readable.fromWeb(upstream.body).pipe(res);
      return;
    } catch (err) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: `Failed to stream upstream media: ${err.message}` }));
      return;
    }
  }

  const buffer =
    ext === 'jpg' || ext === 'jpeg'
      ? Buffer.from(
          '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
          'base64'
        )
      : Buffer.from(JSON.stringify({ generator: 'FastDL Alt', mode: 'demo', quality, source: reqUrl.searchParams.get('source') || '' }));

  res.statusCode = 200;
  res.setHeader('Content-Type', ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  res.end(buffer);
};
