import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/x/think.js';

const t0 = 1_000_000;

test('steps run in a line: starting one closes the previous and records real timing', () => {
  const tr = T.createTrace(t0);
  T.begin(tr, 'understand', 'Understanding your question', '', {}, t0);
  T.begin(tr, 'connect', 'Connecting to Viora Flash', '', {}, t0 + 400);
  T.begin(tr, 'prepare', 'Preparing your response', '', {}, t0 + 1500);
  assert.deepEqual(tr.steps.map(s => s.st), ['done', 'done', 'active']);
  assert.equal(tr.steps[0].e, 400);
  assert.equal(tr.steps[1].e, 1500);
  assert.equal(T.current(tr).k, 'prepare');
});

test('repeating the active step only refreshes its detail (no duplicate rows)', () => {
  const tr = T.createTrace(t0);
  T.begin(tr, 'connect', 'Connecting to Viora Flash', '', {}, t0);
  T.begin(tr, 'connect', 'Connecting to Viora Flash', 'trying again (2 of 3)…', {}, t0 + 50);
  assert.equal(tr.steps.length, 1);
  assert.equal(tr.steps[0].d, 'trying again (2 of 3)…');
  assert.equal(T.detail(tr, 'connect', 'trying again (3 of 3)…'), true);
  assert.equal(T.detail(tr, 'search', 'ignored'), false, 'only the active step with that key can change');
});

test('end() only closes the step it names', () => {
  const tr = T.createTrace(t0);
  T.begin(tr, 'search', 'Searching the web', '', { tool: 1 }, t0);
  assert.equal(T.end(tr, 'connect', '', t0 + 10), null);
  assert.equal(T.current(tr).k, 'search');
  T.end(tr, 'search', '4 results found', t0 + 900);
  assert.equal(T.current(tr), null);
  assert.equal(tr.steps[0].d, '4 results found');
  assert.equal(tr.steps[0].tool, 1);
});

test('note() records a finished step and carries a server-reported duration', () => {
  const tr = T.createTrace(t0);
  const s = T.note(tr, 'sources', 'Reading sources', 'Read 3 of 4 source pages', { tool: 1, dur: 1234 }, t0 + 2000);
  assert.equal(s.st, 'done');
  assert.equal(s.dm, 1234);
  assert.equal(T.current(tr), null);
});

test('note({keep}) does not end the step that is running', () => {
  const tr = T.createTrace(t0);
  T.begin(tr, 'write', 'Writing the response', '', {}, t0);
  T.note(tr, 'review', 'Checked for completeness and relevance', '', { keep: 1 }, t0 + 3000);
  assert.equal(T.current(tr).k, 'write');
  assert.equal(tr.steps.length, 2);
});

test('finish() closes whatever is running with the outcome and refuses later steps', () => {
  for (const out of ['done', 'stopped', 'failed']) {
    const tr = T.createTrace(t0);
    T.begin(tr, 'connect', 'Connecting to Viora Flash', '', {}, t0);
    T.finish(tr, out, t0 + 5000);
    assert.equal(tr.steps[0].st, out);
    assert.equal(tr.out, out);
    assert.equal(T.current(tr), null, 'nothing may be left active');
    assert.equal(T.begin(tr, 'write', 'Late step', '', {}, t0 + 6000), null);
    assert.equal(tr.steps.length, 1);
    T.finish(tr, 'done', t0 + 9000); /* a second finish changes nothing */
    assert.equal(tr.out, out);
    assert.equal(T.elapsed(tr, t0 + 9999), 5000);
  }
});

test('the record stays small however long a reply runs', () => {
  const tr = T.createTrace(t0);
  for (let i = 0; i < 60; i++) T.begin(tr, 'connect', 'Retrying with Viora Flash ' + i, '', {}, t0 + i);
  assert.ok(tr.steps.length <= 14);
  assert.ok(JSON.stringify(tr).length < 4000);
});

test('durations read naturally', () => {
  assert.equal(T.fmtDur(0), '0.1s');
  assert.equal(T.fmtDur(400), '0.4s');
  assert.equal(T.fmtDur(1234), '1.2s');
  assert.equal(T.fmtDur(59_000), '59.0s');
  assert.equal(T.fmtDur(65_000), '1m 05s');
  assert.equal(T.fmtDur(NaN), '');
});

test('phases: thinking until text arrives, writing while it streams, done once the reply is over', () => {
  assert.equal(T.phaseOf(true, false), 'think');
  assert.equal(T.phaseOf(true, true), 'write');
  assert.equal(T.phaseOf(false, true), 'done');
  assert.equal(T.phaseOf(false, false), 'done');
});

test('markup is escaped and never contains reasoning text, only labels, details and timing', () => {
  const tr = T.createTrace(t0);
  T.begin(tr, 'files', 'Processing files', '<img src=x onerror=alert(1)>.pdf', {}, t0);
  const html = T.thinkHtml(tr, { id: 't3', phase: 'think', open: true, now: t0 + 800 });
  assert.ok(!html.includes('<img'), 'file names must be escaped');
  assert.ok(html.includes('&lt;img'));
  assert.match(html, /id="t3"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="t3-p"/);
  assert.match(html, /Viora is thinking…/);
  assert.match(html, /does not show its private reasoning/);
});

test('collapsed panels are not focusable, and finished replies say how long they took', () => {
  const tr = T.createTrace(t0);
  T.begin(tr, 'connect', 'Connecting to Viora Flash', '', {}, t0);
  T.finish(tr, 'done', t0 + 4200);
  const closed = T.thinkHtml(tr, { id: 't1', phase: 'done', open: false });
  assert.match(closed, /<div class="vt-panel" id="t1-p" inert>/);
  assert.match(closed, /Worked for 4\.2s/);
  const stopped = T.createTrace(t0); T.begin(stopped, 'connect', 'x', '', {}, t0); T.finish(stopped, 'stopped', t0 + 2000);
  assert.match(T.thinkHtml(stopped, { phase: 'done' }), /Stopped after 2\.0s/);
  const failed = T.createTrace(t0); T.begin(failed, 'connect', 'x', '', {}, t0); T.finish(failed, 'failed', t0 + 2000);
  assert.match(T.thinkHtml(failed, { phase: 'done' }), /Stopped by an error after 2\.0s/);
});

test('every label in app.html corresponds to a real event, and nothing is claimed unconditionally', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  /* The search activity step has one shared start helper and is used only for a real web request. */
  assert.match(html, /const beginSearchStep = \(trace, detail\) =>[\s\S]{0,180}T\.begin\(trace, 'search', 'Searching the web'/);
  assert.match(html, /if \(searchAsked\) beginSearchStep\(tr,/);
  assert.match(html, /T\.note\(tr, 'sources', 'Reading sources'/);
  assert.equal((html.match(/'Searching the web'/g) || []).length, 1, 'the search step has exactly one start point');
  assert.equal((html.match(/'Reading sources'/g) || []).length, 1);
  /* The run always ends with finish(), outside the try/catch. */
  assert.match(html, /T\.finish\(tr, outcome\);[\s\S]{0,400}busy = null;/);
});

test('a paint queued during streaming can never put a finished panel back into the live state', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  /* paint() is also run from requestAnimationFrame / setTimeout, which can fire after the reply has ended. */
  assert.match(html, /if \(busy === ctl\) thinkSync\(idx, m, true\)/);
  assert.doesNotMatch(html, /paintBody\(b, m\); thinkSync\(idx, m, true\)/);
});
