const { getLanguageBundle } = require('../backend/i18n');

module.exports = (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const lang = reqUrl.searchParams.get('lang') || 'en';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ...getLanguageBundle(lang) }));
};
