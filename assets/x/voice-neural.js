/* Viora Voice: the natural voice (Groq Orpheus, through Viora's own server).

   A provider for TTSManager (see voice-tts.js for the shape). The browser never sees a speech API key: each short piece of a
   reply is POSTed to {API}/api/speak with the person's session token, and the server returns WAV audio.

   How a reply is spoken:
   - The text is cut at sentence boundaries into pieces of at most 180 characters (the model accepts 200 per request).
   - The first piece is requested at once; while a piece plays the next two are already being fetched, so there is no
     wait between sentences.
   - One <audio> element is reused for the whole session. It is unlocked inside the person's tap (prime), which is what lets
     mobile browsers play the reply automatically after a spoken question.
   - Audio that was already generated is kept in memory (bounded), so replaying the latest answer is instant and costs nothing.
   - Pause, resume, stop and speed work on that one element. Stopping aborts the requests still in flight and releases every
     object URL, so nothing keeps playing or leaking.

   If Viora's voice cannot be reached or refuses (server down, not set up, rate limited, a piece that will not decode), the rest of the
   reply is read by the browser's own voice instead, so the person still hears the answer. Not done for a sign-in problem or a browser
   that blocks sound (the browser voice would be blocked too), and never after the person stopped it.

   The Orpheus model speaks English only. Replies written in another script (Japanese, Arabic, Russian ...) are handed to the
   browser's own voice instead, because reading them with an English voice would be unintelligible. */
import { chunkSpeech, guessLang } from './voice-tts.js';

export const NEURAL_VOICES = [
  { voiceURI: 'hannah', name: 'Hannah', note: 'warm, clear' },
  { voiceURI: 'autumn', name: 'Autumn', note: 'soft, calm' },
  { voiceURI: 'diana', name: 'Diana', note: 'bright, confident' },
  { voiceURI: 'austin', name: 'Austin', note: 'friendly' },
  { voiceURI: 'daniel', name: 'Daniel', note: 'steady' },
  { voiceURI: 'troy', name: 'Troy', note: 'deep' }
];
export const DEFAULT_NEURAL_VOICE = 'hannah';
export const MAX_PIECE = 180;
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

export class SpeechError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const MESSAGES = {
  auth: 'Please sign in again to hear Viora.',
  blocked: 'Your browser blocked the sound. Tap the circle once, then try again.',
  network: 'Could not reach Viora’s voice. Check your connection.',
  timeout: 'Viora’s voice took too long to answer.',
  generic: 'Viora could not speak that. The answer is shown as text.'
};

export class NeuralSpeechProvider {
  constructor({ api = '', token = () => '', fetchImpl = globalThis.fetch?.bind(globalThis), AudioImpl = globalThis.Audio, urlApi = globalThis.URL, browser = null, onFallback = null, requestTimeoutMs = 30000, lookahead = 2, cacheBytes = 24 * 1024 * 1024 } = {}) {
    this.id = 'neural'; this.label = 'Viora voice';
    Object.assign(this, { api, token, fetchImpl, AudioImpl, urlApi, browser, onFallback, requestTimeoutMs, lookahead, cacheBytes });
    this.el = null; this.cache = new Map(); this.cacheSize = 0; this.active = 0; this.lastNotice = 0;
  }
  isSupported() { return typeof this.fetchImpl === 'function' && typeof this.AudioImpl === 'function' && !!this.urlApi?.createObjectURL; }
  voices() { return NEURAL_VOICES.map(v => ({ voiceURI: v.voiceURI, name: v.name + ' · ' + v.note, lang: 'en-US', localService: false, default: v.voiceURI === DEFAULT_NEURAL_VOICE })); }
  _voice(uri) { return NEURAL_VOICES.some(v => v.voiceURI === uri) ? uri : DEFAULT_NEURAL_VOICE; }
  _element() {
    if (!this.el) { this.el = new this.AudioImpl(); this.el.preload = 'auto'; try { this.el.setAttribute?.('playsinline', ''); } catch {} }
    return this.el;
  }
  /* Called inside a tap: a silent clip played now unlocks this element for automatic playback later. */
  prime() {
    if (!this.isSupported()) return;
    if (this.active) return; // never disturb speech that is playing or paused
    try { const el = this._element(); {  el.src = SILENT_WAV; const p = el.play(); p?.catch?.(() => {}); } } catch {}
    this.browser?.prime?.(); // the fallback voice is unlocked in the same tap
  }
  _remember(key, blob) {
    if (this.cache.has(key)) return;
    this.cache.set(key, blob); this.cacheSize += blob.size;
    while (this.cacheSize > this.cacheBytes && this.cache.size > 1) { const [k, b] = this.cache.entries().next().value; this.cache.delete(k); this.cacheSize -= b.size; }
  }
  clearCache() { this.cache.clear(); this.cacheSize = 0; }

