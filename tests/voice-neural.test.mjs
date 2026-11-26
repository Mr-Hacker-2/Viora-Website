import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuralSpeechProvider, NEURAL_VOICES, DEFAULT_NEURAL_VOICE, MAX_PIECE } from '../assets/x/voice-neural.js';
import { TTSManager } from '../assets/x/voice-tts.js';

/* ---------- stand-ins for fetch, <audio> and URL ---------- */
class FakeAudio {
  static all = [];
  constructor() { this.paused = true; this.src = ''; this.playbackRate = 1; this.plays = []; FakeAudio.all.push(this); }
  setAttribute() {}
  play() { this.paused = false; this.plays.push(this.src); return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute(n) { if (n === 'src') this.src = ''; }
  load() {}
  end() { const f = this.onended; this.paused = true; f && f(); } // the current piece finished playing
}
const makeUrl = () => { const created = [], revoked = []; let n = 0; return { createObjectURL: b => { const u = 'blob:' + (++n); created.push(u); return u; }, revokeObjectURL: u => revoked.push(u), created, revoked }; };
const ok = () => ({ ok: true, status: 200, blob: async () => ({ size: 1000 }), json: async () => ({}) });
const fail = (status, body) => ({ ok: false, status, blob: async () => ({ size: 0 }), json: async () => body });
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
const finishAll = async (h, audio, ms = 2000) => { let settled = false; h.done.then(() => { settled = true; }); const t = Date.now(); while (!settled) { if (Date.now() - t > ms) throw new Error('reply did not finish'); audio().end(); await tick(3); } return h.done; };
const until = async (fn, ms = 1500) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timed out waiting'); await tick(2); } };

function setup(handler = () => ok(), extra = {}) {
  FakeAudio.all.length = 0;
  const urlApi = makeUrl(), calls = [];
  const fetchImpl = async (url, init) => { const call = { url, init, body: JSON.parse(init.body), signal: init.signal }; calls.push(call); return handler(call, calls.length); };
  const p = new NeuralSpeechProvider({ api: 'https://api.test', token: () => 'tok123', fetchImpl, AudioImpl: FakeAudio, urlApi, requestTimeoutMs: 400, ...extra });
  return { p, calls, urlApi, audio: () => FakeAudio.all[0] };
}
const LONG = Array.from({ length: 12 }, (_, i) => 'This is sentence number ' + (i + 1) + ' of a fairly long answer that Viora is reading aloud.').join(' ');

test('is supported only when fetch, Audio and object URLs exist', () => {
  assert.equal(setup().p.isSupported(), true);
  assert.equal(new NeuralSpeechProvider({ fetchImpl: null, AudioImpl: FakeAudio, urlApi: makeUrl() }).isSupported(), false);
  assert.equal(new NeuralSpeechProvider({ fetchImpl: () => {}, AudioImpl: null, urlApi: makeUrl() }).isSupported(), false);
  const vs = setup().p.voices();
  assert.deepEqual(vs.map(v => v.voiceURI), NEURAL_VOICES.map(v => v.voiceURI));
  assert.equal(vs.filter(v => v.default).length, 1);
});

test('sends short pieces to /api/speak with the session token, never a provider key', async () => {
  const { p, calls } = setup();
  const h = p.speak(LONG, { voiceURI: 'troy' });
  await until(() => calls.length >= 1);
  const c = calls[0];
  assert.equal(c.url, 'https://api.test/api/speak');
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.headers.Authorization, 'Bearer tok123');
  assert.equal(c.body.voice, 'troy');
  assert.ok(c.body.text.length > 0 && c.body.text.length <= MAX_PIECE);
  assert.deepEqual(Object.keys(c.body).sort(), ['text', 'voice']);
  h.cancel(); assert.equal(await h.done, 'cancel');
});

test('a browser voice name from older settings falls back to the default voice', async () => {
  const { p, calls } = setup();
  const h = p.speak('Hello there.', { voiceURI: 'Google US English' });
  await until(() => calls.length >= 1);
  assert.equal(calls[0].body.voice, DEFAULT_NEURAL_VOICE);
  h.cancel(); await h.done;
});

