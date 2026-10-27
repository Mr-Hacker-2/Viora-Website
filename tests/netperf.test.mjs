import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalize, matchPreset, trimHistory, describeHttpFailure, splitStreamLines } from '../assets/x/netperf.js';

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

test('HTTP failures explain rate limits, timeouts, server errors, and upload limits', () => {
  assert.match(describeHttpFailure(429), /rate-limited/i);
  assert.match(describeHttpFailure(408), /timed out/i);
  assert.match(describeHttpFailure(503, 'provider unavailable'), /temporarily unavailable.*provider unavailable/i);
  assert.match(describeHttpFailure(413), /upload is too large/i);
  assert.equal(describeHttpFailure(400, 'Invalid request'), 'Invalid request');
});

test('stream line splitting preserves chunk boundaries and flushes a final unterminated event', () => {
  const first = splitStreamLines('data: first\r\ndata: final');
  assert.deepEqual(first, { lines: ['data: first'], rest: 'data: final' });
  assert.deepEqual(splitStreamLines(first.rest, true), { lines: ['data: final'], rest: '' });
});