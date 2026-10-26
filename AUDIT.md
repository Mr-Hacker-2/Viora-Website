# Viora audit, upgrade plan and stage-1 changes

## 1. Audit (what is actually in the zip)
**It is a static front end only.** No backend, no tests, no build. Everything intelligent happens on `https://viora-auth-website.onrender.com`, which is NOT in the zip (`/api/chat`, `/api/read`, `/api/verify`). Anything about model choice, search, transcription or provider fallback on the server could not be inspected.

| Area | Where | Status |
|---|---|---|
| Chat lifecycle | `app.html` `send()` → `NP.request` → SSE stream (`choices[].delta`, `viora_sources`) | Implemented. One endpoint, one "assistant" per request |
| Assistants | `A` table in `app.html`; capabilities in `assets/x/caps.js` | 6 Viora assistants, not real provider models. Server maps them to models |
| Routing | was a regex `route()` in `app.html` | Heuristic only. Over-triggered (e.g. "Who was the first president" → web search, "function of mitochondria" → code) |
| Retries/timeouts | `netperf.js` | Good: first-byte timeout, retries, stall cut, keep-warm. No fallback to another assistant |
| Attachments | `app.html` + `media.js` | Client-side: magic-byte sniffing, PDF text (pdf.js), DOCX/XLSX/PPTX (JSZip), OCR (tesseract), images (≤8, 1280px), video = ≤8 timestamped frames. **Audio rejected; scanned PDFs rejected; no PDF page images; no video audio** |
| Memory/projects | `localStorage` (`viora_data_<email>`), IndexedDB for files | Manual, editable, deletable, project-scoped. Was sending the first 60 memories + all notes on every request, no relevance. Device-local only |
| Web research | server-side; client renders `viora_sources` with citations (`sources.js`) | Client rendering is solid. Search quality, multi-source verification, dates: server |
| Tools / Auto-agent | none | "Automate" only plans steps from a page; nothing executes. Auto = routing, not planning. No pause/resume/cancel (only Stop) |
| Evals | none | None existed |

Issues found: session token is sent in a URL query (`/api/verify?token=`), which leaks into server logs; attachments/web pages were sent as plain text with no prompt-injection marking; whole project notes sent each time; chat search now matches both titles and message content (client-side; device-local only); `readFile` rejects images with a stale "not supported yet" branch that `addFiles` never reaches.

## 2. Prioritised plan
1. (done) Router + capability-aware fallback + health. 2. (done) Retrieval instead of dumping memory/notes. 3. (done) Untrusted-content marking. 4. (done) Eval harness. 
5. Server: audio transcription, FFmpeg/video audio, PDF page images, token-in-header auth, real provider registry with measured latency/cost. 
6. (done) Client: chat full-text search and Ctrl+K shortcut. 7. Server: pause/resume for multi-step runs (requires a server-side planner). 8. Citation checking server-side.

## 3. Done in stage 1
- `assets/x/router.js` (new): `classify`, `chain`, `Health` circuit breaker, `shouldFallback`. Capabilities still come only from `caps.js`.
- `assets/x/memory.js` (new): `retrieveMemory`, `retrieveNotes`, `wrapUntrusted`.
- `app.html`: uses the above. On 429/5xx/network failure the same conversation is resent to the next capable assistant and the chat says which one answered. Stop is never retried. Memories are limited to ≤12 relevant (+ newest up to 4); notes to 3000 chars of best-matching passages.
- `tests/` (16 tests, all pass), `evals/` (29 labelled routing prompts), `package.json` (`npm test`, `npm run eval`).

## 4. Results (run locally with Node 22)
`npm test`: 16/16 pass. `npm run eval`: legacy router 24/29, new router 29/29.
**Caveat:** I wrote the eval cases while fixing the rules, so 29/29 is partly tuned to them; treat it as a regression guard, not proof of general accuracy. These evals test routing only. They do not show Viora gives smarter answers; that needs server-side evals against the real models.
**Not tested:** the live server, SSE streaming and the fallback loop in a real browser (only syntax-checked). Please try: stop a reply mid-stream, send with an image, and simulate an outage.

## 5. Backend work not possible from these files
Accept `Authorization` header on `/api/verify`; audio transcription endpoint; server video pipeline (frames + audio, timestamps); PDF page rasterisation; a model registry with real health/latency/cost; search + fetch with source dates and quote verification; a task planner/executor with pause/resume/cancel; tool permission checks and approval prompts; authenticated cross-device sync for memory/projects. Keep `caps.js` in sync with whatever the server really supports.

## 6. Setup
Static host, publish directory `.`, no build. Edit `API` in `app.html` and `authApi` in `assets/app.js`. Dev: `npm test`, `npm run eval` (Node ≥ 20). No credentials are in the repo.

## 7. Future improvements (by expected benefit)
Server planner with verification → audio/PDF-page/video-audio support → server research verification → pause/resume planner → encrypted cross-device memory → per-assistant latency/cost display.


## 8. Latest client improvements (2026-10-26)
- Chat history search now checks both conversation titles and message content, while preserving project scope.
- `Ctrl+K` / `Cmd+K` focuses and selects the chat search field; existing `Ctrl+Shift+O` / `Cmd+Shift+O` new-chat shortcut remains available.
- These are client-side changes. They do not improve backend model intelligence or search-provider quality by themselves.
