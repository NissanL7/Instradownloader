const ALLOWED_IG_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
]);

const ALLOWED_CDN_SUFFIXES = [
  '.cdninstagram.com',
  '.fbcdn.net',
  '.instagram.com',
];

function isAllowedInstagramHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return ALLOWED_IG_HOSTS.has(host) || host.endsWith('.instagram.com');
}

function isAllowedCdnUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_CDN_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

function parseInstagramUrl(rawInput, requestedType = 'auto') {
  const raw = String(rawInput || '').trim();
  if (!raw) {
    return { valid: false, error: 'Please provide an Instagram URL.' };
  }

  let normalizedInput = raw;
  if (!/^https?:\/\//i.test(normalizedInput)) {
    if (/^(www\.)?(instagram\.com|instagr\.am)\//i.test(normalizedInput)) {
      normalizedInput = `https://${normalizedInput}`;
    } else if (/^[a-zA-Z0-9._]{1,30}$/.test(normalizedInput.replace(/^@/, ''))) {
      const username = normalizedInput.replace(/^@/, '');
      normalizedInput = `https://www.instagram.com/${username}/`;
    }
  }

  let parsed;
  try {
    parsed = new URL(normalizedInput);
  } catch {
    return { valid: false, error: 'Invalid URL format. Expected https://www.instagram.com/...' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'Only HTTP/HTTPS URLs are supported.' };
  }

  if (!isAllowedInstagramHost(parsed.hostname)) {
    return { valid: false, error: 'URL must be an instagram.com or instagr.am link.' };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  let detectedType = requestedType && requestedType !== 'auto' ? requestedType.toLowerCase() : 'video';
  let shortcode = null;
  let username = null;

  if (segments[0] === 'reel' || segments[0] === 'reels') {
    detectedType = 'reels';
    shortcode = segments[1] || null;
  } else if (segments[0] === 'p') {
    detectedType = requestedType === 'photo' || requestedType === 'carousel' ? requestedType : 'video';
    shortcode = segments[1] || null;
  } else if (segments[0] === 'tv') {
    detectedType = 'igtv';
    shortcode = segments[1] || null;
  } else if (segments[0] === 'stories') {
    detectedType = 'story';
    username = segments[1] || null;
    shortcode = segments[2] || null;
  } else if (segments.length >= 1) {
    username = segments[0];
    if (segments[1] === 'reel' || segments[1] === 'reels') {
      detectedType = 'reels';
      shortcode = segments[2] || null;
    } else if (segments[1] === 'p') {
      detectedType = requestedType === 'photo' || requestedType === 'carousel' ? requestedType : 'video';
      shortcode = segments[2] || null;
    } else if (requestedType === 'viewer' || requestedType === 'story') {
      detectedType = requestedType;
    } else {
      detectedType = 'viewer';
    }
  }

  const canonicalUrl = `https://www.instagram.com${parsed.pathname}`;

  return {
    valid: true,
    canonicalUrl,
    hostname: parsed.hostname.toLowerCase(),
    pathname: parsed.pathname,
    detectedType,
    shortcode,
    username,
  };
}

module.exports = {
  parseInstagramUrl,
  isAllowedCdnUrl,
};