test('plays the pieces in order on one audio element, fetching ahead, and ends cleanly', async () => {
  const { p, calls, urlApi, audio } = setup();
  const h = p.speak(LONG, { rate: 1.2 });
  const total = LONG.length;
  await until(() => audio()?.plays.length === 1);
  assert.ok(calls.length >= 2 && calls.length <= 3, 'the next pieces are already being fetched while the first plays (got ' + calls.length + ')');
  assert.equal(audio().playbackRate, 1.2);
  assert.equal(FakeAudio.all.length, 1, 'one audio element for the whole reply');
  let n = 1;
  for (;;) {
    const before = audio().plays.length;
    audio().end();
    await tick(5);
    if (audio().plays.length === before) break;
    n++;
  }
  assert.equal(await h.done, 'end');
  assert.equal(n, calls.length, 'every piece fetched was played, once');
  const spoken = calls.map(c => c.body.text).join(' ');
  assert.ok(spoken.replace(/\s+/g, ' ').length >= total * 0.95, 'nothing was dropped');
  assert.equal(urlApi.created.length, urlApi.revoked.length, 'every object URL is released');
});

test('cancel stops playback, aborts requests in flight and releases audio', async () => {
  const gate = []; // never-resolving requests that honour abort
  const { p, calls, urlApi, audio } = setup(call => new Promise((res, rej) => { call.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))); gate.push(res); }), { requestTimeoutMs: 5000 });
  const h = p.speak(LONG);
  await until(() => calls.length >= 1);
  h.cancel();
  assert.equal(await h.done, 'cancel');
  assert.ok(calls.every(c => c.signal.aborted), 'all in-flight requests are aborted');
  assert.equal(audio().paused, true);
  assert.equal(audio().src, '');
  await tick(20); assert.equal(calls.length, Math.min(calls.length, 3), 'no new requests after cancel');
  assert.equal(urlApi.created.length, urlApi.revoked.length);
});

test('pause and resume act on the audio element', async () => {
  const { p, audio } = setup();
  const h = p.speak('One short sentence for the test.');
  await until(() => audio()?.plays.length === 1);
  h.pause(); assert.equal(audio().paused, true);
  h.resume(); assert.equal(audio().paused, false);
  audio().end(); assert.equal(await h.done, 'end');
});

test('a passing 503 is retried once; a permanent error is not', async () => {
  let n = 0;
  const a = setup(() => (++n === 1 ? fail(503, { code: 'busy', error: 'Viora is busy speaking. Try again in a moment.' }) : ok()));
  const h = a.p.speak('Retry me please.');
  await until(() => a.audio()?.plays.length === 1);
  assert.equal(n, 2);
  a.audio().end(); assert.equal(await h.done, 'end');

  const b = setup(() => fail(503, { code: 'terms_required', error: 'The voice model needs its one-time terms accepted in the Groq console before it can speak.' }));
  const h2 = b.p.speak('Permanent failure.');
  assert.equal(await h2.done, 'error');
  assert.equal(b.calls.length, 1, 'not retried');
  assert.match(h2.error(), /terms/i);
});

test('errors give readable messages: sign-in, rate limit, network, timeout', async () => {
  const r1 = setup(() => fail(401, { error: 'Please sign in again.' })).p.speak('Hello there friend.'); assert.equal(await r1.done, 'error'); assert.match(r1.error(), /sign in/i);
  const r2 = setup(() => fail(429, { code: 'provider_rate_limited', error: 'Viora’s voice is rate limited for a moment. Try again shortly.' })).p.speak('Hello there friend.'); assert.equal(await r2.done, 'error'); assert.match(r2.error(), /rate limited/i);
  const r3 = setup(() => { throw new TypeError('Failed to fetch'); }).p.speak('Hello there friend.'); assert.equal(await r3.done, 'error'); assert.match(r3.error(), /reach|connection/i);
  const r4 = setup(call => new Promise((_, rej) => call.signal.addEventListener('abort', () => rej(Object.assign(new Error('t'), { name: 'AbortError' }))))).p.speak('Hello there friend.'); assert.equal(await r4.done, 'error'); assert.match(r4.error(), /too long/i);
});

test('a failure after the first piece still ends in an error (the text stays on screen) and frees the audio', async () => {
  let n = 0;
  const { p, audio, urlApi } = setup(() => (++n >= 2 ? fail(500, { code: 'provider_failed', error: 'Speech is unavailable right now.' }) : ok()));
  const h = p.speak(LONG, {});
  await until(() => audio()?.plays.length === 1);
  audio().end();
  assert.equal(await h.done, 'error');
  assert.match(h.error(), /unavailable/i);
  assert.equal(urlApi.created.length, urlApi.revoked.length);
});

test('a browser that blocks autoplay gets a clear message', async () => {
  const { p } = setup();
  const orig = FakeAudio.prototype.play;
  FakeAudio.prototype.play = function () { return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })); };
  try { const h = p.speak('Hello there friend.'); assert.equal(await h.done, 'error'); assert.match(h.error(), /blocked/i); }
  finally { FakeAudio.prototype.play = orig; }
});

