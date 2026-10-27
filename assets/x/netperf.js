/* Viora web app — speed & reliability.
   Everything here changes how the app talks to the Viora server; nothing is cosmetic.
   Saved per device in localStorage (viora_perf). Imported by app.html.

   - request():   first-byte timeout + automatic retries (the server runs on a free host that
                  sleeps when idle, so the first request after a while can take a minute).
   - readChunk(): reads the reply stream but gives up if it goes silent.
   - trimHistory(): sends only the latest messages with each question.
   - keepWarm():  pings the server while the app is open so it does not fall asleep.
   - mount():     the settings panel. */

export const DEFAULTS = Object.freeze({
  firstByteSec: 60,   // wait this long for the server to start answering before trying again (0 = forever)
  retries: 2,         // extra tries after a dropped connection, a timeout, or a 429/502/503/504
  stallSec: 30,       // a reply that goes silent this long is stopped and kept as is (0 = never)
  history: 30,        // how many earlier messages are sent with each question (0 = all)
  keepWarm: true,     // ping the server every ~8 minutes while the app is open
  restoreOnFail: true,// put your message back in the box if it could not be sent
  saveDraft: true     // remember what you were typing if the page is closed or reloads
});

export const PRESETS = Object.freeze({
  fast: { firstByteSec: 25, retries: 1, stallSec: 20, history: 10, keepWarm: true },
  balanced: { ...DEFAULTS },
  reliable: { firstByteSec: 90, retries: 4, stallSec: 60, history: 40, keepWarm: true, restoreOnFail: true, saveDraft: true }
});

const KEY = 'viora_perf';
const int = (v, min, max, d) => { const n = Math.round(Number(v)); return v !== '' && v != null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

export function normalize(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    firstByteSec: int(p.firstByteSec, 0, 300, DEFAULTS.firstByteSec),
    retries: int(p.retries, 0, 6, DEFAULTS.retries),
    stallSec: int(p.stallSec, 0, 300, DEFAULTS.stallSec),
    history: int(p.history, 0, 200, DEFAULTS.history),
    keepWarm: bool(p.keepWarm, DEFAULTS.keepWarm),
    restoreOnFail: bool(p.restoreOnFail, DEFAULTS.restoreOnFail),
    saveDraft: bool(p.saveDraft, DEFAULTS.saveDraft)
  };
}
export function load() { try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return normalize(); } }
export function save(p) { const n = normalize(p); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) { /* blocked storage: the choice lasts until reload */ } current = n; return n; }
let current = load();
export const get = () => current;
export function matchPreset(p) {
  const n = normalize(p);
  return Object.keys(PRESETS).find((k) => { const w = normalize({ ...n, ...PRESETS[k] }); return Object.keys(w).every((f) => w[f] === n[f]); }) || '';
}

