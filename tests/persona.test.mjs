import test from 'node:test'; import assert from 'node:assert/strict';
import { DEFAULT_LEVEL, personaFor, withPersona, normLevel } from '../assets/x/persona.js';
test('default level is plain without forced personality instructions', () => { assert.equal(DEFAULT_LEVEL, 'off'); assert.equal(personaFor('flash'), ''); assert.match(withPersona('flash'), /Answer the user's actual request/); });
test('off adds nothing', () => assert.equal(personaFor('flash', 'off'), ''));
test('rewriting and unknown assistants stay plain', () => { for (const a of ['human', 'humanize', 'legacy']) assert.equal(personaFor(a, 'vivid'), ''); });
test('code safety rule is always present', () => { for (const l of ['warm', 'vivid']) assert.match(withPersona('math', l), /code in fenced blocks/); });
test('vivid differs from warm', () => assert.notEqual(personaFor('flash', 'vivid'), personaFor('flash', 'warm')));
test('unknown or corrupt saved value falls back to the default', () => { assert.equal(normLevel('nonsense'), 'off'); assert.equal(normLevel(null), 'off'); assert.equal(normLevel(undefined), 'off'); });
test('project instructions are kept after the persona', () => { const t = withPersona('flash', 'warm', 'Answer in French.'); assert.ok(t.endsWith('Answer in French.')); assert.ok(withPersona('human', 'warm', 'X').endsWith('X')); });
