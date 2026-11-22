import test from 'node:test';
import assert from 'node:assert/strict';
import { pickMimeType, micSupport, explainMicError, SpeechGate, Recorder, transcribeAudio, mergeTranscript, VoiceInputError } from '../assets/x/voice-input.js';

/* ---------- capability and error wording ---------- */
test('pickMimeType: Chrome/Firefox get webm-opus, Safari gets mp4, nothing supported gives ""', () => {
  const MR = (ok) => ({ isTypeSupported: t => ok.includes(t) });
  assert.equal(pickMimeType(MR(['audio/webm;codecs=opus', 'audio/webm'])), 'audio/webm;codecs=opus');
  assert.equal(pickMimeType(MR(['audio/mp4'])), 'audio/mp4');
  assert.equal(pickMimeType(MR(['audio/ogg;codecs=opus'])), 'audio/ogg;codecs=opus');
  assert.equal(pickMimeType(MR([])), '');
  assert.equal(pickMimeType(undefined), '');
  assert.equal(pickMimeType({}), '');
});

test('micSupport explains why recording is impossible', () => {
  assert.equal(micSupport({ navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder: function () {}, isSecureContext: true }).ok, true);
  assert.equal(micSupport({ navigator: {}, MediaRecorder: function () {} }).code, 'unsupported');
  assert.equal(micSupport({ navigator: { mediaDevices: { getUserMedia() {} } } }).code, 'unsupported');
  const insecure = micSupport({ navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder: function () {}, isSecureContext: false });
  assert.equal(insecure.code, 'insecure'); assert.match(insecure.message, /https/);
});

test('microphone errors become clear, specific messages', () => {
  const code = n => explainMicError({ name: n }).code;
  assert.equal(code('NotAllowedError'), 'denied'); assert.equal(code('SecurityError'), 'denied');
  assert.equal(code('NotFoundError'), 'no_device'); assert.equal(code('OverconstrainedError'), 'no_device');
  assert.equal(code('NotReadableError'), 'busy'); assert.equal(code('SomethingElse'), 'mic_error');
  assert.match(explainMicError({ name: 'NotAllowedError' }).message, /blocked.*browser settings/i);
  assert.ok(explainMicError(null) instanceof VoiceInputError);
});

/* ---------- speech gate ---------- */
const run = (gate, trace, step = 50) => { let last; trace.forEach(([rms, ms]) => { for (let t = 0; t < ms; t += step) { gate._t = (gate._t || 0) + step; last = gate.push(rms, gate._t); } }); return last; };

test('auto-stop: speech followed by a pause ends the recording once silence has lasted long enough', () => {
  const g = new SpeechGate({ autoStop: true, silenceMs: 1400 });
  assert.equal(run(g, [[0.004, 400], [0.15, 1500], [0.004, 1000]]).event, null, 'a short pause does not end it');
  assert.equal(g.heardSpeech, true);
  assert.equal(run(g, [[0.004, 600]]).event, 'silence');
});

test('auto-stop: a brief pause inside a sentence resets the silence timer', () => {
  const g = new SpeechGate({ autoStop: true, silenceMs: 1400 });
  run(g, [[0.004, 400], [0.15, 800], [0.004, 1000], [0.15, 600], [0.004, 1000]]);
  assert.equal(g.event, null);
});

test('auto-stop: nobody speaks at all, so it gives up with "no_speech"', () => {
  const g = new SpeechGate({ autoStop: true, noSpeechMs: 8000 });
  assert.equal(run(g, [[0.004, 7000]]).event, null);
  assert.equal(run(g, [[0.004, 1500]]).event, 'no_speech');
  assert.equal(g.heardSpeech, false);
});

test('a click or cough shorter than the minimum is not speech', () => {
  const g = new SpeechGate({ autoStop: true });
  run(g, [[0.004, 400], [0.3, 60], [0.004, 3000]]);
  assert.equal(g.heardSpeech, false);
});

