# Viora website
Static site, no build step. Pages: index, login (Google), account, help, privacy, terms, 404.

## Deploy (Render → Static Site)
Build command: empty. Publish directory: `.`

## Edit at the top of `assets/app.js`
- `installUrl`: your Chrome Web Store link
- `supportEmail`: your real support address
- `authApi`: your Google sign-in server (set to viora-auth-website.onrender.com)

## Auth server settings (Render environment variables)
`SITE_URL` must be this site's exact URL, with no trailing slash.

---
## v2 upgrade notes

### Look & feel: Viora extension colours + Settings
The whole site (marketing pages and web app) now uses the Viora extension's dark green by default.
Users can change it in **Account → Appearance** (accent + dark/light theme) or in the app via
**gear → Settings** (accent; the app shell is the extension's dark theme). Saved per device in
`localStorage` (`viora_accent`, `viora_theme`). Code: `assets/x/accent.css` (colour tokens),
`assets/x/prefs.js` + `prefs.css` (applies the choice before first paint, renders the picker).

### Web sources with favicons (`assets/x/sources.js`, `sources.css`)
One shared module renders every web source: source cards (icon, site, domain, title, snippet), the
"Searched the web" block, inline `[1]` citation icons and attached-page chips. Only http(s) URLs become
links (`javascript:` etc. render as a non-clickable "Unavailable source"); links open with
`rel="noopener noreferrer nofollow"`.
Icon order: provider-supplied `favicon` (https, same registrable domain only) → icon service for the
**exact hostname** → neutral globe. Failures are remembered 24 h (`viora_favbad`); loaded icons are reused
so re-renders do not re-download. Icons are `<img>` tags with `referrerpolicy="no-referrer"` (images cannot run script).

**Privacy:** the default icon service is DuckDuckGo (`icons.duckduckgo.com`), so it learns which domains
appear in answers (not who you are or what you asked). To turn it off, put this before the module loads:
`<script>window.VIORA_FAVICON = { service: '' }</script>` — provider icons and the globe are then used.
To use another service set `service: 'https://your-host/icon?d={domain}'`.
If your search server can return a `favicon` field per source (`viora_sources: [{url,title,snippet,favicon}]`),
it is used first. `site`/`snippet` fields are also honoured.

### Attachments (`app.html`, `assets/x/media.js`, `caps.js`, `attach.css`)
* Content is sniffed (magic bytes), not just the extension: a renamed .exe is rejected; audio, BMP, AVI get a clear message.
* Each attachment shows a thumbnail, size, a live status (Reading… / Extracting frame 3 of 8 / Ready) and can be cancelled or removed; failures stay visible as "Not analysed — reason".
* Limits: 8 items, images 25 MB, video 300 MB, documents 40 MB (`LIMITS` in `media.js`). Video: up to 8 frames, one per 5 s (configurable there), each frame's **timestamp is sent with the request**. Audio in videos is **not** analysed.
* `caps.js` is the single capability registry; if the chosen assistant can't read images/frames the message is sent to Viora Flash and the chat shows "Switched to Viora Flash: Humanizer can't read images." Your selection is not changed.
* Failed/interrupted answers get a Retry button that replaces the failed answer.

### What this release does NOT include (needs the chat server)
The chat/auth server (`viora-auth-website.onrender.com`) is not part of this zip, so nothing server-side was changed:
real audio transcription, server-side FFmpeg video processing, PDF page-image analysis, provider fallback/rate-limit
handling, and which underlying model answers are decided there. `caps.js` must be kept in sync with that server.