const abortErr = () => new DOMException('Aborted', 'AbortError');
function sleep(ms, signal) {
  return new Promise((ok, no) => {
    if (signal && signal.aborted) return no(abortErr());
    const t = setTimeout(() => { if (signal) signal.removeEventListener('abort', onAbort); ok(); }, ms);
    const onAbort = () => { clearTimeout(t); no(abortErr()); };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}
const RETRY_STATUS = [408, 425, 429, 500, 502, 503, 504];

export function describeHttpFailure(status, detail = '') {
  const suffix = detail ? ` Details: ${detail}` : '';
  if (status === 413) return `That upload is too large for the server to accept.${suffix}`;
  if (status === 429) return `Viora is rate-limited right now. Wait a moment, then try again.${suffix}`;
  if ([408, 425, 504].includes(status)) return `Viora timed out waiting for an AI provider.${suffix}`;
  if (status === 502 || status === 503) return `Viora's AI service is temporarily unavailable. Try again shortly.${suffix}`;
  if (status >= 500) return `Viora's AI service returned a server error (HTTP ${status}).${suffix}`;
  return detail || `The request failed (HTTP ${status}). Please try again.`;
}

export function splitStreamLines(buffer, flush = false) {
  const lines = String(buffer).split(/\r?\n/);
  return flush ? { lines, rest: '' } : { lines: lines.slice(0, -1), rest: lines.at(-1) };
}

/* fetch() with a first-byte timeout and automatic retries.
   `signal` is the person's Stop button: it is never retried. onWait(text) reports each pause. */
export async function request(url, init, { signal, onWait = () => {}, perf = current } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('You appear to be offline. Check your connection, then try again.');
  const total = perf.retries + 1;
  for (let attempt = 0; ; attempt++) {
    if (signal && signal.aborted) throw abortErr();
    const ctl = new AbortController();
    let timedOut = false;
    const onAbort = () => ctl.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    const timer = perf.firstByteSec ? setTimeout(() => { timedOut = true; ctl.abort(); }, perf.firstByteSec * 1000) : 0;
    let res = null, failure = null;
    try { res = await fetch(url, { ...init, signal: ctl.signal }); }
    catch (err) { failure = err; }
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
    if (signal && signal.aborted) throw failure && failure.name === 'AbortError' ? failure : abortErr();

    const retryable = failure ? true : RETRY_STATUS.includes(res.status);
    if (!retryable) return res;
    if (attempt >= perf.retries) {
      if (res) return res; // the caller turns a 429/5xx into its normal error message
      throw timedOut ? new Error('The server took too long to answer. It may be waking up, so try again in a moment.') : failure;
    }
    let pause = Math.min(6000, 700 * 2 ** attempt) + Math.floor(Math.random() * 300);
    if (res) {
      const ra = Number(res.headers.get('retry-after'));
      if (ra > 0) pause = Math.min(15000, ra * 1000);
      try { await res.body.cancel(); } catch (e) { /* being discarded anyway */ }
    }
    onWait(`${timedOut ? 'The server is slow to wake up' : 'Connection hiccup'} — trying again (${attempt + 2} of ${total})…`);
    await sleep(pause, signal);
  }
}

/* One read from the reply stream. If nothing arrives for stallSec the stream is cancelled and
   { stalled: true, done: true } is returned, so the caller keeps what it has. */
export async function readChunk(reader, perf = current) {
  if (!perf.stallSec) return reader.read();
  let timer = 0;
  const stall = new Promise((ok) => { timer = setTimeout(() => ok({ stalled: true, done: true }), perf.stallSec * 1000); });
  try {
    const r = await Promise.race([reader.read(), stall]);
    if (r.stalled) { try { await reader.cancel(); } catch (e) { /* already closed */ } }
    return r;
  } finally { clearTimeout(timer); }
}

/* Send only the latest `history` messages, and never start on a reply. */
export function trimHistory(messages, n = current.history) {
  if (!n || messages.length <= n) return messages;
  const out = messages.slice(-n);
  while (out.length > 1 && out[0].role !== 'user') out.shift();
  return out;
}

/* Ping the server while the app is open and visible so a free host does not go to sleep. Returns a stop function. */
export function keepWarm(url) {
  let last = Date.now();
  const ping = () => {
    if (!current.keepWarm || document.visibilityState !== 'visible') return;
    last = Date.now();
    fetch(url, { cache: 'no-store' }).catch(() => {});
  };
  const t = setInterval(ping, 8 * 60 * 1000);
  const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - last > 5 * 60 * 1000) ping(); };
  document.addEventListener('visibilitychange', onVis);
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
}

/* The settings panel. Saves as you change things. */
const FIELDS = [
  ['num', 'firstByteSec', 'Wait for the server to start answering for (seconds, 0 = forever)', 0, 300, 5],
  ['num', 'retries', 'Try again automatically after a failure (extra tries, 0–6)', 0, 6, 1],
  ['num', 'stallSec', 'Stop a reply that goes silent for (seconds, 0 = never)', 0, 300, 5],
  ['num', 'history', 'Earlier messages sent with each question (0 = all of them)', 0, 200, 5],
  ['bool', 'keepWarm', 'Keep the server awake while the app is open (avoids the slow first reply after a break)'],
  ['bool', 'restoreOnFail', 'Put my message back in the box if it could not be sent'],
  ['bool', 'saveDraft', 'Remember what I was typing if the page reloads']
];
const PRESET_INFO = { fast: ['Fastest', 'Short waits, little history'], balanced: ['Balanced', 'The default'], reliable: ['Most reliable', 'Patient, retries more'] };
export function mount(el) {
  const paint = () => {
    const p = current, m = matchPreset(p);
    el.innerHTML = '<div class="np-presets" role="radiogroup" aria-label="Speed preset">' +
      Object.entries(PRESET_INFO).map(([k, [n, d]]) => `<button type="button" role="radio" aria-checked="${m === k}" data-np-preset="${k}"><b>${n}</b><span>${d}</span></button>`).join('') +
      '</div>' + (m ? '' : '<p class="pf-note">Custom: you have changed some of the numbers.</p>') +
      FIELDS.map(([t, k, label, min, max, step]) => t === 'num'
        ? `<label class="np-f"><span>${label}</span><input type="number" min="${min}" max="${max}" step="${step}" value="${p[k]}" data-np="${k}"></label>`
        : `<label class="np-c"><input type="checkbox" data-np="${k}"${p[k] ? ' checked' : ''}><span>${label}</span></label>`).join('') +
      '<p class="pf-note">Saved on this device. “Fastest” sends less history and waits less; “Most reliable” waits longer and retries more.</p>';
  };
  el.onclick = (e) => { const b = e.target.closest('[data-np-preset]'); if (!b) return; save({ ...current, ...PRESETS[b.dataset.npPreset] }); paint(); };
  el.onchange = (e) => {
    const f = e.target.closest('[data-np]'); if (!f) return;
    save({ ...current, [f.dataset.np]: f.type === 'checkbox' ? f.checked : f.value === '' ? undefined : Number(f.value) });
    paint();
  };
  paint();
}
