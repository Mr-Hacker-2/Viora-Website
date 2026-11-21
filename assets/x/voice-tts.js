/* Viora Voice: spoken replies.

   Built so the voice engine can be swapped later without touching the UI. The UI only talks to TTSManager.
   A "provider" is any object with this shape:

     id, label                       short strings
     isSupported() -> boolean
     voices() -> [{ voiceURI, name, lang, localService, default }]        (may be empty)
     onVoicesChanged(cb) -> unsubscribe                                  (optional)
     prime()                         called inside a user gesture so mobile browsers allow later automatic playback
     speak(text, { voiceURI, rate, lang }) -> {
        done:   Promise<'end' | 'cancel' | 'error'>,   settles exactly once
        pause(), resume(), cancel(),
        canPause: boolean }

   BrowserSpeechProvider below is the first implementation (the SpeechSynthesis API built into the browser).
   A neural provider can be added by implementing the same shape, for example one that fetches audio from a server
   route and plays it with an <audio> element, and passing it first in `providers`. Nothing else changes. */

/* ---------- turning an answer into something worth saying out loud ---------- */
const EMOJI = /[\p{Extended_Pictographic}️‍⃣]/gu;

export function speechText(markdown, { maxChars = 8000 } = {}) {
  let t = String(markdown || '').replace(/\r/g, '').replace(EMOJI, '');
  let codeNoted = false, tableNoted = false;
  const note = (kind) => {
    if (kind === 'code') { if (codeNoted) return ''; codeNoted = true; return '\nThere is a code block on screen.\n'; }
    if (tableNoted) return ''; tableNoted = true; return '\nThere is a table on screen.\n';
  };
  t = t.replace(/(```|~~~)[^\n]*\n[\s\S]*?(\1|$)/g, () => note('code'));   // fenced code (also an unfinished one)
  t = t.replace(/^\s*\|.*\|\s*$/gm, '\u0001');                              // table rows
  t = t.replace(/\u0001(\s*\u0001)*/g, () => note('table'));
  t = t.replace(/<[^>\n]{1,200}>/g, '');                                    // html tags
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');                           // images: keep the alt text
  t = t.replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:)[^)]*\)/g, '$1');     // links: keep the words
  t = t.replace(/\[(?:\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g, '');        // citation markers like [1] or [2, 3]
  t = t.replace(/https?:\/\/(?:www\.)?([^\s/)]+)[^\s)]*/g, 'a link to $1'); // bare links: say the site, not the path
  t = t.replace(/`([^`\n]+)`/g, '$1');                                      // inline code
  t = t.replace(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/gm, (m, h) => h.replace(/[.!?:]$/, '') + '.'); // headings read as a short sentence
  t = t.replace(/^\s{0,3}>\s?/gm, '');                                      // blockquotes
  t = t.replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, '');                        // horizontal rules
  t = t.replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\d{1,3}[.)]\s+/gm, '');  // list markers
  t = t.replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(\*|_)([^*_\n]+)\1/g, '$2').replace(/~~(.+?)~~/g, '$1'); // emphasis
  t = t.replace(/\$\$/g, '');                                               // math fences
  // Each line becomes its own sentence so the voice pauses between list items and paragraphs.
  t = t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').replace(/\s+([.!?,;:])/g, '$1').trim()).filter(Boolean)
    .map(l => /[.!?…:;)"'”]$/.test(l) ? l : l + '.').join('\n');
  if (t.length > maxChars) {
    const cut = t.slice(0, maxChars), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = (end > maxChars * 0.5 ? cut.slice(0, end + 1) : cut).trimEnd() + '\nThe rest is on screen.';
  }
  return t.trim();
}

