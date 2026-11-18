(() => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const activeTypeLabel = document.getElementById('active-type-label');
  const form = document.getElementById('download-form');
  const urlInput = document.getElementById('ig-url');
  const pasteBtn = document.getElementById('paste-btn');
  const clearBtn = document.getElementById('clear-btn');
  const statusMsg = document.getElementById('status-msg');
  const resultPanel = document.getElementById('result-panel');
  const resultTypeBadge = document.getElementById('result-type-badge');
  const resultUrlDisplay = document.getElementById('result-url-display');

  let currentType = 'Video';

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

  function isValidInstagramUrl(raw) {
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'instagram.com' ||
        host.endsWith('.instagram.com') ||
        host === 'instagr.am'
      );
    } catch {
      return false;
    }
  }

  function inferTypeFromUrl(raw, fallback) {
    const lower = raw.toLowerCase();
    if (lower.includes('/reel/') || lower.includes('/reels/')) return 'Reels';
    if (lower.includes('/stories/')) return 'Story';
    if (lower.includes('/tv/')) return 'IGTV';
    return fallback;
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const key = btn.dataset.type || 'video';
      currentType = btn.textContent.trim();
      activeTypeLabel.textContent = currentType;
      urlInput.placeholder = placeholders[key] || placeholders.video;
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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = urlInput.value.trim();

    if (!raw) {
      setStatus('Please enter an Instagram URL first.', 'error');
      resultPanel.classList.add('hidden');
      return;
    }

    if (!isValidInstagramUrl(raw)) {
      setStatus('Please enter a valid instagram.com or instagr.am URL.', 'error');
      resultPanel.classList.add('hidden');
      return;
    }

    const detectedType = inferTypeFromUrl(raw, currentType);
    resultTypeBadge.textContent = detectedType;
    resultUrlDisplay.textContent = raw;
    resultPanel.classList.remove('hidden');
    setStatus('URL validated. Select a format below (UI demo).', 'success');
  });

  document.querySelectorAll('.demo-dl-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStatus('Demo mode: attach a backend media-extraction API in app.js to trigger real downloads.', 'success');
    });
  });
})();
