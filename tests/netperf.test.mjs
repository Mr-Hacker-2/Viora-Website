import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalize, matchPreset, trimHistory, summarizeHistory, describeHttpFailure, splitStreamLines, isStreamTerminal, streamFinalizationError } from '../assets/x/netperf.js';

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

test('default history retains the latest twelve messages across assistant switches', () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: String(index)
  }));
  assert.equal(DEFAULTS.history, 12);
  assert.deepEqual(trimHistory(messages), messages);
  assert.deepEqual(trimHistory([...messages, { role: 'assistant', content: '12' }, { role: 'user', content: '13' }]), [
    { role: 'user', content: '2' }, ...messages.slice(3), { role: 'assistant', content: '12' }, { role: 'user', content: '13' }
  ]);
});

test('summarizeHistory preserves older conversation turns in a bounded extract', () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: 'turn-' + index }));
  const summary = summarizeHistory(messages, 4, 1000);
  assert.match(summary, /User: turn-0/);
  assert.match(summary, /Viora: turn-7/);
  assert.ok(summary.length <= 1000);
  assert.equal(summarizeHistory(messages, 0), '');
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

test('stream completion requires the terminal marker and rejects malformed or incomplete events', () => {
  assert.equal(isStreamTerminal({ choices: [{ finish_reason: 'stop' }] }), true);
  assert.equal(isStreamTerminal({ choices: [{ delta: { content: 'still writing' }, finish_reason: null }] }), false);
  assert.equal(streamFinalizationError({ terminal: true }), '');
  assert.match(streamFinalizationError({ terminal: false }), /closed before Viora confirmed/i);
  assert.match(streamFinalizationError({ terminal: true, malformed: true }), /invalid data/i);
  assert.equal(streamFinalizationError({ terminal: false, incomplete: 'Provider stream interrupted.' }), 'Provider stream interrupted.');
});

import { streamFinishReason, isTruncatedFinish } from '../assets/x/netperf.js';
test('a length finish is reported as truncated, a normal stop is not', () => {
  assert.equal(streamFinishReason({ choices: [{ delta: { content: 'x' }, finish_reason: null }] }), '');
  assert.equal(streamFinishReason({ choices: [{ finish_reason: 'length' }] }), 'length');
  assert.equal(isTruncatedFinish('length'), true);
  assert.equal(isTruncatedFinish('MAX_TOKENS'), true);
  assert.equal(isTruncatedFinish('stop'), false);
  assert.equal(isTruncatedFinish(''), false);
});
