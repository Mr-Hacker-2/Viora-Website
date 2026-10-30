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
The whole site (marketing pages and web app) now opens in the **white (light) look** (originally green accent; see v4 below for the extension palette).
Users can switch to dark and change the accent in **Account → Appearance** or in the app via
**gear → Settings**. The web app supports both themes (layout in `assets/x/viora-theme.css`, light colours
in its last block). Saved per device in
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
* Limits: 8 items, images 25 MB, video 300 MB, documents 40 MB (`LIMITS` in `media.js`). PDF attachments extract selectable text and include up to eight evenly sampled page images for visual analysis (charts, diagrams, screenshots, and scanned pages). When a PDF has no selectable text, OCR is attempted on the sampled pages. Short MP4 clips up to 2 minutes and 4 MB use NVIDIA Nemotron 3 Nano Omni for native video/audio understanding; larger MP4/WebM clips use up to eight timestamped frames and do not analyze audio in that fallback.
* `caps.js` is the single capability registry; if the chosen assistant can't read images/frames the message is sent to Viora Flash and the chat shows "Switched to Viora Flash: Humanizer can't read images." Your selection is not changed.
* Failed/interrupted answers get a Retry button that replaces the failed answer.

### Chat service boundary and research limits
The chat/auth API runs separately from this static website in the `Viora-auth` repository. The backend now fetches up to four search-result pages through its guarded reader and supplies bounded page text and publication dates to the research model. It reports the selected provider model, search/page-fetch timing, and whether each page was retrieved.

Page retrieval is not independent claim verification: the API does not prove that every cited statement is supported, and the interface explicitly reports claim support as unverified. Standalone audio-file transcription and full-document page-by-page vision are not implemented. PDF visual analysis samples up to eight pages; conclusions about unrendered pages may be incomplete. Keep `caps.js` aligned with the actual backend capabilities.

---
## v3 upgrade notes

### White by default
Every page starts in light mode unless a visitor chose dark (`viora_theme`). The web app's three-column
layout used to exist only for dark; it now applies to both themes, with a light palette at the end of
`assets/x/viora-theme.css`.

### Speed & reliability (web app → gear → Settings)
Code: `assets/x/netperf.js` (+ `netperf.css`). Saved per device in `localStorage` (`viora_perf`).
- **Wait for the server** (default 60 s): the server is on a free host that sleeps, so a cold start can take a minute; after this long the request is retried.
- **Automatic retries** (default 2): dropped connections, timeouts and 429/502/503/504 are retried with a growing pause. The Stop button is never retried. The reply area says "trying again (2 of 3)…".
- **Stop a silent reply** (default 30 s): a stream that goes quiet is cut and what arrived is kept, with a note.
- **History sent** (default 30 messages): only the latest messages go with each question, so long chats stay fast and under the upload limit.
- **Keep the server awake**: pings it every ~8 minutes while the app is open and visible.
- **Put my message back if it could not be sent**, and **remember what I was typing** (draft).
- One-tap presets: Fastest / Balanced / Most reliable.

---
## v4 upgrade notes: the website now looks like the extension (7.24.4)

Same palette, type and shapes as the extension's side panel / tab:
- **Colours** (`assets/x/accent.css`, `assets/style.css`, `assets/x/viora-theme.css`): light = soft pink/blue pastel wash, white cards,
  `#f6f8fe` / `#e0e5f2` / `#1d1e2b`; dark = the extension's deep violet (`#17141f`, `#1d1929`, `#322a44`). The green is gone.
- **Accent**: default is the extension's violet. Like the extension, each assistant has its own hue (Flash violet, Deep Search sky,
  Math & Code mint, Automate amber, Humanizer rose); the web app switches hue with the chosen assistant (`html[data-model]`).
  Picking an accent under Settings pins one colour everywhere (`viora_accent`: blue, mint, amber, rose; violet = default behaviour).
  Old saved `green` values simply fall back to the default.