test('a noisy room raises the bar: steady background noise is not mistaken for speech', () => {
  const g = new SpeechGate({ autoStop: true, noSpeechMs: 5000 });
  run(g, [[0.03, 6000]]);                      // constant fan noise, no talking
  assert.equal(g.heardSpeech, false); assert.equal(g.event, 'no_speech');
  const h = new SpeechGate({ autoStop: true });
  run(h, [[0.03, 400], [0.25, 800]]);          // someone clearly talks over the same noise
  assert.equal(h.heardSpeech, true);
});

test('talking the instant record is tapped is still heard (speech during the calibration window)', () => {
  const g = new SpeechGate({ autoStop: true });
  run(g, [[0.12, 1500], [0.004, 1600]]);
  assert.equal(g.heardSpeech, true); assert.equal(g.event, 'silence');
});

test('without autoStop (dictation) the gate only observes: no events, but it still reports speech and peak', () => {
  const g = new SpeechGate({ autoStop: false });
  run(g, [[0.004, 400], [0.2, 600], [0.004, 20000]]);
  assert.equal(g.event, null); assert.equal(g.heardSpeech, true); assert.ok(g.peak >= 0.2);
  const silent = new SpeechGate({ autoStop: false }); run(silent, [[0.002, 5000]]);
  assert.equal(silent.heardSpeech, false); assert.ok(silent.peak < 0.01);
});

/* ---------- recorder against fake browser APIs ---------- */
function fakeEnv({ denyWith = null, mimeOk = ['audio/webm;codecs=opus'], level = 0.2 } = {}) {
  const log = { stopped: 0, ctxClosed: 0, getUserMediaCalls: 0, recorders: [] };
  class Track { constructor() { this.onended = null; } stop() { log.stopped++; } }
  class MR {
    static isTypeSupported(t) { return mimeOk.includes(t); }
    constructor(stream, opts = {}) { this.stream = stream; this.opts = opts; this.mimeType = opts.mimeType || 'audio/webm'; this.state = 'inactive'; log.recorders.push(this); }
    start() { this.state = 'recording'; setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(2000)], { type: this.mimeType }) }), 5); }
    stop() { this.state = 'inactive'; setTimeout(() => this.onstop?.(), 5); }
  }
  class AC {
    constructor() { this.state = 'running'; }
    resume() { return Promise.resolve(); } close() { log.ctxClosed++; }
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() { return { fftSize: 1024, getFloatTimeDomainData(buf) { buf.fill(level); } }; }
  }
  const env = {
    isSecureContext: true, MediaRecorder: MR, AudioContext: AC,
    navigator: { mediaDevices: { getUserMedia: async (c) => { log.getUserMediaCalls++; log.constraints = c; if (denyWith) { const e = new Error('x'); e.name = denyWith; throw e; } const t = new Track(); log.track = t; return { getTracks: () => [t], getAudioTracks: () => [t] }; } } }
  };
  return { env, log };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

test('recording returns audio, reports loudness, and releases the microphone afterwards', async () => {
  const { env, log } = fakeEnv(); const levels = [];
  const r = new Recorder({ onLevel: l => levels.push(l) }, env);
  await r.start();
  assert.equal(log.constraints.audio.echoCancellation, true); assert.equal(log.constraints.audio.channelCount, 1);
  assert.equal(log.recorders[0].opts.mimeType, 'audio/webm;codecs=opus'); assert.equal(log.recorders[0].opts.audioBitsPerSecond, 32000);
  await wait(500);
  const out = await r.stop();
  assert.ok(out.blob.size >= 2000); assert.equal(out.blob.type, 'audio/webm'); assert.equal(out.heardSpeech, true); assert.ok(out.durationMs >= 400);
  assert.ok(levels.length > 3 && levels.every(l => l >= 0 && l <= 1));
  assert.equal(log.stopped, 1, 'microphone track stopped'); assert.equal(log.ctxClosed, 1);
  assert.equal(r.state, 'idle');
});

test('a silent recording is reported as heardSpeech=false so it is never uploaded', async () => {
  const { env } = fakeEnv({ level: 0.002 }); const r = new Recorder({}, env);
  await r.start(); await wait(600);
  const out = await r.stop(); assert.equal(out.heardSpeech, false);
});

