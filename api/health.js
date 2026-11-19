module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.end();
    return;
  }
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      service: 'fastdl-alt-backend',
      runtime: 'vercel-serverless',
      supportedTypes: ['video', 'photo', 'reels', 'story', 'igtv', 'carousel', 'viewer'],
    })
  );
};
