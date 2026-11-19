const { parseInstagramUrl } = require('./igParser');

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMetaContent(html, propertyName) {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propertyName}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return decodeHtmlEntities(match[1]);

  const reverseRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${propertyName}["']`,
    'i'
  );
  const reverseMatch = html.match(reverseRegex);
  return reverseMatch ? decodeHtmlEntities(reverseMatch[1]) : null;
}

function buildFallbackResult(parsedInfo, reason) {
  const id = parsedInfo.shortcode || parsedInfo.username || 'ig_media';
  const type = parsedInfo.detectedType;

  const formats = [];
  if (type === 'photo') {
    formats.push(
      { id: 'jpg-hd', label: 'Photo JPG (Original)', quality: '1080×1350', ext: 'jpg', mime: 'image/jpeg', demo: true },
      { id: 'jpg-sd', label: 'Photo JPG (Standard)', quality: '720×900', ext: 'jpg', mime: 'image/jpeg', demo: true }
    );
  } else if (type === 'carousel') {
    formats.push(
      { id: 'mp4-hd', label: 'Slide 1 — Video MP4', quality: '1080p HD', ext: 'mp4', mime: 'video/mp4', demo: true },
      { id: 'jpg-hd', label: 'Slide 2 — Photo JPG', quality: '1080×1350', ext: 'jpg', mime: 'image/jpeg', demo: true }
    );
  } else {
    formats.push(
      { id: 'mp4-hd', label: 'Video MP4 (HD)', quality: '1080p', ext: 'mp4', mime: 'video/mp4', demo: true },
      { id: 'mp4-sd', label: 'Video MP4 (Standard)', quality: '720p', ext: 'mp4', mime: 'video/mp4', demo: true },
      { id: 'jpg-thumb', label: 'Cover Thumbnail (JPG)', quality: '1080×1920', ext: 'jpg', mime: 'image/jpeg', demo: true }
    );
  }

  return {
    ok: true,
    mode: 'sandbox-fallback',
    notice: reason,
    media: {
      type,
      shortcode: parsedInfo.shortcode,
      username: parsedInfo.username,
      canonicalUrl: parsedInfo.canonicalUrl,
      title: parsedInfo.username
        ? `@${parsedInfo.username} (${type})`
        : `Instagram ${type.toUpperCase()} (${id})`,
      filenameBase: `fastdl_${type}_${id}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      formats,
    },
  };
}

async function resolveInstagramMedia(rawUrl, requestedType = 'auto') {
  const parsedInfo = parseInstagramUrl(rawUrl, requestedType);
  if (!parsedInfo.valid) {
    return { ok: false, status: 400, error: parsedInfo.error };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(parsedInfo.canonicalUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return buildFallbackResult(
        parsedInfo,
        `Live fetch returned HTTP ${response.status}; serving offline/sandbox preview formats.`
      );
    }

    const html = await response.text();
    let ogVideo = extractMetaContent(html, 'og:video') || extractMetaContent(html, 'og:video:secure_url');
    let ogImage = extractMetaContent(html, 'og:image');
    let ogTitle = extractMetaContent(html, 'og:title');

    if (!ogVideo && !ogImage && parsedInfo.shortcode) {
      try {
        const embedKind = parsedInfo.detectedType === 'reels' ? 'reel' : parsedInfo.detectedType === 'igtv' ? 'tv' : 'p';
        const embedUrl = `https://www.instagram.com/${embedKind}/${parsedInfo.shortcode}/embed/captioned/`;
        const embedRes = await fetch(embedUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        if (embedRes.ok) {
          const embedHtml = await embedRes.text();
          const videoMatch = embedHtml.match(/"video_url"\s*:\s*"([^"]+)"/);
          const imgMatch = embedHtml.match(/"display_url"\s*:\s*"([^"]+)"/) || embedHtml.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i);
          if (videoMatch) {
            ogVideo = videoMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
          }
          if (imgMatch) {
            ogImage = decodeHtmlEntities(imgMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
          }
        }
      } catch {
        // ignore embed fallback errors
      }
    }

    const formats = [];
    if (ogVideo) {
      formats.push({
        id: 'mp4-live',
        label: 'Video MP4 (Original)',
        quality: 'HD',
        ext: 'mp4',
        mime: 'video/mp4',
        url: ogVideo,
        demo: false,
      });
    }
    if (ogImage) {
      formats.push({
        id: 'jpg-live',
        label: ogVideo ? 'Cover Photo (JPG)' : 'Photo JPG (Original)',
        quality: 'Original',
        ext: 'jpg',
        mime: 'image/jpeg',
        url: ogImage,
        demo: false,
      });
    }

    if (formats.length === 0) {
      return buildFallbackResult(
        parsedInfo,
        'Public metadata tags were not exposed (login wall or rate limit); serving preview formats.'
      );
    }

    const id = parsedInfo.shortcode || parsedInfo.username || 'ig_media';
    return {
      ok: true,
      mode: 'live',
      notice: 'Resolved public media metadata from Instagram.',
      media: {
        type: parsedInfo.detectedType,
        shortcode: parsedInfo.shortcode,
        username: parsedInfo.username,
        canonicalUrl: parsedInfo.canonicalUrl,
        title: ogTitle || `Instagram ${parsedInfo.detectedType} (${id})`,
        filenameBase: `fastdl_${parsedInfo.detectedType}_${id}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
        formats,
      },
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return buildFallbackResult(
      parsedInfo,
      `Live network fetch unavailable (${err.message}); serving offline/sandbox preview formats.`
    );
  }
}

module.exports = {
  resolveInstagramMedia,
};
