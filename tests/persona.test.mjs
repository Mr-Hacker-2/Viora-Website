import test from 'node:test'; import assert from 'node:assert/strict';
import { DEFAULT_LEVEL, personaFor, withPersona, normLevel } from '../assets/x/persona.js';
test('default level is warm and asks for emojis', () => { assert.equal(DEFAULT_LEVEL, 'warm'); assert.match(personaFor('flash'), /emojis/i); assert.match(withPersona('flash'), /Answer the user's actual request/); });
test('off adds nothing', () => assert.equal(personaFor('flash', 'off'), ''));
test('rewriting and unknown assistants stay plain', () => { for (const a of ['human', 'humanize', 'legacy']) assert.equal(personaFor(a, 'vivid'), ''); });
test('code safety rule is always present', () => { for (const l of ['warm', 'vivid']) assert.match(withPersona('math', l), /code in fenced blocks/); });
test('vivid differs from warm', () => assert.notEqual(personaFor('flash', 'vivid'), personaFor('flash', 'warm')));
test('emoji levels keep emojis out of code and away from distress', () => { for (const l of ['warm', 'vivid']) { assert.match(personaFor('flash', l), /code blocks/); assert.match(personaFor('flash', l), /distress/); } });
test('no prompt text still says emojis are optional or forbidden', () => { assert.doesNotMatch(withPersona('flash', 'warm'), /Emojis are optional|do not force[^.]*emojis/i); });
test('unknown or corrupt saved value falls back to the default', () => { assert.equal(normLevel('nonsense'), 'warm'); assert.equal(normLevel(null), 'warm'); assert.equal(normLevel(undefined), 'warm'); });
test('project instructions are kept after the persona', () => { const t = withPersona('flash', 'warm', 'Answer in French.'); assert.ok(t.endsWith('Answer in French.')); assert.ok(withPersona('human', 'warm', 'X').endsWith('X')); });
test('every chat assistant knows Abdullah Lababidi created Viora', () => { for (const a of ['flash', 'search', 'math']) assert.match(withPersona(a, 'warm'), /created by Abdullah Lababidi/); });
test('prompts stay well under the server 8000-character cut-off, leaving room for project instructions', () => { for (const a of ['flash', 'search', 'math', 'human']) for (const l of ['off', 'warm', 'vivid']) assert.ok(withPersona(a, l, '').length < 6000, a + '/' + l); });
test('base prompt is organised into labelled sections and describes the renderable formatting', () => { const t = withPersona('flash', 'warm'); for (const h of ['HOW TO ANSWER:', 'ACCURACY:', 'CODE:', 'FORMAT:', 'ABOUT VIORA:']) assert.ok(t.includes(h), h); assert.match(t, /\$\$\.\.\.\$\$/); });
test('math assistant is told to write LaTeX and bold the final result', () => { assert.match(withPersona('math', 'warm'), /LaTeX/); assert.match(withPersona('math', 'warm'), /final result on its own line in bold/); });

import { userProfile } from '../assets/x/persona.js';
test('every chat assistant is told the signed-in user\'s name and profile', () => {
  const who = userProfile({ name: 'Abdullah', about: 'I am in 10th grade and love robotics.', facts: ['I prefer short answers', 'I prefer short answers', 'I use Python'] });
  assert.match(who, /^ABOUT THE USER: You are talking with Abdullah/); assert.match(who, /10th grade/); assert.match(who, /I use Python/);
  assert.equal((who.match(/I prefer short answers/g) || []).length, 1);
  for (const a of ['flash', 'search', 'math', 'auto']) assert.ok(withPersona(a, 'warm', '', who).includes(who), a);
});
test('the Humanizer is not given the user profile', () => { assert.doesNotMatch(withPersona('human', 'warm', '', userProfile({ name: 'Sam' })), /ABOUT THE USER/); });
test('profile comes before project instructions, and nothing is added when nothing is known', () => {
  const t = withPersona('flash', 'warm', 'Answer in French.', userProfile({ name: 'Sam' }));
  assert.ok(t.indexOf('ABOUT THE USER') < t.indexOf('Answer in French.')); assert.ok(t.endsWith('Answer in French.'));
  assert.equal(userProfile({}), ''); assert.equal(userProfile(), ''); assert.equal(withPersona('flash', 'warm', '', ''), withPersona('flash', 'warm', ''));
});
test('profile text is cleaned and capped so the prompt stays under the server cut-off', () => {
  const who = userProfile({ name: 'A<b>\nB'.repeat(50), about: 'x'.repeat(5000), facts: Array(50).fill(0).map((_, i) => 'fact ' + i + ' ' + 'y'.repeat(400)) });
  assert.doesNotMatch(who, /[<>\n]/);
  for (const a of ['flash', 'search', 'math']) assert.ok(withPersona(a, 'vivid', '', who).length < 8000, a);
});
test('without a name the profile still says the user is signed in', () => { assert.match(userProfile({ about: 'I like chess' }), /has not shared their name/); });
import { SEARCH_IF_UNSURE } from '../assets/x/persona.js';
test('assistants can ask for a web check instead of guessing, and Pro Search pieces clues together', () => {
  assert.match(SEARCH_IF_UNSURE, /\[\[SEARCH: a short web search query\]\] and nothing else/); assert.match(SEARCH_IF_UNSURE, /do not guess/);
  assert.match(SEARCH_IF_UNSURE, /greetings, casual chat/);
  assert.match(withPersona('search', 'warm', ''), /look for clues/); assert.match(withPersona('flash', 'warm', ''), /piece the answer together from the clues/);
  const who = userProfile({ name: 'A'.repeat(60), about: 'x'.repeat(600), facts: Array(8).fill('y'.repeat(110)) });
  for (const a of ['flash', 'math']) assert.ok((withPersona(a, 'vivid', '', who) + '\n\n' + SEARCH_IF_UNSURE).length < 8000, a);
});
