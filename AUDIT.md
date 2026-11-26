# Viora audit, upgrade plan and client/backend changes

## 1. Audit (website repository and separate API)
The website repo is a static front end with unit tests and routing evaluations. Its chat API is in the separate `Mr-Hacker-2/Viora-auth` repository and serves `/api/chat`, `/api/read`, and `/api/verify`. The API source is available for review; deployments and production environment variables still live outside these repositories.

| Area | Where | Status |
|---|---|---|
| Chat lifecycle | `app.html` `send()` → `NP.request` → SSE stream | Handles text, source, model, research and server timing events |
| Assistants | `A` in `app.html`; capabilities in `assets/x/caps.js`; model chains in `Viora-auth/server.js` | Viora lanes map to provider models; client and server both have compatible fallbacks |
| Routing | `assets/x/router.js`; `Viora-auth/research.js`, `intelligence.js` | Client routes Auto and predicts progress; the API makes the authoritative research decision for every web-capable assistant, using request context and a fast classifier for ambiguous facts |
| Retries/timeouts | `assets/x/netperf.js`, `assets/x/router.js`, backend provider chains | Network/HTTP retries, stream-stall handling, client assistant fallback and server model fallback; Stop is not retried |
| Attachments | `app.html` + `assets/x/media.js` | Magic-byte checks, PDF text/OCR, image vision, and up to 8 timestamped video frames. Audio and video audio are not analyzed |
| Memory/projects | `assets/x/memory.js`, localStorage and IndexedDB | Relevant memories/notes are retrieved per prompt; editable, project-scoped and device-local |
| Web research | `Viora-auth/server.js`, `research.js`; client `sources.js` | Searches multiple RSS sources, fetches up to four result pages with guarded reads, supplies bounded page text and dates. Claim-level support verification is NOT performed; UI says so. |
| Tools / Auto-agent | none | "Automate" only plans steps from a page; nothing executes. Auto = routing, not planning. No pause/resume/cancel (only Stop) |
| Evals | `tests/`, `evals/` | Unit and routing-regression coverage exists; no repeatable answer-quality evaluation against live models yet |

Remaining review item: the session token is still sent in a URL query (`/api/verify?token=`), which may expose it in server logs. Chat search matches titles and message content locally on this device.

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

## 5. Remaining backend work
The website and API are separate repositories. Source-page retrieval and server timing are now implemented in `Viora-auth`; claim-level evidence verification is still not implemented and must not be implied. Also remaining: audio transcription, video audio analysis, scanned-PDF page imagery, provider health/latency/cost persistence, and task planning/execution with pause/resume/cancel. Keep `caps.js` in sync with the capabilities the API actually accepts.

## 6. Setup
Static host, publish directory `.`, no build. Edit `API` in `app.html` and `authApi` in `assets/app.js`. Dev: `npm test`, `npm run eval` (Node ≥ 20). No credentials are in the repo.

## 7. Future improvements (by expected benefit)
Server planner with verification → audio/PDF-page/video-audio support → server research verification → pause/resume planner → encrypted cross-device memory → per-assistant latency/cost display.


## 8. Latest client improvements (2026-10-26)
- Chat history search now checks both conversation titles and message content, while preserving project scope.
- `Ctrl+K` / `Cmd+K` focuses and selects the chat search field; existing `Ctrl+Shift+O` / `Cmd+Shift+O` new-chat shortcut remains available.
- These are client-side changes. They do not improve backend model intelligence or search-provider quality by themselves.

## 9. Pro Search 2.0 slice (2026-11-03)
- Added per-device Quick Search / Deep Research selection in `app.html`; the backend honors the selected mode.
- Added bounded query planning, parallel provider passes for Deep Research, URL deduplication, relevance ranking, and broad government/academic/documentation source-type hints in `Viora-auth/research.js`.
- Deep mode: up to 3 queries, 10 distinct result URLs, and 6 guarded page fetches; Quick mode: 1 query, 6 results, and 4 page fetches.
- Added authenticated owner-scoped progress polling at `GET /api/progress?id=...`, short-lived in-memory status, and cancellation of search/page/provider fetches when the chat connection closes.
- Centralized the decision to research on the server: stable or task-focused questions skip the web, explicit/current requests search across answer models, and ambiguous factual questions get a fast intent check. Quick Search retries once with a focused query if its first pass finds nothing relevant; source-backed answers are quality-reviewed before completion.
- Added expandable retrieved-page excerpts, plus research report copy and Markdown export with the research question, findings, sources, retrieval labels, search count, and evidence limitations.
- Search provider integrations remain Bing RSS, Google News RSS, and a DuckDuckGo HTML fallback. This iteration does not add user-defined preferred-domain settings or open-ended agentic follow-up searches.
- Claim-level citation support is still not independently verified. Ranking hints are heuristics and do not establish source reliability.

### Verification
- Website unit suite: 111/111 passed.
- Backend research helper suite: 7/7 passed; `server.js` and `research.js` syntax checks passed.
- Routing eval: 31/33 (0.939); the two misses are existing form-interaction prompts routed to Flash without an attached page. This is a routing eval, not a research-quality or citation-accuracy eval.
- Not run: live provider searches, citation accuracy against model outputs, stop behavior against deployed services, or mobile/desktop browser layout. Those require the deployed API/provider credentials and browser QA.
