import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalize, matchPreset, trimHistory } from '../assets/x/netperf.js';

test('normalize clamps numeric settings and rejects invalid values', () => {
  assert.equal(normalize({ retries: 99 }).retries, 6);
  assert.equal(normalize({ firstByteSec: -10 }).firstByteSec, 0);
  assert.equal(normalize({ stallSec: 'not-a-number' }).stallSec, DEFAULTS.stallSec);
  assert.equal(normalize({ history: 12.6 }).history, 13);
});

test('normalize preserves valid boolean preferences', () => {
  const p = normalize({ keepWarm: false, restoreOnFail: false, saveDraft: true });
  assert.equal(p.keepWarm, false);
  assert.equal(p.restoreOnFail, false);
  assert.equal(p.saveDraft, true);
});

test('trimHistory keeps the newest messages and starts on a user message', () => {
  const messages = [
    { role: 'user', content: 'one' },
    { role: 'assistant', content: 'two' },
    { role: 'user', content: 'three' },
    { role: 'assistant', content: 'four' },
    { role: 'user', content: 'five' }
  ];
  assert.deepEqual(trimHistory(messages, 3), messages.slice(2));
  assert.deepEqual(trimHistory(messages, 2), messages.slice(4));
  assert.equal(trimHistory(messages, 0), messages);
});

test('preset matching recognizes the shipped presets', () => {
  assert.equal(matchPreset(DEFAULTS), 'balanced');
  assert.equal(matchPreset({ ...DEFAULTS, retries: 0 }), '');
});