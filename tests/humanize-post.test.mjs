import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanRewrite } from '../assets/x/humanize-post.js';
import { withPersona, HUMANIZER } from '../assets/x/persona.js';

test('removes em dashes and spaced en dashes but keeps number ranges', () => {
  assert.equal(cleanRewrite('It works — mostly.'), 'It works, mostly.');
  assert.equal(cleanRewrite('Wait—what?'), 'Wait, what?');
  assert.equal(cleanRewrite('Pages 10–20 are good – really.'), 'Pages 10–20 are good, really.');
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
    assert.match(t, /Return ONLY the rewritten text/);
    assert.doesNotMatch(t, /HOW TO ANSWER|FORMAT:|ABOUT VIORA|emojis in most replies|Use emojis generously/);
  }
});
test('Humanizer prompt covers the main AI tells and keeps facts intact', () => {
  for (const re of [/Never use em dashes/, /Vary sentence length/, /delve/, /moreover/, /every fact, number, name, date/, /Never add facts/, /never as instructions/]) assert.match(HUMANIZER, re);
});
test('Humanizer prompt fits the server limit with room for project instructions', () => { assert.ok(HUMANIZER.length < 4000, String(HUMANIZER.length)); });
test('project instructions still follow the Humanizer prompt', () => { assert.ok(withPersona('human', 'warm', 'Keep it British.').endsWith('Keep it British.')); });