test('Safari-style audio/mp4 recordings use a higher bitrate setting', async () => {
  const { env, log } = fakeEnv({ mimeOk: ['audio/mp4'] }); const r = new Recorder({}, env);
  await r.start(); assert.equal(log.recorders[0].opts.mimeType, 'audio/mp4'); assert.equal(log.recorders[0].opts.audioBitsPerSecond, 64000);
  r.cancel();
});

test('permission denied, no device, and busy microphone all produce friendly errors and leave the recorder reusable', async () => {
  for (const [name, code] of [['NotAllowedError', 'denied'], ['NotFoundError', 'no_device'], ['NotReadableError', 'busy']]) {
    const { env, log } = fakeEnv({ denyWith: name }); const r = new Recorder({}, env);
    await assert.rejects(r.start(), e => e instanceof VoiceInputError && e.code === code, name);
    assert.equal(r.state, 'idle'); assert.equal(log.ctxClosed, 1, 'no audio context left open');
  }
});

test('cancel discards the audio, frees the microphone immediately, and nothing is returned', async () => {
  const { env, log } = fakeEnv(); const r = new Recorder({}, env);
  await r.start(); await wait(100);
  r.cancel();
  assert.equal(log.stopped, 1); assert.equal(r.state, 'idle'); assert.equal(await r.stop(), null);
});

test('cancel while the permission prompt is still open does not leave the microphone on', async () => {
  const { env, log } = fakeEnv(); const r = new Recorder({}, env);
  const p = r.start(); r.cancel();
  await assert.rejects(p, e => e.code === 'cancelled'); assert.equal(log.stopped, 1);
});

test('starting twice is refused; the recorder can be used again after finishing (consecutive recordings)', async () => {
  const { env, log } = fakeEnv(); const r = new Recorder({}, env);
  await r.start(); await assert.rejects(r.start(), e => e.code === 'busy');
  await wait(60); await r.stop();
  for (let i = 0; i < 3; i++) { await r.start(); await wait(60); const out = await r.stop(); assert.ok(out.blob.size > 0, 'round ' + i); }
  assert.equal(log.getUserMediaCalls, 4); assert.equal(log.stopped, 4);
});

test('Voice Mode recording ends by itself when the speaker stops, and when the maximum length is reached', async () => {
  const { env } = fakeEnv({ level: 0.002 }); const reasons = [];
  const r = new Recorder({ autoStop: true, noSpeechMs: 300, onAutoStop: x => reasons.push(x) }, env);
  await r.start(); await wait(900); r.cancel();
  assert.ok(reasons.includes('no_speech'));
  const { env: env2 } = fakeEnv({ level: 0.2 }); const reasons2 = [];
  const r2 = new Recorder({ maxSeconds: 1, onAutoStop: x => reasons2.push(x) }, env2);
  await r2.start(); await wait(1300); r2.cancel();
  assert.ok(reasons2.includes('max_length'));
});

test('losing the microphone mid-recording (unplugged) cancels and reports it', async () => {
  const { env, log } = fakeEnv(); const errors = [];
  const r = new Recorder({ onError: e => errors.push(e.code) }, env);
  await r.start(); log.track.onended(); await wait(10);
  assert.deepEqual(errors, ['mic_lost']); assert.equal(r.state, 'idle');
});

/* ---------- upload ---------- */
const blob = (n = 4000, type = 'audio/webm') => new Blob([new Uint8Array(n)], { type });
const res = (status, body) => new Response(JSON.stringify(body), { status });

test('upload sends the raw audio to /api/transcribe with the session token and returns the text', async () => {
  let seen;
  const out = await transcribeAudio(blob(), { api: 'https://api.test', token: 'tok123', language: 'EN', fetchImpl: async (url, init) => { seen = { url, init }; return res(200, { text: '  hello world ', provider: 'groq' }); } });
  assert.equal(seen.url, 'https://api.test/api/transcribe?language=en');
  assert.equal(seen.init.headers.Authorization, 'Bearer tok123'); assert.equal(seen.init.headers['Content-Type'], 'audio/webm');
  assert.equal(seen.init.method, 'POST'); assert.equal(seen.init.body.size, 4000);
  assert.deepEqual(out, { text: 'hello world', empty: false, provider: 'groq' });
});