  /* One request for one piece. Errors carry `retry` so only a passing server or network hiccup is tried a second time. */
  async _requestOnce(text, voice, signal) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), this.requestTimeoutMs), onAbort = () => ctl.abort();
    signal.addEventListener('abort', onAbort);
    try {
      let res;
      try { res = await this.fetchImpl(this.api + '/api/speak', { method: 'POST', headers: { Authorization: 'Bearer ' + this.token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }), signal: ctl.signal }); }
      catch (e) {
        if (signal.aborted) throw new SpeechError('cancelled', '');
        const timedOut = e?.name === 'AbortError';
        throw Object.assign(new SpeechError(timedOut ? 'timeout' : 'network', timedOut ? MESSAGES.timeout : MESSAGES.network), { retry: true });
      }
      if (res.ok) {
        const blob = await res.blob();
        if (!blob.size) throw Object.assign(new SpeechError('generic', MESSAGES.generic), { retry: true });
        return blob;
      }
      let body = null; try { body = await res.json(); } catch {}
      if (res.status === 401) throw new SpeechError('auth', MESSAGES.auth);
      const code = String(body?.code || 'generic'), msg = body && typeof body.error === 'string' ? body.error : MESSAGES.generic;
      throw Object.assign(new SpeechError(code, msg), { retry: [502, 503, 504].includes(res.status) && !['terms_required', 'not_configured', 'disabled'].includes(code) });
    } finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
  }
  async _fetchPiece(text, voice, signal) {
    const key = voice + '|' + text, hit = this.cache.get(key);
    if (hit) { this.cache.delete(key); this.cache.set(key, hit); return hit; } // refresh its place in the queue
    for (let attempt = 0; ; attempt++) {
      if (signal.aborted) throw new SpeechError('cancelled', '');
      try { const blob = await this._requestOnce(text, voice, signal); this._remember(key, blob); return blob; }
      catch (e) {
        if (signal.aborted) throw new SpeechError('cancelled', '');
        if (!(e instanceof SpeechError)) throw new SpeechError('generic', MESSAGES.generic);
        if (!e.retry || attempt >= 1) throw e;
        await new Promise(r => setTimeout(r, 350));
      }
    }
  }

  speak(text, { voiceURI = '', rate = 1, lang = '' } = {}) {
    const language = lang || guessLang(text, 'en-US');
    if (this.browser?.isSupported?.() && !/^en/i.test(language)) return this.browser.speak(text, { voiceURI: '', rate, lang: language });

    const pieces = chunkSpeech(text, MAX_PIECE), voice = this._voice(voiceURI), el = this._element(), urlApi = this.urlApi;
    const abort = new AbortController(), fetches = new Map();
    this.active++;
    let finished = false, paused = false, settle, errorMessage = '', currentUrl = '', at = 0, delegate = null, usedFallback = false;
    const done = new Promise(r => { settle = r; });
    const request = i => { if (i < pieces.length && !fetches.has(i)) { const p = this._fetchPiece(pieces[i], voice, abort.signal); p.catch(() => {}); fetches.set(i, p); } return fetches.get(i); };
    const release = () => { if (currentUrl) { try { urlApi.revokeObjectURL(currentUrl); } catch {} currentUrl = ''; } };
    const finish = reason => {
      if (finished) return; finished = true; this.active = Math.max(0, this.active - 1); abort.abort();
      el.onended = el.onerror = null; try { el.pause(); } catch {}
      release(); try { el.removeAttribute('src'); el.load?.(); } catch {}
      settle(reason);
    };
    const fail = (e) => {
      if (finished) return;
      const code = e && e.code;
      if (!delegate && code !== 'cancelled' && code !== 'auth' && code !== 'blocked' && this.browser?.isSupported?.()) { // keep going with the browser's voice from the piece that failed
        const rest = pieces.slice(at).join(' ');
        try {
          abort.abort(); el.onended = el.onerror = null; try { el.pause(); } catch {} release();
          delegate = this.browser.speak(rest, { voiceURI: '', rate, lang: 'en-US' }); usedFallback = true;
          if (paused) delegate.pause();
          delegate.done.then(r => finish(r), () => finish('error'));
          const now = Date.now();
          if (this.onFallback && now - this.lastNotice > 60000) { this.lastNotice = now; try { this.onFallback((e && e.message ? e.message.replace(/\.$/, '') + '. ' : '') + 'Using this device\u2019s voice for now.'); } catch {} }
          return;
        } catch { /* the browser voice failed too: report the original problem below */ }
      }
      errorMessage = e instanceof SpeechError && e.message ? e.message : MESSAGES.generic; finish(code === 'cancelled' ? 'cancel' : 'error');
    };

    const play = async i => {
      if (finished || delegate) return; at = i;
      if (i >= pieces.length) return finish('end');
      let blob;
      try { const current = request(i); for (let k = 1; k <= this.lookahead; k++) request(i + k); blob = await current; } catch (e) { return fail(e); } // the piece needed now is always asked for first
      if (finished) return;
      for (let k = 1; k <= this.lookahead; k++) request(i + k); // keep the pipeline full once this piece is in hand
      release(); currentUrl = urlApi.createObjectURL(blob);
      el.onended = () => { if (!finished) play(i + 1); };
      el.onerror = () => fail(new SpeechError('generic', MESSAGES.generic));
      el.src = currentUrl; el.playbackRate = Math.min(2, Math.max(0.5, Number(rate) || 1)); el.defaultPlaybackRate = el.playbackRate;
      try { el.preservesPitch = true; el.webkitPreservesPitch = true; } catch {}
      try { await el.play(); } catch (e) {
        if (finished) return;
        if (paused) return;              // pause() raced the start; resume() continues
        if (e?.name === 'AbortError') return; // replaced by a newer src: the newer piece is already handling things
        fail(new SpeechError(e?.name === 'NotAllowedError' ? 'blocked' : 'generic', e?.name === 'NotAllowedError' ? MESSAGES.blocked : MESSAGES.generic));
      }
    };
    play(0);
    return {
      done, get canPause() { return delegate ? !!delegate.canPause : true; },
      error: () => errorMessage, usedFallback: () => usedFallback,
      pause: () => { if (finished || paused) return; paused = true; if (delegate) return delegate.pause(); try { el.pause(); } catch {} },
      resume: () => { if (finished || !paused) return; paused = false; if (delegate) return delegate.resume(); try { const p = el.play(); p?.catch?.(() => {}); } catch {} },
      cancel: () => { if (delegate) { try { delegate.cancel(); } catch {} } finish('cancel'); }
    };
  }
}
