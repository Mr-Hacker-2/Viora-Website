/* Viora Voice: microphone recording and transcription (browser side).

   The browser never sees a speech API key. Audio goes to Viora's own server (POST {API}/api/transcribe with the
   signed-in session token), which holds the keys, validates the file and calls the speech provider. Nothing is
   saved: the recording lives in memory until it has been uploaded, then it is dropped. */

export const DEFAULTS = { maxSeconds: 300, silenceMs: 1400, noSpeechMs: 8000, minSpeechMs: 160, minBytes: 800, uploadTimeoutMs: 60000 };

export class VoiceInputError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'VoiceInputError'; this.code = code; this.status = status; }
}

/* ---------- capability checks ---------- */
export function pickMimeType(MR = globalThis.MediaRecorder) {
  if (!MR) return '';
  const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
  if (typeof MR.isTypeSupported !== 'function') return '';
  return list.find(t => { try { return MR.isTypeSupported(t); } catch { return false; } }) || '';
}
export function micSupport(env = globalThis) {
  if (!env.navigator?.mediaDevices?.getUserMedia || !env.MediaRecorder) return { ok: false, code: 'unsupported', message: 'This browser cannot record audio. Try a recent Chrome, Edge, Firefox or Safari.' };
  if (env.isSecureContext === false) return { ok: false, code: 'insecure', message: 'Voice needs a secure (https) connection.' };
  return { ok: true };
}
export function explainMicError(err) {
  const n = err && err.name;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return new VoiceInputError('denied', 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.');
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return new VoiceInputError('no_device', 'No microphone was found. Connect one and try again.');
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return new VoiceInputError('busy', 'Your microphone is in use by another app. Close it and try again.');
  return new VoiceInputError('mic_error', 'Could not start the microphone.');
}

/* ---------- speech gate: decides "is someone talking" from loudness samples (pure, so it can be tested) ---------- */
export class SpeechGate {
  constructor({ silenceMs = DEFAULTS.silenceMs, noSpeechMs = DEFAULTS.noSpeechMs, minSpeechMs = DEFAULTS.minSpeechMs, autoStop = false, calibrateMs = 350 } = {}) {
    Object.assign(this, { silenceMs, noSpeechMs, minSpeechMs, autoStop, calibrateMs });
    this.startAt = null; this.floorSamples = []; this.threshold = 0.02; this.speechMs = 0; this.lastSpeechAt = null; this.lastAt = null; this.peak = 0; this.heardSpeech = false; this.speaking = false; this.event = null;
  }
  /* rms: 0..1 loudness of the latest slice; now: ms timestamp. Returns { speaking, heardSpeech, event } where event is null, 'silence' or 'no_speech'. */
  push(rms, now) {
    if (this.startAt === null) { this.startAt = now; this.lastAt = now; }
    const dt = Math.max(0, now - this.lastAt); this.lastAt = now;
    this.peak = Math.max(this.peak, rms);
    if (now - this.startAt < this.calibrateMs) { this.floorSamples.push(rms); return this._out(); }
    if (this.floorSamples.length) { // room noise measured at the start sets how loud "speech" must be
      /* A low percentile, so a person who starts talking the moment they tap record does not become the "noise". The cap keeps
         the bar below normal speech loudness even in a loud room (there, silence detection simply degrades; recording still works). */
      const s = [...this.floorSamples].sort((a, b) => a - b), floor = s[Math.floor(s.length * 0.2)];
      this.threshold = Math.min(0.06, Math.max(0.018, floor * 3.2 + 0.006)); this.floorSamples = [];
    }
    this.speaking = rms > this.threshold;
    if (this.speaking) { this.speechMs += dt; this.lastSpeechAt = now; if (this.speechMs >= this.minSpeechMs) this.heardSpeech = true; }
    if (this.autoStop && !this.event) {
      if (this.heardSpeech && !this.speaking && now - this.lastSpeechAt >= this.silenceMs) this.event = 'silence';
      else if (!this.heardSpeech && now - this.startAt >= this.noSpeechMs) this.event = 'no_speech';
    }
    return this._out();
  }
  _out() { return { speaking: this.speaking, heardSpeech: this.heardSpeech, event: this.event }; }
}

/* ---------- recorder ---------- */
export class Recorder {
  /* opts: maxSeconds, autoStop (stop on silence, used by Voice Mode), onLevel(0..1), onTick(seconds), onAutoStop(reason) */
  constructor(opts = {}, env = globalThis) {
    this.opts = { ...DEFAULTS, autoStop: false, ...opts }; this.env = env;
    this.state = 'idle'; this.stream = null; this.mr = null; this.chunks = []; this.ctx = null; this.timer = null; this.t0 = 0; this.gate = null; this.cancelled = false; this.mime = ''; this.stopWaiters = [];
  }
  async start() {
    if (this.state !== 'idle') throw new VoiceInputError('busy', 'Already recording.');
    const sup = micSupport(this.env); if (!sup.ok) throw new VoiceInputError(sup.code, sup.message);
    this.state = 'starting'; this.cancelled = false; this.chunks = [];
    /* iOS only lets audio processing start inside the tap that began it, so the AudioContext is created before the permission prompt. */
    const AC = this.env.AudioContext || this.env.webkitAudioContext;
    try { this.ctx = AC ? new AC() : null; } catch { this.ctx = null; }
    try {
      this.stream = await this.env.navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { this._release(); this.state = 'idle'; throw explainMicError(e); }
    if (this.cancelled) { this._release(); this.state = 'idle'; throw new VoiceInputError('cancelled', 'Cancelled.'); }
    try {
      this.mime = pickMimeType(this.env.MediaRecorder);
      const MRopts = { audioBitsPerSecond: /mp4/.test(this.mime) ? 64000 : 32000 }; if (this.mime) MRopts.mimeType = this.mime;
      this.mr = new this.env.MediaRecorder(this.stream, MRopts);
    } catch { try { this.mr = new this.env.MediaRecorder(this.stream); this.mime = this.mr.mimeType || ''; } catch { this._release(); this.state = 'idle'; throw new VoiceInputError('unsupported', 'This browser cannot record audio.'); } }
    this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.onstop = () => { const w = this.stopWaiters; this.stopWaiters = []; w.forEach(fn => fn()); };
    this.mr.onerror = () => { this.opts.onError?.(new VoiceInputError('mic_error', 'The recording was interrupted.')); this.cancel(); };
    this.stream.getAudioTracks().forEach(t => { t.onended = () => { if (this.state === 'recording') { this.opts.onError?.(new VoiceInputError('mic_lost', 'The microphone was disconnected.')); this.cancel(); } }; });
    this.gate = new SpeechGate({ autoStop: this.opts.autoStop, silenceMs: this.opts.silenceMs, noSpeechMs: this.opts.noSpeechMs, minSpeechMs: this.opts.minSpeechMs });
    this._meter();
    this.mr.start(250); this.t0 = Date.now(); this.state = 'recording';
    return true;
  }
  _meter() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const src = this.ctx.createMediaStreamSource(this.stream), an = this.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an); // never connected to the speakers, so no echo
      const buf = new Float32Array(an.fftSize); let lastSec = -1;
      this.timer = setInterval(() => {
        if (this.state !== 'recording') return;
        an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length), now = Date.now(), sec = Math.floor((now - this.t0) / 1000);
        const g = this.gate.push(rms, now);
        this.opts.onLevel?.(Math.min(1, rms * 5), g.speaking);
        if (sec !== lastSec) { lastSec = sec; this.opts.onTick?.(sec); }
        if (sec >= this.opts.maxSeconds) { this.opts.onAutoStop?.('max_length'); }
        else if (g.event) this.opts.onAutoStop?.(g.event);
      }, 50);
    } catch { this.ctx = null; }
  }
  _release() {
    clearInterval(this.timer); this.timer = null;
    try { this.stream?.getTracks().forEach(t => { t.onended = null; t.stop(); }); } catch {}
    try { this.ctx?.close(); } catch {}
    this.stream = null; this.ctx = null;
  }
  get elapsedMs() { return this.state === 'recording' ? Date.now() - this.t0 : 0; }
  /* Stops and returns the recording. heardSpeech is false when only silence or room noise was captured. */
  async stop() {
    if (this.state !== 'recording') return null;
    this.state = 'stopping';
    const durationMs = Date.now() - this.t0, mime = this.mr.mimeType || this.mime || 'audio/webm';
    const stopped = new Promise(r => { this.stopWaiters.push(r); setTimeout(r, 2500); });
    try { this.mr.stop(); } catch {}
    await stopped;
    const peak = this.gate ? this.gate.peak : 1, heardSpeech = this.gate ? (this.gate.heardSpeech || peak >= 0.08) : true; // a clearly loud sound counts even if it was short
    const blob = new Blob(this.chunks, { type: mime.split(';')[0] || 'audio/webm' });
    this.chunks = []; this._release(); this.mr = null; this.state = 'idle';
    return { blob, mime: blob.type, durationMs, heardSpeech, peak };
  }
  /* Throws the recording away and frees the microphone straight away. */
  cancel() {
    this.cancelled = true;
    if (this.state === 'idle') return;
    const wasRecording = this.state === 'recording' || this.state === 'stopping';
    this.state = 'idle'; this.chunks = [];
    if (wasRecording) { try { this.mr.ondataavailable = null; this.mr.onstop = null; if (this.mr.state !== 'inactive') this.mr.stop(); } catch {} }
    this.mr = null; this._release();
    const w = this.stopWaiters; this.stopWaiters = []; w.forEach(fn => fn());
  }
}