/* Browsers cut long utterances short (Chrome stops after about 15 seconds). Short chunks avoid that and make pausing precise. */
export function chunkSpeech(text, maxLen = 200) {
  const out = [];
  for (const para of String(text || '').split(/\n+/)) {
    const sentences = para.match(/[^.!?…]+(?:[.!?…]+["')\]”]*|$)\s*/g) || [para];
    let cur = '';
    const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
    for (let s of sentences) {
      s = s.trim(); if (!s) continue;
      while (s.length > maxLen) {                        // a very long sentence: break at a comma or space
        let at = Math.max(s.lastIndexOf(', ', maxLen), s.lastIndexOf('; ', maxLen), s.lastIndexOf(': ', maxLen));
        if (at < maxLen * 0.4) at = s.lastIndexOf(' ', maxLen);
        if (at < 1) at = maxLen;
        flush(); out.push(s.slice(0, at + 1).trim()); s = s.slice(at + 1).trim();
      }
      if (!s) continue;
      if (cur && (cur.length + 1 + s.length) > maxLen) flush();
      cur += (cur ? ' ' : '') + s;
    }
    flush();
  }
  return out.filter(c => /[\p{L}\p{N}]/u.test(c));
}

/* ---------- language and voice choice ---------- */
const SCRIPTS = [['ja', /[぀-ヿ]/], ['ko', /[가-힯]/], ['zh', /[一-鿿]/], ['ru', /[Ѐ-ӿ]/], ['ar', /[؀-ۿ]/], ['hi', /[ऀ-ॿ]/], ['he', /[֐-׿]/], ['th', /[฀-๿]/], ['el', /[Ͱ-Ͽ]/]];
export function guessLang(text, fallback = 'en-US') {
  const sample = String(text || '').slice(0, 400);
  const letters = sample.replace(/[^\p{L}]/gu, '');
  if (!letters) return fallback;
  for (const [lang, re] of SCRIPTS) { const n = (sample.match(new RegExp(re.source, 'g')) || []).length; if (n / letters.length > 0.3) return lang; }
  return fallback;
}

const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|princess|ralph|grandma|grandpa|rocko|shelley|flo|eddy|reed|sandy)\b/i;
export function scoreVoice(v, lang) {
  const want = String(lang || 'en-US').toLowerCase(), have = String(v.lang || '').toLowerCase().replace('_', '-');
  const wantBase = want.split('-')[0], haveBase = have.split('-')[0];
  if (haveBase !== wantBase) return -1000;
  let s = have === want ? 40 : 20;
  const name = String(v.name || '');
  if (/natural|neural|online \(/i.test(name)) s += 30;           // Edge / Windows neural voices
  if (/premium|enhanced/i.test(name)) s += 26;                    // Apple's higher quality downloads
  if (/\bsiri\b/i.test(name)) s += 22;
  if (/google/i.test(name)) s += 16;                              // Chrome's network voices
  if (/\b(samantha|ava|allison|aria|jenny|guy|daniel|karen|moira|serena|tessa|zira)\b/i.test(name)) s += 8;
  if (/compact|eloquence/i.test(name)) s -= 12;
  if (NOVELTY.test(name)) s -= 80;
  if (v.localService) s += 2;
  if (v.default) s += 1;
  return s;
}
export function pickVoice(voices, { lang = 'en-US', voiceURI = '' } = {}) {
  const list = Array.isArray(voices) ? voices : [];
  if (voiceURI) { const chosen = list.find(v => v.voiceURI === voiceURI); if (chosen) return chosen; }
  let best = null, bestScore = -Infinity;
  for (const v of list) { const s = scoreVoice(v, lang); if (s > bestScore) { best = v; bestScore = s; } }
  return best && bestScore > -1000 ? best : null;
}

/* ---------- provider: the browser's own SpeechSynthesis ---------- */
export class BrowserSpeechProvider {
  constructor(synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, ua = globalThis.navigator?.userAgent || '') {
    this.id = 'browser'; this.label = 'Built-in voice';
    this.synth = synth; this.Utterance = Utterance;
    /* Chrome on Android does not implement pause(): it behaves like cancel. Pausing is emulated there by remembering the sentence. */
    this.nativePause = !/Android/i.test(ua);
  }
  isSupported() { return !!(this.synth && this.Utterance); }
  voices() { try { return (this.synth.getVoices() || []).map(v => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang, localService: v.localService, default: v.default, raw: v })); } catch { return []; } }
  onVoicesChanged(cb) {
    if (!this.synth?.addEventListener) return () => {};
    this.synth.addEventListener('voiceschanged', cb); return () => this.synth.removeEventListener('voiceschanged', cb);
  }
  /* iOS Safari and some Android browsers only allow speech that starts inside a tap. A silent utterance spoken from the tap unlocks later playback. */
  prime() {
    if (!this.isSupported()) return;
    try { const u = new this.Utterance(' '); u.volume = 0; this.synth.speak(u); } catch {}
  }
  speak(text, { voiceURI = '', rate = 1, lang = '' } = {}) {
    const synth = this.synth, Utterance = this.Utterance, chunks = chunkSpeech(text);
    const language = lang || guessLang(text, globalThis.navigator?.language || 'en-US');
    const voice = pickVoice(this.voices(), { lang: language, voiceURI });
    let i = 0, current = null, paused = false, cancelled = false, finished = false, settle;
    const done = new Promise(r => { settle = r; });
    const finish = reason => { if (finished) return; finished = true; current = null; settle(reason); };
    const next = () => {
      if (finished) return;
      if (cancelled) return finish('cancel');
      if (i >= chunks.length) return finish('end');
      const u = new Utterance(chunks[i]);
      u.lang = (voice && voice.lang) || language; u.rate = Math.min(2, Math.max(0.5, Number(rate) || 1));
      if (voice?.raw) u.voice = voice.raw;
      u.onend = () => { if (current !== u) return; i++; next(); };
      u.onerror = e => {
        if (current !== u) return;
        const code = e && e.error;
        if (code === 'canceled' || code === 'interrupted') { if (paused) return; return finish('cancel'); } // paused on a browser without pause(): wait for resume()
        finish('error');
      };
      current = u; // held on purpose: some browsers garbage-collect an utterance whose events have not fired yet
      try { synth.speak(u); } catch { finish('error'); }
    };
    // Starting clean avoids a stuck queue left by an earlier page or tab.
    try { synth.cancel(); synth.resume(); } catch {}
    next();
    return {
      done, canPause: this.nativePause,
      pause: () => {
        if (finished || paused) return; paused = true;
        try { if (this.nativePause) synth.pause(); else { current = null; synth.cancel(); } } catch {}
      },
      resume: () => {
        if (finished || !paused) return; paused = false;
        try { if (this.nativePause) synth.resume(); else next(); } catch {}
      },
      cancel: () => { if (finished) return; cancelled = true; paused = false; try { synth.cancel(); synth.resume(); } catch {} finish('cancel'); } // resume(): Chrome can stay "paused" after a cancel and would then stay silent
    };
  }
}

/* ---------- the manager the UI uses: exactly one voice at a time ---------- */
export class TTSManager {
  constructor({ providers } = {}) {
    this.providers = (providers && providers.length ? providers : [new BrowserSpeechProvider()]);
    this.provider = this.providers.find(p => { try { return p.isSupported(); } catch { return false; } }) || null;
    this.status = 'idle'; this.id = null; this.handle = null; this.token = 0; this.listeners = new Set();
  }
  get supported() { return !!this.provider; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  state() { return { status: this.status, id: this.id, canPause: !!this.handle?.canPause }; }
  _emit() { const s = this.state(); for (const fn of [...this.listeners]) { try { fn(s); } catch {} } }
  voices() { return this.provider ? this.provider.voices() : []; }
  onVoicesChanged(cb) { return this.provider?.onVoicesChanged ? this.provider.onVoicesChanged(cb) : () => {}; }
  prime() { try { this.provider?.prime?.(); } catch {} }

  /* Speaks `text`. Anything already being spoken is stopped first, so two replies can never overlap.
     Resolves with how it ended: 'end' (finished), 'cancel' (stopped or replaced) or 'error'. */
  async speak(text, { id = null, voiceURI = '', rate = 1, lang = '' } = {}) {
    if (!this.provider) return 'error';
    const clean = String(text || '').trim();
    if (!clean) return 'end';
    this.stop();
    const token = ++this.token;
    let handle;
    try { handle = this.provider.speak(clean, { voiceURI, rate, lang }); } catch { return 'error'; }
    this.handle = handle; this.id = id; this.status = 'speaking'; this._emit();
    const reason = await handle.done;
    if (token === this.token) { this.handle = null; this.id = null; this.status = 'idle'; this._emit(); } // only the newest speech may reset the state
    return reason;
  }
  pause() { if (this.status !== 'speaking' || !this.handle) return false; this.handle.pause(); this.status = 'paused'; this._emit(); return true; }
  resume() { if (this.status !== 'paused' || !this.handle) return false; this.handle.resume(); this.status = 'speaking'; this._emit(); return true; }
  toggle() { return this.status === 'paused' ? this.resume() : this.pause(); }
  stop() {
    const h = this.handle;
    this.token++;                               // invalidates the speech being replaced so it cannot reset the state later
    this.handle = null;
    if (h) { try { h.cancel(); } catch {} }
    if (this.status !== 'idle') { this.status = 'idle'; this.id = null; this._emit(); }
  }
}