test('audio already generated is reused: replaying costs no requests', async () => {
  const { p, calls, audio } = setup();
  const say = async () => { const h = p.speak('A short answer to replay. It has two sentences.'); await until(() => audio()?.plays.length >= 1); let guard = 0; while (guard++ < 10) { const n = audio().plays.length; audio().end(); await tick(3); if (audio().plays.length === n) break; } return h.done; };
  assert.equal(await say(), 'end');
  const first = calls.length; assert.ok(first >= 1);
  assert.equal(await say(), 'end');
  assert.equal(calls.length, first, 'second playback made no new requests');
});

test('the cache stays within its byte budget', async () => {
  const { p } = setup(() => ok(), { cacheBytes: 2500 });
  for (const t of ['aaa one.', 'bbb two.', 'ccc three.', 'ddd four.']) { const h = p.speak(t); assert.equal(await finishAll(h, () => FakeAudio.all[0]), 'end'); }
  assert.ok(p.cacheSize <= 2500 + 1000 && p.cache.size <= 3, 'oldest entries are evicted (' + p.cache.size + ' kept)');
});

test('text in a script the English model cannot speak goes to the browser voice', async () => {
  let got = null;
  const browser = { isSupported: () => true, prime() {}, speak: (t, o) => { got = { t, o }; return { done: Promise.resolve('end'), canPause: true, pause() {}, resume() {}, cancel() {} }; } };
  const { p, calls } = setup(() => ok(), { browser });
  const h = p.speak('こんにちは、元気ですか。今日はいい天気ですね。');
  assert.equal(await h.done, 'end');
  assert.ok(got && /こんにちは/.test(got.t));
  assert.equal(calls.length, 0, 'nothing sent to the neural voice');
  assert.equal(got.o.voiceURI, '', 'the English voice choice is not passed to a browser voice');
});

test('prime unlocks the audio element but never disturbs speech in progress', async () => {
  const { p, audio } = setup();
  p.prime(); assert.ok(audio().src.startsWith('data:audio/wav'));
  const h = p.speak('Something is being said right now.');
  await until(() => audio().src.startsWith('blob:'));
  const playing = audio().src; p.prime(); assert.equal(audio().src, playing);
  h.cancel(); await h.done;
});

test('TTSManager: one voice at a time, and the failure reason is kept for the UI', async () => {
  const a = setup();
  const m = new TTSManager({ providers: [a.p] });
  assert.equal(m.providerId, 'neural');
  const first = m.speak('First answer being read out loud.', { id: 'a' });
  await until(() => a.audio()?.plays.length === 1);
  const second = m.speak('Second answer replaces it.', { id: 'b' });
  assert.equal(await first, 'cancel');
  await until(() => a.audio()?.plays.length === 2 || a.audio()?.plays.some(s => s.startsWith('blob:')));
  assert.equal(m.state().id, 'b'); assert.equal(FakeAudio.all.length, 1, 'still one audio element');
  m.stop(); assert.equal(await second, 'cancel'); assert.equal(m.state().status, 'idle');

  const bad = new TTSManager({ providers: [setup(() => fail(503, { code: 'terms_required', error: 'Needs terms.' })).p] });
  assert.equal(await bad.speak('This will fail.'), 'error');
  assert.equal(bad.lastError, 'Needs terms.');
  assert.equal(await bad.speak('   '), 'end'); assert.equal(bad.lastError, '');
});

/* ---------- review additions: the browser voice is the safety net ---------- */
function fakeBrowser() {
  const log = { spoken: [], handles: [], primed: 0 };
  const b = { isSupported: () => true, prime() { log.primed++; }, speak(text, o) {
    let settle; const done = new Promise(r => { settle = r; }), h = { done, canPause: true, paused: false, cancelled: false, pause() { h.paused = true; }, resume() { h.paused = false; }, cancel() { h.cancelled = true; settle('cancel'); }, finish: r => settle(r) };
    log.spoken.push({ text, o }); log.handles.push(h); return h; } };
  return { b, log };
}

test('fallback: when Viora’s voice is down, the whole reply is read by the browser voice', async () => {
  const { b, log } = fakeBrowser(); const notices = [];
  const { p, audio } = setup(() => fail(503, { code: 'not_configured', error: 'Spoken replies are not set up on the server yet.' }), { browser: b, onFallback: m => notices.push(m) });
  const h = p.speak('First sentence here. Second sentence here.', { rate: 1.1 });
  await until(() => log.spoken.length === 1);
  assert.equal(log.spoken[0].text, 'First sentence here. Second sentence here.');
  assert.equal(log.spoken[0].o.rate, 1.1);
  assert.equal(h.usedFallback(), true);
  assert.equal(notices.length, 1); assert.match(notices[0], /not set up/i); assert.match(notices[0], /this device/i);
  log.handles[0].finish('end');
  assert.equal(await h.done, 'end');
  assert.ok(!audio() || audio().paused, 'no neural audio is playing');
});