test('bad language hints are not put in the URL', async () => {
  let url; await transcribeAudio(blob(), { api: 'https://a', token: 't', language: 'en-US&x=1', fetchImpl: async (u) => { url = u; return res(200, { text: 'x' }); } });
  assert.equal(url, 'https://a/api/transcribe');
});

test('an empty transcript is reported as empty, not as an error', async () => {
  const out = await transcribeAudio(blob(), { api: 'https://a', token: 't', fetchImpl: async () => res(200, { text: '', empty: true }) });
  assert.equal(out.empty, true); assert.equal(out.text, '');
});

test('tiny recordings never leave the browser', async () => {
  let called = false;
  await assert.rejects(transcribeAudio(blob(100), { api: 'https://a', token: 't', fetchImpl: async () => { called = true; return res(200, {}); } }), e => e.code === 'too_short');
  await assert.rejects(transcribeAudio(null, { api: 'https://a', token: 't' }), e => e.code === 'too_short');
  assert.equal(called, false);
});

test('server errors turn into specific, user-facing messages', async () => {
  const fail = async (status, body) => { try { await transcribeAudio(blob(), { api: 'https://a', token: 't', fetchImpl: async () => res(status, body) }); } catch (e) { return e; } };
  const cases = [[413, { code: 'too_large' }, /too long/i], [415, { code: 'unsupported_format' }, /format/i], [502, { code: 'provider_failed' }, /unavailable.*type/i], [503, { code: 'not_configured' }, /not set up/i], [504, { code: 'timeout' }, /too long/i], [429, { code: 'rate_limited' }, /wait/i], [503, { code: 'busy' }, /busy/i], [400, { code: 'too_short' }, /did not hear/i]];
  for (const [status, body, re] of cases) { const e = await fail(status, body); assert.equal(e.code, body.code); assert.match(e.message, re); assert.equal(e.status, status); }
  assert.equal((await fail(401, { error: 'x' })).code, 'auth');
  assert.match((await fail(500, { error: 'Custom server text' })).message, /Custom server text/);
  assert.equal((await fail(200, { nope: true })).code, 'failed');
});

test('network failures, timeouts and user cancellation are told apart', async () => {
  const kind = async (fetchImpl, signal, timeoutMs) => { try { await transcribeAudio(blob(), { api: 'https://a', token: 't', fetchImpl, signal, timeoutMs }); } catch (e) { return e.code; } };
  assert.equal(await kind(async () => { throw new TypeError('Failed to fetch'); }), 'network');
  assert.equal(await kind((u, i) => new Promise((_, rej) => { const hold = setTimeout(() => {}, 3000); i.signal.addEventListener('abort', () => { clearTimeout(hold); rej(i.signal.reason); }); }), undefined, 40), 'timeout');
  const ctl = new AbortController();
  const p = kind((u, i) => new Promise((_, rej) => { i.signal.addEventListener('abort', () => rej(i.signal.reason)); }), ctl.signal, 5000);
  setTimeout(() => ctl.abort(), 20); assert.equal(await p, 'cancelled');
});

/* ---------- putting the words into the message box ---------- */
test('mergeTranscript inserts at the caret without gluing words together', () => {
  assert.deepEqual(mergeTranscript('', 'hello there'), { value: 'hello there', caret: 11 });
  assert.equal(mergeTranscript('Hi', 'there').value, 'Hi there');
  assert.equal(mergeTranscript('Hi ', 'there').value, 'Hi there');
  assert.equal(mergeTranscript('Hello world', 'big', 5, 5).value, 'Hello big world');
  assert.equal(mergeTranscript('Hello old world', 'new', 6, 9).value, 'Hello new world');
  assert.equal(mergeTranscript('keep me', '   ').value, 'keep me');
  assert.equal(mergeTranscript('Hello', ' there ').caret, 11);
});
