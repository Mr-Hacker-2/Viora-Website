import test from 'node:test'; import assert from 'node:assert/strict';
import { DEFAULT_LEVEL, personaFor, withPersona, normLevel } from '../assets/x/persona.js';
test('default level is expressive and keeps emotional responses natural', () => { assert.equal(DEFAULT_LEVEL, 'expressive'); assert.match(personaFor('flash'), /emojis/i); assert.match(personaFor('flash'), /without guessing emotions from neutral questions/i); assert.match(withPersona('flash'), /Answer the user's actual request/); });
test('Flash idea suggestions respect explicit user constraints', () => {
  const prompt = withPersona('flash');
  assert.match(prompt, /unless they request a different number or format/);
  assert.match(prompt, /recommendation only when it fits their tone and needs/);
  assert.match(prompt, /invite them to choose only when a follow-up would help/);
});
test('off adds nothing', () => assert.equal(personaFor('flash', 'off'), ''));
test('rewriting and unknown assistants stay plain', () => { for (const a of ['human', 'humanize', 'legacy']) assert.equal(personaFor(a, 'vivid'), ''); });
test('code safety rule is always present', () => { for (const l of ['warm', 'vivid']) assert.match(withPersona('math', l), /code in fenced blocks/); });
test('expressive and very expressive levels differ from warm and each other', () => { assert.notEqual(personaFor('flash', 'expressive'), personaFor('flash', 'warm')); assert.notEqual(personaFor('flash', 'very'), personaFor('flash', 'expressive')); });
test('emoji levels keep emojis out of code and away from distress', () => { for (const l of ['warm', 'expressive', 'very']) { assert.match(personaFor('flash', l), /code/); assert.match(personaFor('flash', l), /serious medical, legal, or safety topics/); } });
test('emoji frequency follows the selected level without a fixed quota', () => { assert.match(withPersona('flash', 'warm'), /occasional relevant emoji/i); assert.match(withPersona('flash', 'expressive'), /frequently/i); assert.match(withPersona('flash', 'very'), /generously/i); for (const level of ['warm','expressive','very']) assert.doesNotMatch(withPersona('flash', level), /one or two emojis|one or two per reply/i); });
test('unknown or corrupt saved value falls back to the default', () => { assert.equal(normLevel('nonsense'), 'expressive'); assert.equal(normLevel(null), 'expressive'); assert.equal(normLevel(undefined), 'expressive'); assert.equal(normLevel('off'), 'plain'); assert.equal(normLevel('vivid'), 'expressive'); });
test('project instructions are kept after the persona', () => { const t = withPersona('flash', 'warm', 'Answer in French.'); assert.ok(t.endsWith('Answer in French.')); assert.ok(withPersona('human', 'warm', 'X').endsWith('X')); });
test('every chat assistant knows Abdullah Lababidi created Viora', () => { for (const a of ['flash', 'search', 'math']) assert.match(withPersona(a, 'warm'), /created by Abdullah Lababidi/); });
test('prompts stay well under the server 8000-character cut-off, leaving room for project instructions', () => { for (const a of ['flash', 'search', 'math', 'human']) for (const l of ['plain', 'warm', 'expressive', 'very']) assert.ok(withPersona(a, l, '').length < 6000, a + '/' + l); });
test('base prompt is organised into labelled sections and describes the renderable formatting', () => { const t = withPersona('flash', 'warm'); for (const h of ['HOW TO ANSWER:', 'ACCURACY:', 'CODE:', 'FORMAT:', 'ABOUT VIORA:']) assert.ok(t.includes(h), h); assert.match(t, /\$\$\.\.\.\$\$/); });
test('math assistant is told to write LaTeX and bold the final result', () => { assert.match(withPersona('math', 'warm'), /LaTeX/); assert.match(withPersona('math', 'warm'), /final result on its own line in bold/); });
test('Pro Search profiles separate incident dates, evidence confidence, hypotheses, and defensive analysis', () => {
  const prompt = withPersona('search', 'warm');
  for (const pattern of [/discovery and publication dates/i, /established facts from attributed assessments and hypotheses/i, /qualify confidence/i, /defensive context/i]) assert.match(prompt, pattern);
  assert.match(prompt, /keep ordinary answers concise/i);
});

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
  for (const a of ['flash', 'search', 'math']) assert.ok(withPersona(a, 'expressive', '', who).length < 8000, a);
});
test('without a name the profile still says the user is signed in', () => { assert.match(userProfile({ about: 'I like chess' }), /has not shared their name/); });

test('chat assistants get the structured briefing style; the Humanizer does not', () => {
  for (const a of ['flash', 'search', 'math', 'auto']) assert.match(withPersona(a, 'warm'), /REPLY STYLE:/);
  assert.doesNotMatch(withPersona('human', 'warm'), /REPLY STYLE:/);
});