test('fallback: a failure part-way continues from the piece that failed, not from the start', async () => {
  const { b, log } = fakeBrowser(); let n = 0;
  const { p, audio, calls } = setup(c => (c.body.text.includes('number 3 ') ? fail(500, { code: 'provider_failed', error: 'Speech is unavailable right now.' }) : ok()), { browser: b });
  const h = p.speak(LONG);
  await until(() => audio()?.plays.length >= 1);
  while (!log.spoken.length) { audio().end(); await tick(4); }
  const said = log.spoken[0].text;
  assert.ok(said.startsWith('This is sentence number 3 '), 'starts at the failed piece: ' + said.slice(0, 40));
  assert.ok(said.includes('number 12 '), 'and carries on to the end');
  assert.ok(!said.includes('number 1 of'), 'what was already heard is not repeated');
  log.handles[0].finish('end'); assert.equal(await h.done, 'end');
});

test('fallback: pause, resume and stop reach the browser voice; stopping never restarts anything', async () => {
  const { b, log } = fakeBrowser();
  const { p } = setup(() => fail(502, { code: 'provider_failed', error: 'x' }), { browser: b });
  const h = p.speak('One sentence to say.');
  await until(() => log.spoken.length === 1);
  h.pause(); assert.equal(log.handles[0].paused, true);
  h.resume(); assert.equal(log.handles[0].paused, false);
  h.cancel(); assert.equal(await h.done, 'cancel'); assert.equal(log.handles[0].cancelled, true);
  assert.equal(log.spoken.length, 1);
});

test('fallback: not used for a sign-in problem, a blocked browser, or when the person stopped it', async () => {
  const { b, log } = fakeBrowser();
  const a = setup(() => fail(401, { error: 'Please sign in again.' }), { browser: b }).p.speak('Hello there friend.');
  assert.equal(await a.done, 'error'); assert.match(a.error(), /sign in/i);
  const orig = FakeAudio.prototype.play; FakeAudio.prototype.play = () => Promise.reject(Object.assign(new Error('b'), { name: 'NotAllowedError' }));
  try { const c = setup(() => ok(), { browser: b }).p.speak('Hello there friend.'); assert.equal(await c.done, 'error'); assert.match(c.error(), /blocked/i); } finally { FakeAudio.prototype.play = orig; }
  const gate = setup(call => new Promise((_, no) => call.signal.addEventListener('abort', () => no(Object.assign(new Error('a'), { name: 'AbortError' })))), { browser: b, requestTimeoutMs: 5000 });
  const d = gate.p.speak('Stopped while waiting.'); await until(() => gate.calls.length >= 1); d.cancel();
  assert.equal(await d.done, 'cancel');
  assert.equal(log.spoken.length, 0, 'the browser voice never started in any of these cases');
});

test('fallback: a browser without speech gives the readable error instead (text stays on screen)', async () => {
  const none = { isSupported: () => false, prime() {}, speak() { throw new Error('no'); } };
  const h = setup(() => fail(503, { code: 'terms_required', error: 'Needs terms.' }), { browser: none }).p.speak('Hello there friend.');
  assert.equal(await h.done, 'error'); assert.equal(h.error(), 'Needs terms.');
  const { b } = fakeBrowser(); b.speak = () => { throw new Error('browser voice crashed'); };
  const h2 = setup(() => fail(503, { code: 'terms_required', error: 'Needs terms.' }), { browser: b }).p.speak('Hello there friend.');
  assert.equal(await h2.done, 'error'); assert.equal(h2.error(), 'Needs terms.', 'the original reason is kept when the fallback fails too');
});

test('fallback notice is shown at most once a minute during an outage', async () => {
  const { b, log } = fakeBrowser(); const notices = [];
  const { p } = setup(() => fail(503, { code: 'not_configured', error: 'Down.' }), { browser: b, onFallback: m => notices.push(m) });
  for (let i = 0; i < 3; i++) { const h = p.speak('Sentence number ' + i + ' to read.'); await until(() => log.spoken.length === i + 1); log.handles[i].finish('end'); await h.done; }
  assert.equal(notices.length, 1);
});
