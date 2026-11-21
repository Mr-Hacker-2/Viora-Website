import test from 'node:test';
import assert from 'node:assert/strict';
import { speechText, chunkSpeech, guessLang, scoreVoice, pickVoice, BrowserSpeechProvider, TTSManager } from '../assets/x/voice-tts.js';

/* ---------- text preparation ---------- */
test('speechText removes markdown noise, citations, emoji and raw links', () => {
  const md = '# Great question 🎉\n\nHere is **bold** and _italic_ and `inline` text [1][2] with a [link](https://example.com/x) and https://www.wikipedia.org/wiki/Cat.\n\n- first item\n- second item\n\n1. one\n2. two';
  const out = speechText(md);
  assert.ok(!/[#*_`\[\]]|🎉|https?:/.test(out), out);
  assert.match(out, /Great question\./);
  assert.match(out, /bold and italic and inline text/);
  assert.match(out, /with a link and a link to wikipedia\.org/);
  assert.match(out, /first item\.\nsecond item\./);
});

test('code blocks and tables are announced once instead of being read aloud', () => {
  const md = 'Try this:\n\n```js\nconst x = 1;\nconsole.log(x);\n```\n\nand also\n\n```py\nprint(1)\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nDone';
  const out = speechText(md);
  assert.ok(!/const x|console|print|\|/.test(out), out);
  assert.equal((out.match(/code block on screen/g) || []).length, 1);
  assert.equal((out.match(/table on screen/g) || []).length, 1);
  assert.match(out, /Done\.$/);
});

test('an unfinished code fence while streaming is also skipped', () => {
  assert.ok(!/secret_code/.test(speechText('Look:\n```js\nsecret_code()')));
});

test('very long answers stop at a sentence and point to the screen', () => {
  const long = Array.from({ length: 400 }, (_, i) => 'This is sentence number ' + i + '.').join(' ');
  const out = speechText(long, { maxChars: 600 });
  assert.ok(out.length < 700); assert.match(out, /The rest is on screen\.$/); assert.match(out, /number \d+\.\nThe rest/);
});

test('empty and non-string input is safe', () => { assert.equal(speechText(''), ''); assert.equal(speechText(null), ''); assert.equal(speechText(undefined), ''); });

test('chunkSpeech keeps every piece short, never empty, and loses no words', () => {
  const text = 'First sentence here. Second one follows! A third? ' + 'word '.repeat(120).trim() + '.\nNew paragraph that stands alone.';
  const chunks = chunkSpeech(text, 120);
  assert.ok(chunks.length > 3);
  for (const c of chunks) { assert.ok(c.length <= 125, c.length + ': ' + c); assert.ok(c.trim().length > 0); }
  const norm = s => s.replace(/\s+/g, ' ').trim();
  assert.equal(norm(chunks.join(' ')), norm(text));
});

test('chunkSpeech drops pieces with nothing to say (only punctuation)', () => { assert.deepEqual(chunkSpeech('...\n!!!\nHello there.'), ['Hello there.']); });

/* ---------- voice choice ---------- */
const V = (name, lang, extra = {}) => ({ voiceURI: name, name, lang, localService: true, default: false, ...extra });
test('guessLang follows the script of the text', () => {
  assert.equal(guessLang('Hello there friend'), 'en-US');
  assert.equal(guessLang('Bonjour', 'fr-FR'), 'fr-FR');
  assert.equal(guessLang('こんにちは、元気ですか'), 'ja');
  assert.equal(guessLang('Привет, как дела?'), 'ru');
  assert.equal(guessLang('你好，今天怎么样'), 'zh');
  assert.equal(guessLang('مرحبا كيف حالك'), 'ar');
  assert.equal(guessLang('12345 !!!'), 'en-US');
});

test('pickVoice prefers natural/neural voices in the right language and avoids novelty voices', () => {
  const voices = [V('Zarvox', 'en-US'), V('Microsoft David', 'en-US'), V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', { localService: false }), V('Google UK English Female', 'en-GB'), V('Amelie', 'fr-CA'), V('Samantha (Enhanced)', 'en-US')];
  assert.match(pickVoice(voices, { lang: 'en-US' }).name, /Aria Online \(Natural\)/);
  assert.equal(pickVoice(voices, { lang: 'fr-FR' }).name, 'Amelie');
  assert.equal(pickVoice(voices, { lang: 'de-DE' }), null, 'no German voice installed: let the browser use its default');
  assert.notEqual(pickVoice([V('Zarvox', 'en-US'), V('Bells', 'en-US'), V('Compact Voice', 'en-US')], { lang: 'en-US' }).name, 'Zarvox');
});

test('a voice the user chose wins, as long as it still exists', () => {
  const voices = [V('A', 'en-US'), V('B', 'en-US')];
  assert.equal(pickVoice(voices, { lang: 'en-US', voiceURI: 'B' }).name, 'B');
  assert.ok(pickVoice(voices, { lang: 'en-US', voiceURI: 'gone' }));
  assert.equal(pickVoice([], { lang: 'en-US' }), null);
  assert.ok(scoreVoice(V('x', 'en-GB'), 'en-US') < scoreVoice(V('x', 'en-US'), 'en-US'), 'exact region beats same language');
});

/* ---------- a stand-in for window.speechSynthesis that behaves like the real one ---------- */
class FakeUtterance { constructor(text) { this.text = text; this.rate = 1; this.volume = 1; } }
function fakeSynth({ voices = [] } = {}) {
  const s = {
    spoken: [], current: null, paused: false, calls: [], _voices: voices,
    getVoices() { return this._voices; },
    speak(u) { this.calls.push('speak'); this.spoken.push(u.text); this.current = u; },
    cancel() { this.calls.push('cancel'); const u = this.current; this.current = null; if (u?.onerror) u.onerror({ error: 'canceled' }); },
    pause() { this.calls.push('pause'); this.paused = true; },
    resume() { this.calls.push('resume'); this.paused = false; },
    finish() { const u = this.current; this.current = null; u?.onend?.(); },       // the engine finished the current sentence
    fail(code) { const u = this.current; this.current = null; u?.onerror?.({ error: code }); },
    addEventListener() {}, removeEventListener() {}
  };
  return s;
}
const mkProvider = (opts, ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/150') => { const synth = fakeSynth(opts); return { synth, provider: new BrowserSpeechProvider(synth, FakeUtterance, ua) }; };
const tick = () => new Promise(r => setImmediate(r));

test('provider walks through chunks in order and ends cleanly', async () => {
  const { synth, provider } = mkProvider();
  const text = 'x'.repeat(150) + '. ' + 'y'.repeat(150) + '. ' + 'z'.repeat(150) + '.';
  const h = provider.speak(text, {});
  assert.equal(synth.spoken.length, 1);
  synth.finish(); assert.equal(synth.spoken.length, 2);
  synth.finish(); assert.equal(synth.spoken.length, 3);
  assert.ok(synth.spoken[0].startsWith('x') && synth.spoken[1].startsWith('y') && synth.spoken[2].startsWith('z'));
  synth.finish();
  assert.equal(await h.done, 'end');
});

test('rate, voice and language are applied to each utterance', () => {
  const voices = [{ voiceURI: 'v1', name: 'Aria Online (Natural)', lang: 'en-US', localService: false, default: false }];
  const { synth, provider } = mkProvider({ voices });
  provider.speak('Hello.', { rate: 1.25, lang: 'en-US' });
  assert.equal(synth.current.rate, 1.25); assert.equal(synth.current.lang, 'en-US'); assert.equal(synth.current.voice.voiceURI, 'v1');
  provider.speak('Again.', { rate: 99 }); assert.equal(synth.current.rate, 2, 'rate is clamped');
});

test('native pause and resume keep the same sentence', async () => {
  const { synth, provider } = mkProvider();
  const h = provider.speak('x'.repeat(150) + '. ' + 'y'.repeat(150) + '.', {});
  assert.equal(h.canPause, true);
  h.pause(); assert.ok(synth.paused); h.resume(); assert.ok(!synth.paused);
  assert.equal(synth.spoken.length, 1, 'resuming does not restart');
  h.cancel(); assert.equal(await h.done, 'cancel');
});

test('on Android, where pause() does not exist, pause stops and resume restarts the current sentence', async () => {
  const { synth, provider } = mkProvider({}, 'Mozilla/5.0 (Linux; Android 14) Chrome/150 Mobile');
  const text = 'x'.repeat(150) + '. ' + 'y'.repeat(150) + '.';
  const h = provider.speak(text, {});
  assert.equal(h.canPause, false);
  synth.finish();                              // now on the second sentence
  assert.equal(synth.spoken.length, 2);
  h.pause();                                   // cancel() fires an error event that must NOT end the speech
  assert.ok(!synth.paused);
  await tick();
  h.resume();
  assert.equal(synth.spoken.length, 3);
  assert.ok(synth.spoken[2].startsWith('y'), 'it repeats the sentence it was in the middle of');
  synth.finish();
  assert.equal(await h.done, 'end');
});

test('cancel stops everything at once and a late engine event cannot revive it', async () => {
  const { synth, provider } = mkProvider();
  const h = provider.speak('x'.repeat(150) + '. ' + 'y'.repeat(150) + '.', {});
  const stale = synth.current;
  h.cancel();
  assert.equal(await h.done, 'cancel');
  stale.onend?.();                             // a straggler event
  assert.equal(synth.spoken.length, 1, 'nothing further is spoken');
});

test('an engine error ends the speech as "error"; interruptions by another utterance count as cancel', async () => {
  const a = mkProvider(); const ha = a.provider.speak('Hello there.', {}); a.synth.fail('synthesis-failed'); assert.equal(await ha.done, 'error');
  const b = mkProvider(); const hb = b.provider.speak('Hello there.', {}); b.synth.fail('interrupted'); assert.equal(await hb.done, 'cancel');
});

test('unsupported browsers report it and do nothing', () => {
  const p = new BrowserSpeechProvider(undefined, undefined);
  assert.equal(p.isSupported(), false); assert.deepEqual(p.voices(), []); assert.doesNotThrow(() => p.prime());
  const m = new TTSManager({ providers: [p] });
  assert.equal(m.supported, false);
});

test('prime() speaks a silent utterance (unlocks automatic playback on iOS)', () => {
  const { synth, provider } = mkProvider(); provider.prime();
  assert.equal(synth.spoken.length, 1); assert.equal(synth.current.volume, 0);
});

/* ---------- the manager: only one voice at a time ---------- */
test('starting a second reply stops the first; the first resolves "cancel" and the state belongs to the second', async () => {
  const { synth, provider } = mkProvider(); const m = new TTSManager({ providers: [provider] });
  const states = []; m.subscribe(s => states.push(s.status + ':' + s.id));
  const first = m.speak('First reply here.', { id: 'a' });
  assert.deepEqual([m.state().status, m.state().id], ['speaking', 'a']);
  const second = m.speak('Second reply here.', { id: 'b' });
  assert.equal(await first, 'cancel');
  assert.deepEqual([m.state().status, m.state().id], ['speaking', 'b'], 'the first reply finishing must not reset the second');
  synth.finish();
  assert.equal(await second, 'end');
  assert.equal(m.state().status, 'idle');
  assert.equal(synth.spoken.filter(t => /reply/.test(t)).length, 2);
});

test('pause, resume and stop move the state correctly', async () => {
  const { synth, provider } = mkProvider(); const m = new TTSManager({ providers: [provider] });
  const p = m.speak('Some words to say.', { id: 'm1' });
  assert.equal(m.pause(), true); assert.equal(m.state().status, 'paused'); assert.ok(synth.paused);
  assert.equal(m.pause(), false, 'pausing twice does nothing');
  assert.equal(m.resume(), true); assert.equal(m.state().status, 'speaking');
  assert.equal(m.toggle(), true); assert.equal(m.state().status, 'paused');
  m.stop(); assert.equal(m.state().status, 'idle'); assert.equal(await p, 'cancel');
  assert.equal(m.resume(), false);
});

test('stop() when nothing is playing is harmless; empty text does not start anything', async () => {
  const { synth, provider } = mkProvider(); const m = new TTSManager({ providers: [provider] });
  assert.doesNotThrow(() => m.stop());
  assert.equal(await m.speak('   ', { id: 'x' }), 'end'); assert.equal(m.state().status, 'idle'); assert.equal(synth.spoken.length, 0);
});

test('a provider that throws or errors leaves the manager idle, not stuck', async () => {
  const boom = { id: 'x', isSupported: () => true, voices: () => [], speak() { throw new Error('nope'); } };
  const m = new TTSManager({ providers: [boom] });
  assert.equal(await m.speak('Hello there.', { id: 'a' }), 'error'); assert.equal(m.state().status, 'idle');
  const { synth, provider } = mkProvider(); const m2 = new TTSManager({ providers: [provider] });
  const p = m2.speak('Hello there.', { id: 'a' }); synth.fail('synthesis-failed');
  assert.equal(await p, 'error'); assert.equal(m2.state().status, 'idle');
});

test('providers are interchangeable: the first supported one is used (neural provider can go first later)', async () => {
  const calls = [];
  const neural = { id: 'neural', isSupported: () => true, voices: () => [], speak(t) { calls.push(t); let ok; const done = new Promise(r => { ok = r; }); setImmediate(() => ok('end')); return { done, canPause: true, pause() {}, resume() {}, cancel() { ok('cancel'); } }; } };
  const { provider } = mkProvider();
  const m = new TTSManager({ providers: [neural, provider] });
  assert.equal(m.provider.id, 'neural');
  assert.equal(await m.speak('Hello there.', { id: 'a' }), 'end'); assert.deepEqual(calls, ['Hello there.']);
  const skip = new TTSManager({ providers: [{ id: 'off', isSupported: () => false }, provider] });
  assert.equal(skip.provider.id, 'browser');
});
