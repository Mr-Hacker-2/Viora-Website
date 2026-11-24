import test from 'node:test'; import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectContext, extraGuides, TONES, LENGTHS } from '../assets/x/humanize-prompt.js';
import { HUMANIZER } from '../assets/x/persona.js';

test('detects the kind of text', () => {
  assert.equal(detectContext('Hi Sam,\n\nPlease find attached the report. Best regards, Lee').kind, 'email');
  assert.equal(detectContext('In this paper we test the hypothesis (Smith et al., 2019) using a mixed methodology.').kind, 'academic');
  assert.equal(detectContext('Just launched our app!! #startup @friends').kind, 'social');
  assert.equal(detectContext('Our Q3 roadmap lists three deliverables for stakeholders and a revised invoice process for the finance team to review next week.').kind, 'professional');
  assert.equal(detectContext('hey are you free later?').kind, 'chat');
  assert.equal(detectContext('').kind, 'general');
});
test('extra guides reflect every control and never allow new facts', () => {
  const g = extraGuides({ text: 'Dear Sam, thanks. Regards', tone: 'formal', length: 'longer', preserve: true, grammar: false, simplify: true });
  assert.match(g, /email/); assert.match(g, /formal/); assert.match(g, /no new facts/); assert.match(g, /Preserve the original meaning strictly/);
  assert.match(g, /Leave grammar/); assert.match(g, /Simplify/);
  assert.notEqual(extraGuides({ text: 'x', tone: 'friendly' }), extraGuides({ text: 'x', tone: 'formal' }));
  assert.ok(Object.keys(LENGTHS).length === 3 && Object.keys(TONES).length >= 5);
});
test('panel exposes the new controls, they persist and feed the prompt', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  for (const id of ['hz-tone', 'hz-length', 'hz-preserve', 'hz-grammar', 'hz-simplify', 'hz-reset', 'hz-tabs']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /value="concise"/); assert.match(html, /concise: 'Remove unnecessary words/); assert.ok(HUMANIZER.includes('concise ='));
  assert.match(html, /\+ voiceGuide \+ extras \+/); assert.match(html, /\(original ' \+ sourceWords/);
});
