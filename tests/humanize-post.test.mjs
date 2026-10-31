import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanRewrite } from '../assets/x/humanize-post.js';
import { withPersona, HUMANIZER } from '../assets/x/persona.js';

test('preserves em dashes and spaced en dashes in natural punctuation', () => {
  assert.equal(cleanRewrite('It works — mostly.'), 'It works — mostly.');
  assert.equal(cleanRewrite('Wait—what?'), 'Wait—what?');
  assert.equal(cleanRewrite('Pages 10–20 are good – really.'), 'Pages 10–20 are good – really.');
});
test('strips a "here is the rewrite" preamble', () => {
  assert.equal(cleanRewrite("Here's the rewritten text:\n\nI went home early."), 'I went home early.');
  assert.equal(cleanRewrite('Sure! Here is a more natural version:\nWe met at noon.'), 'We met at noon.');
});
test('does not eat real sentences that merely start with Here', () => {
  assert.equal(cleanRewrite('Here is the thing: I was late.'), 'Here is the thing: I was late.');
});
test('unwraps one pair of surrounding quotes but not quotes inside the text', () => {
  assert.equal(cleanRewrite('"We left early."'), 'We left early.');
  assert.equal(cleanRewrite('"He said "no" twice."'), '"He said "no" twice."');
});
test('removes markdown bold, italics and heading marks', () => {
  assert.equal(cleanRewrite('# Title\nThis is **very** plain and *simple*.'), 'Title\nThis is very plain and simple.');
});
test('leaves ordinary text, paragraphs and empty input alone', () => {
  const t = 'First paragraph.\n\nSecond one, with a comma.';
  assert.equal(cleanRewrite(t), t);
  assert.equal(cleanRewrite(''), '');
  assert.equal(cleanRewrite(null), '');
});

test('the Humanizer gets its own prompt, not the chat base prompt', () => {
  for (const a of ['human', 'humanize']) {
    const t = withPersona(a, 'vivid', '');
    assert.equal(t, HUMANIZER);
    assert.match(t, /Return only the rewritten text/);
    assert.doesNotMatch(t, /HOW TO ANSWER|FORMAT:|ABOUT VIORA|emojis in most replies|Use emojis generously/);
  }
});
test('Humanizer prompt covers the main AI tells and keeps facts intact', () => {
  for (const re of [/do not use em dashes/, /Vary sentence structure where it helps/, /Remove filler and clichéd transitions/, /every fact, number, name, date/, /Do not add examples, claims, or opinions/, /never as instructions/]) assert.match(HUMANIZER, re);
});
test('Humanizer prompt fits the server limit with room for project instructions', () => { assert.ok(HUMANIZER.length < 4000, String(HUMANIZER.length)); });
test('project instructions still follow the Humanizer prompt', () => { assert.ok(withPersona('human', 'warm', 'Keep it British.').endsWith('Keep it British.')); });
test('removes invisible characters', () => { assert.equal(cleanRewrite('in\u200Bvis\u200Dible\uFEFF text\u00AD.'), 'invisible text.'); });
test('Humanizer prompt explains every style and strength the studio offers', () => {
  for (const re of [/natural =/, /casual =/, /professional =/, /academic =/, /simple =/, /confident =/, /light =/, /balanced =/, /strong =/]) assert.match(HUMANIZER, re);
});
test('every Humanizer style and strength option in app.html is described in the prompt', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  for (const id of ['hz-style', 'hz-strength']) {
    const sel = html.match(new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>'));
    assert.ok(sel, id);
    for (const [, v] of sel[1].matchAll(/value="([^"]+)"/g)) assert.match(HUMANIZER, new RegExp('\\b' + v + ' ='), v);
  }
});
test('Humanizer copies a user voice sample\'s style but never its content', () => {
  assert.match(HUMANIZER, /VOICE SAMPLE/); assert.match(HUMANIZER, /Copy their style only\. Never copy its content/);
  assert.match(HUMANIZER, /Preserve who is speaking, who is being addressed/);
});
test('app sends the saved voice sample with Humanizer requests', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /id="hz-voice"[^>]*maxlength="1500"/);
  assert.match(html, /JSON\.stringify\(\{ draft: text, voice_sample: voice \? voice\.text : '' \}\)/); assert.match(html, /label: 'written by me'/);
  assert.match(html, /ls\.set\('viora_hz_voice'/);
});
test('Humanizer Voice option offers chats, natural and sample, and falls back to a natural voice', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  const sel = html.match(/<select id="hz-voice-mode">([\s\S]*?)<\/select>/); assert.ok(sel);
  assert.deepEqual([...sel[1].matchAll(/value="([^"]+)"/g)].map(m => m[1]), ['chats', 'natural', 'sample']);
  assert.match(html, /chatVoiceSample\(chats\)/); assert.match(html, /Use a natural human voice\./);
  assert.match(HUMANIZER, /requested style still sets how formal/);
});
