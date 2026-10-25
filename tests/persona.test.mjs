import test from 'node:test'; import assert from 'node:assert/strict';
import { personaFor, withPersona, normLevel } from '../assets/x/persona.js';
test('default level adds emotion and emoji instructions', () => { const t = personaFor('flash'); assert.match(t, /emoji/i); assert.match(t, /warm/i); });
test('off adds nothing', () => assert.equal(personaFor('flash', 'off'), ''));
test('rewriting and automation assistants stay plain', () => { for (const a of ['human', 'humanize', 'automate']) assert.equal(personaFor(a, 'vivid'), ''); });
test('code safety rule is always present', () => { for (const l of ['warm', 'vivid']) assert.match(personaFor('math', l), /code blocks/); });
test('vivid differs from warm', () => assert.notEqual(personaFor('flash', 'vivid'), personaFor('flash', 'warm')));
test('unknown or corrupt saved value falls back to the default', () => { assert.equal(normLevel('nonsense'), 'warm'); assert.equal(normLevel(null), 'warm'); assert.equal(normLevel(undefined), 'warm'); });
test('project instructions are kept after the persona', () => { const t = withPersona('flash', 'warm', 'Answer in French.'); assert.ok(t.endsWith('Answer in French.')); assert.equal(withPersona('human', 'warm', 'X'), 'X'); });