- **Shapes**: glass header, gradient "Viora" wordmark (violet to orange), pill chips with soft shadows, white floating composer (radius 26),
  round lilac send button, shadows instead of hard borders on cards.
- **Home page**: logo + light-weight "Welcome, what do you want me to do?" greeting, assistant chips use their own hue.
- **Fonts**: the Google Fonts (Inter / Space Grotesk) are no longer loaded; the site uses the same system font stack as the extension (faster, no third-party request).
- The web app keeps its three-column layout (chats / chat / tools), only recoloured to match.

---
## v5 upgrade notes: public-site visual refresh

- Home page rebuilt around a live product preview: split hero, interactive assistant demo with sources, stats strip, assistant and prompt galleries, feature bento, four-step install path, safety/automation panel, FAQ and dark CTA band.
- `assets/v5.css` loads after `assets/style.css` on the public pages only (`index`, `login`, `account`, `help`, `privacy`, `terms`, `404`); `app.html` is untouched.
- Responsive header keeps the theme control on mobile, assistant/help chip rails start at the first item, legal pages use full-width cards, and the footer is rebuilt for small screens.
- Accessibility: WCAG AA contrast across public pages, visible focus styles and reduced-motion support; axe scans report zero A/AA violations.
---
## v6 upgrade notes: research, files, memory and downloads

- **Auto routing** (`assets/x/router.js`) now prioritizes explicit research and fact-checking requests and recognizes citations, verification, evidence, studies and references. The routing evaluation cases and unit tests include these patterns.
- **Answer quality guidance** (`assets/x/persona.js`) now asks Deep Search to prefer primary sources, cross-check important claims, respect dates, cite only sources actually returned by the search system, and disclose when usable search results are unavailable. Coding and file-analysis guidance also emphasizes uncertainty and honest capability limits.
- **PDF understanding** (`app.html`) extracts selectable text, sends up to eight evenly sampled page images for visual analysis, and tries OCR on sampled pages when the PDF has no selectable text. OCR may contain mistakes, and sampled-page analysis may miss details on pages that were not sent.
- **User-controlled memory**: a bookmark/note action on an AI reply saves the related question to the existing per-device Memory list. Memory remains opt-in, editable and deletable; it is stored in this browser/device and does not automatically sync across devices.
- **Reliability** (`assets/x/netperf.js`) retries transient 408, 425, 429 and common 5xx responses as well as network failures. Stop requests are still not retried; the existing regenerate/retry action remains available.
- **Phone-to-PC source download**: `download-site.html` links to the repository ZIP and explains how to transfer it from a phone and extract it on Windows. This downloads source code; it does not install the website as an offline application.
- **Backend boundary**: this repository chooses Viora assistant modes. The underlying provider/model selection, search provider, returned sources and server-side fallback are controlled by the separate chat server. These front-end changes cannot guarantee provider-level routing or make the server's web results more reliable without changes to that server.

---
## v7 upgrade notes: emoji-forward replies

- **Emojis on by default** (`assets/x/persona.js`): `DEFAULT_LEVEL` is now `warm`. Warm uses roughly 3 to 7 meaningful emojis per answer (opening line, key points and headings, closing line); Very expressive uses roughly 6 to 12. Visitors who already chose Plain in Settings keep it (`viora_tone`).
- **Guardrails in the prompt**: no emojis inside code blocks, URLs, quotes, citations or numbers, and none when the user is upset or the topic is a serious medical, legal or safety matter. Rewrite tools (Humanizer) stay plain.
- Removed the "emojis are optional" lines in the base prompt and the Flash guide that worked against the setting.
- **Model**: the website only sends `context.instructions`; the server (`Viora-auth/server.js`) picks the NVIDIA model and appends these instructions to its system prompt. Pro Search already leads with `nvidia/nemotron-3-ultra-550b-a55b`.
- Service worker cache bumped to `viora-shell-v5` so returning visitors get the new prompt.
