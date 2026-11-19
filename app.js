(() => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const activeTypeLabel = document.getElementById('active-type-label');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const form = document.getElementById('download-form');
  const urlInput = document.getElementById('ig-url');
  const pasteBtn = document.getElementById('paste-btn');
  const clearBtn = document.getElementById('clear-btn');
  const submitBtn = document.getElementById('submit-btn');
  const statusMsg = document.getElementById('status-msg');
  const resultPanel = document.getElementById('result-panel');
  const resultTypeBadge = document.getElementById('result-type-badge');
  const resultModeBadge = document.getElementById('result-mode-badge');
  const resultTitle = document.getElementById('result-title');
  const resultUrlDisplay = document.getElementById('result-url-display');
  const resultNote = document.getElementById('result-note');
  const qualityList = document.getElementById('quality-list');
  const backendBadge = document.getElementById('backendBadge');
  const langSelect = document.getElementById('langSelect');

  let currentTypeKey = 'video';
  let currentTypeLabel = 'Video';
  let currentStrings = {
    titlePrefix: 'Instagram',
    titleSuffix: 'Downloader',
    viewerTitle: 'Instagram Profile & Story Viewer',
  };

  const placeholders = {
    video: 'Paste Instagram video URL (e.g. https://www.instagram.com/p/...)',
    photo: 'Paste Instagram photo URL (e.g. https://www.instagram.com/p/...)',
    reels: 'Paste Instagram Reels URL (e.g. https://www.instagram.com/reel/...)',
    story: 'Paste Instagram Story URL or username',
    igtv: 'Paste Instagram IGTV URL (e.g. https://www.instagram.com/tv/...)',
    carousel: 'Paste Instagram carousel post URL',
    viewer: 'Paste Instagram profile or post URL to preview',
  };

  function setStatus(message, kind = '') {
    statusMsg.textContent = message;
    statusMsg.className = 'status-msg' + (kind ? ` ${kind}` : '');
  }

  function syncClearButton() {
    if (urlInput.value.trim().length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  function renderHeroTitle() {
    heroTitle.textContent = '';
    if (currentTypeKey === 'viewer') {
      heroTitle.textContent = currentStrings.viewerTitle;
      return;
    }
    heroTitle.appendChild(document.createTextNode(`${currentStrings.titlePrefix} `));
    const span = document.createElement('span');
    span.id = 'active-type-label';
    span.textContent = currentTypeLabel;
    heroTitle.appendChild(span);
    heroTitle.appendChild(document.createTextNode(` ${currentStrings.titleSuffix}`));
  }

  function selectTab(typeKey) {
    tabButtons.forEach((btn) => {
      const match = (btn.dataset.type || '').toLowerCase() === typeKey.toLowerCase();
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', match ? 'true' : 'false');
      if (match) {
        currentTypeKey = btn.dataset.type;
        currentTypeLabel = btn.textContent.trim();
        renderHeroTitle();
        urlInput.placeholder = placeholders[currentTypeKey] || placeholders.video;
      }
    });
  }

  async function checkBackendHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.ok) {
        backendBadge.textContent = 'Backend: Online';
        return;
      }
    } catch {
      // ignore
    }
    backendBadge.textContent = 'Backend: Offline';
  }

  async function resolveUrl(rawUrl) {
    setStatus('Resolving media via backend…');
    resultPanel.classList.add('hidden');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl, type: currentTypeKey }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus(data.error || 'Failed to resolve Instagram URL.', 'error');
        return;
      }

      const { media, mode, notice } = data;
      resultTypeBadge.textContent = (media.type || currentTypeLabel).toUpperCase();
      resultModeBadge.textContent = mode === 'live' ? 'LIVE' : 'SANDBOX FALLBACK';
      resultTitle.textContent = media.title || 'Instagram Media';
      resultUrlDisplay.textContent = media.canonicalUrl;
      resultNote.textContent = notice || '';

      qualityList.textContent = '';
      media.formats.forEach((fmt) => {
        const row = document.createElement('div');
        row.className = 'quality-item';

        const left = document.createElement('div');
        const labelStrong = document.createElement('strong');
        labelStrong.textContent = fmt.label;
        const qualitySpan = document.createElement('span');
        qualitySpan.style.color = 'var(--muted)';
        qualitySpan.style.fontSize = '0.85rem';
        qualitySpan.textContent = ` (${fmt.quality})`;
        left.appendChild(labelStrong);
        left.appendChild(qualitySpan);

        const dlLink = document.createElement('a');
        const params = new URLSearchParams({
          filename: `${media.filenameBase}.${fmt.ext}`,
          ext: fmt.ext,
          quality: fmt.quality,
          demo: fmt.demo ? '1' : '0',
          source: media.canonicalUrl,
        });
        if (fmt.url) {
          params.set('url', fmt.url);
        }
        dlLink.href = `/api/download?${params.toString()}`;
        dlLink.className = 'secondary-btn';
        dlLink.style.textDecoration = 'none';
        dlLink.textContent = `Download .${fmt.ext.toUpperCase()}`;

        row.appendChild(left);
        row.appendChild(dlLink);
        qualityList.appendChild(row);
      });

      resultPanel.classList.remove('hidden');
      setStatus(
        mode === 'live'
          ? 'Media resolved! Click any format below to download.'
          : 'URL validated. Running in offline/sandbox fallback mode — click below to test backend file download.',
        'success'
      );
    } catch (err) {
      setStatus(`Backend request failed: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectTab(btn.dataset.type || 'video');
    });
  });

  urlInput.addEventListener('input', () => {
    syncClearButton();
    setStatus('');
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        syncClearButton();
        setStatus('Pasted URL from clipboard.', 'success');
      } else {
        setStatus('Clipboard is empty.', 'error');
      }
    } catch {
      urlInput.focus();
      setStatus('Clipboard access blocked by browser — paste manually with Ctrl+V / Cmd+V.', 'error');
    }
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    syncClearButton();
    resultPanel.classList.add('hidden');
    setStatus('');
    urlInput.focus();
  });

  document.querySelectorAll('.sample-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sampleUrl = btn.dataset.url;
      const sampleType = btn.dataset.type || 'video';
      selectTab(sampleType);
      urlInput.value = sampleUrl;
      syncClearButton();
      resolveUrl(sampleUrl);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = urlInput.value.trim();
    if (!raw) {
      setStatus('Please enter an Instagram URL first.', 'error');
      resultPanel.classList.add('hidden');
      return;
    }
    resolveUrl(raw);
  });

  langSelect.addEventListener('change', async () => {
    try {
      const res = await fetch(`/api/languages?lang=${encodeURIComponent(langSelect.value)}`);
      const data = await res.json();
      if (!data.ok || !data.strings) return;
      const s = data.strings;
      currentStrings = s;
      renderHeroTitle();
      heroSubtitle.textContent = s.subtitle;
      urlInput.placeholder = s.placeholder;
      pasteBtn.textContent = s.paste;
      clearBtn.textContent = s.clear;
      submitBtn.textContent = s.download;
      document.getElementById('howToTitle').textContent = s.howToTitle;
      document.getElementById('featuresTitle').textContent = s.featuresTitle;
      document.getElementById('faqTitle').textContent = s.faqTitle;
    } catch {
      // ignore
    }
  });

  checkBackendHealth();

  const initialUrl = new URLSearchParams(window.location.search).get('url');
  if (initialUrl) {
    urlInput.value = initialUrl;
    syncClearButton();
    resolveUrl(initialUrl);
  }
})();