/* ---------- upload ---------- */
const MESSAGES = {
  too_large: 'That recording is too long to transcribe. Try a shorter message.',
  too_short: 'I did not hear anything. Try again.',
  unsupported_format: 'This browser recorded audio in a format Viora cannot read. Try another browser.',
  bad_audio: 'That recording could not be read. Try again.',
  not_configured: 'Voice transcription is not set up yet. Type your message instead.',
  provider_failed: 'Transcription is unavailable right now. Type your message instead.',
  timeout: 'Transcription took too long. Try a shorter message.',
  busy: 'Viora is busy transcribing. Try again in a moment.',
  disabled: 'Voice input is switched off right now. Type your message instead.',
  rate_limited: 'You are recording very quickly. Wait a few seconds and try again.'
};
export async function transcribeAudio(blob, { api, token, language = '', signal, fetchImpl = globalThis.fetch, timeoutMs = DEFAULTS.uploadTimeoutMs } = {}) {
  if (!blob || blob.size < DEFAULTS.minBytes) throw new VoiceInputError('too_short', MESSAGES.too_short);
  const q = language && /^[a-z]{2,3}$/i.test(language) ? '?language=' + encodeURIComponent(language.toLowerCase()) : '';
  const timeout = AbortSignal.timeout(timeoutMs);
  const sig = signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : (signal || timeout);
  let res;
  try {
    res = await fetchImpl(api + '/api/transcribe' + q, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': blob.type || 'audio/webm' }, body: blob, signal: sig });
  } catch (e) {
    if (signal?.aborted) throw new VoiceInputError('cancelled', 'Cancelled.');
    if (e?.name === 'TimeoutError') throw new VoiceInputError('timeout', MESSAGES.timeout);
    throw new VoiceInputError('network', 'Could not reach Viora. Check your connection and try again.');
  }
  let data = null; try { data = await res.json(); } catch {}
  if (res.status === 401) throw new VoiceInputError('auth', 'Please sign in again.', 401);
  if (!res.ok) throw new VoiceInputError(data?.code || 'failed', MESSAGES[data?.code] || data?.error || 'Transcription failed. Try again.', res.status);
  if (!data || typeof data.text !== 'string') throw new VoiceInputError('failed', 'Transcription failed. Try again.', res.status);
  const text = data.text.trim();
  return { text, empty: !text, provider: data.provider || '' };
}

/* Adds transcribed words to what is already typed, without gluing words together. */
export function mergeTranscript(existing, heard, selStart = null, selEnd = null) {
  const add = String(heard || '').trim(); if (!add) return { value: existing, caret: selStart ?? existing.length };
  const text = String(existing || '');
  const a = selStart ?? text.length, b = selEnd ?? a;
  const before = text.slice(0, a), after = text.slice(b);
  const lead = before && !/\s$/.test(before) ? ' ' : '', trail = after && !/^\s/.test(after) ? ' ' : '';
  const value = before + lead + add + trail + after;
  return { value, caret: (before + lead + add).length };
}
