import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');

test('sign-in only opens the sign-up questions when the server sent some, and never blocks on them', () => {
  const at = src.indexOf('async function finishLogin');
  assert.ok(at > 0, 'finishLogin should exist');
  const body = src.slice(at, src.indexOf("location.replace('app.html');", src.indexOf('VioraOnboarding', at)) + 40);
  assert.match(body, /Array\.isArray\(p\.questions\)\s*&&\s*p\.questions\.length/, 'must check that questions is a non-empty array');
  assert.match(body, /try\s*\{[^}]*VioraOnboarding\.ask[\s\S]*?\}\s*catch/, 'a failure in the questions popup must not stop sign-in');
});
