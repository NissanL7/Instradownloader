# FastDL Alt — Full-Stack Instagram Media Downloader

A standalone alternate version of `fastdl.app` with a responsive frontend and a zero-dependency Node.js backend.

## Features
- **Frontend UI (`index.html`, `styles.css`, `app.js`)**:
  - Media type tabs: `Video`, `Photo`, `Reels`, `Story`, `IGTV`, `Carousel`, `Viewer`
  - Multi-language switcher (`en`, `es`, `fr`, `de`, `pt`, `ja`) powered by `/api/languages`
  - Quick sample buttons, Paste/Clear controls, How-To guide, Address-Bar Shortcut info, Features, and FAQ
- **Backend Functions (`server.js`, `backend/`)**:
  - `GET /api/health` — Backend status and supported media types
  - `POST /api/validate` — Instagram URL validation, normalization, and shortcode/username extraction
  - `POST /api/resolve` — Public metadata extractor (`og:video`, `og:image`, `og:title`) with automatic offline/sandbox fallback
  - `GET /api/download` — Streaming download proxy with Instagram CDN SSRF allowlist (`*.cdninstagram.com`, `*.fbcdn.net`, `*.instagram.com`)
  - `GET /api/languages?lang=en` — Localized UI strings
  - `GET /https://www.instagram.com/...` — Address-bar shortcut redirect to `/?url=...`

## Quick Start
Requirements: Node.js 18+ (tested on Node.js 22.x, zero external npm dependencies).

```bash
cd fastdl-alt
npm start
```

Open `http://127.0.0.1:3000` in your browser.

## Run Tests
```bash
npm test
```
