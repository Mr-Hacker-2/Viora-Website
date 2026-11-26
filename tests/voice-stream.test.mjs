import test from 'node:test';
import assert from 'node:assert/strict';
import { SentenceStreamer, deliveryFor, stablePrefix } from '../assets/x/voice-stream.js';
import { speechText } from '../assets/x/voice-tts.js';
import { NeuralSpeechProvider } from '../assets/x/voice-neural.js';
import { normalizeSettings } from '../assets/x/voice-mode.js';

const feed = (text, step = 7) => { const st = new SentenceStreamer(), out = []; for (let i = step; i < text.length + step; i += step) out.push(...st.push(text.slice(0, i))); out.push(...st.finish(text)); return out; };

test('stablePrefix only returns finished sentences', () => {
  assert.equal(stablePrefix('Hello there. How are'), 'Hello there. ');
  assert.equal(stablePrefix('Pi is 3.14 and more'), '');
  assert.equal(stablePrefix('One\nTwo'), 'One\n');
});

test('streamed pieces equal the non-streamed speech text, nothing repeated or lost', () => {
  const md = '# Plan\n\nHere is the **short** answer. It works well! Do you want more detail?\n\n- first point\n- second point\n\nThat is all, thanks.';
  const streamed = feed(md).join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(streamed, speechText(md).replace(/\s+/g, ' ').trim());
});

test('first sentence is released before the reply is complete', () => {
  const st = new SentenceStreamer();
  assert.deepEqual(st.push('Sure, I can help with that'), []);
  const first = st.push('Sure, I can help with that. Let me explain how it works and why');
  assert.deepEqual(first, ['Sure, I can help with that.']);
});

test('later sentences are gathered so requests are not tiny, and the tail is flushed on finish', () => {
  const st = new SentenceStreamer(); st.push('Hello there, friend. ');
  assert.deepEqual(st.push('Hello there, friend. Yes. Ok. '), []);
  assert.deepEqual(st.finish('Hello there, friend. Yes. Ok. '), ['Yes. Ok.']);
});

test('code fences are announced once and never read out while streaming', () => {
  const md = 'Try this. \n```js\nconst a = 1;\nconst b = 2;\n```\nThat prints it. Done now.';
  const out = feed(md, 5).join(' ');
  assert.match(out, /code block on screen/); assert.doesNotMatch(out, /const a/);
  assert.equal((out.match(/code block/g) || []).length, 1);
});

test('delivery nudges stay within 8% and match context', () => {
  assert.equal(deliveryFor("I'm sorry, that sounds really hard.").mood, 'empathetic');
  assert.equal(deliveryFor('That is amazing news!').mood, 'excited');
  assert.equal(deliveryFor('What would you like to build?').mood, 'curious');
  assert.equal(deliveryFor('The sky is blue.').rate, 1);
  for (const t of ["I'm sorry", 'Wow!', 'Warning: be careful', 'Is it ok?']) { const { rate } = deliveryFor(t, { expressiveness: 1.5 }); assert.ok(rate >= 0.92 && rate <= 1.08); }
  assert.equal(deliveryFor('Wow!', { expressiveness: 0 }).rate, 1);
});

test('settings keep expressiveness in range', () => {
  assert.equal(normalizeSettings({}).expressive, 1);
  assert.equal(normalizeSettings({ expressive: 9 }).expressive, 1.5);
  assert.equal(normalizeSettings({ expressive: 0 }).expressive, 0);
});

test('prefetch fills the cache so the next sentence needs no request; cancelPrefetch aborts', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, blob: async () => ({ size: 10 }) }; };
  const p = new NeuralSpeechProvider({ api: 'x', token: () => 't', fetchImpl, AudioImpl: function () {}, urlApi: { createObjectURL() {} } });
  p.prefetch('Hello there.', { voiceURI: 'hannah' }); await new Promise(r => setTimeout(r, 5));
  assert.equal(calls, 1);
  await p._fetchPiece('Hello there.', 'hannah', new AbortController().signal); assert.equal(calls, 1);
  p.cancelPrefetch(); assert.equal(p.prefetchCtl, null);
  p.prefetch('x'.repeat(300)); assert.equal(calls, 1); // over the per-request limit: ignored
});

test('simulated time to first audio: streaming vs waiting for the whole reply', () => {
  // model: tokens arrive at 45 chars/s, first TTS piece takes 600 ms to arrive; non-streamed waits for the full text.
  const reply = 'Great question. Here is how it works in a nutshell. '.repeat(8), cps = 45, ttsMs = 600;
  const st = new SentenceStreamer(); let firstAt = null;
  for (let i = 1; i <= reply.length; i++) if (st.push(reply.slice(0, i)).length) { firstAt = i / cps * 1000; break; }
  const before = reply.length / cps * 1000 + ttsMs, after = firstAt + ttsMs;
  console.log(`# reply ${reply.length} chars: first audio before=${Math.round(before)}ms after=${Math.round(after)}ms`);
  assert.ok(after < before / 4);
});
