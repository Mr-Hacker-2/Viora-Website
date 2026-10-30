import test from 'node:test'; import assert from 'node:assert/strict';
import { classify, shouldSearch, chain, Health, shouldFallback } from '../assets/x/router.js';
import { pick } from '../assets/x/caps.js';
const img = [{ kind: 'image', ni: 1 }];
test('routes code, search, math and rewriting requests', () => {
  assert.equal(classify('for i in range(5): print(i)').assistant, 'math');
  assert.equal(classify('Why does for(i=0;i<5;i--){} never end?').assistant, 'math');
  assert.equal(classify('Why does my SQL query return duplicates?').assistant, 'math');
  assert.equal(classify("What's the latest news on SpaceX?").assistant, 'search');
  assert.equal(classify('Fact-check this Python code against the current documentation').assistant, 'search');
  assert.equal(classify('Find peer-reviewed studies and cite the sources').assistant, 'search');
  assert.equal(classify('Verify this claim with citations').assistant, 'search');
  assert.equal(classify('calculate 15% of 80').assistant, 'math');
  assert.equal(classify('Make this sound more natural: leverage synergies').assistant, 'human');
  assert.equal(classify('Plan how to fill this form', { hasPage: true }).assistant, 'flash');
});
test('does not over-trigger on ordinary words', () => {
  assert.equal(classify('Who was the first president of the USA?').assistant, 'flash');
  assert.equal(classify('Explain the function of mitochondria').assistant, 'flash');
  assert.equal(classify('I made an error in my essay, can you proofread it?').assistant, 'flash');
});
test('file questions stay on the file unless web is requested', () => {
  assert.equal(classify('what is the latest figure in this report', { hasPage: true }).assistant, 'flash');
  assert.equal(classify('look up the latest news about this company', { hasPage: true }).assistant, 'search');
});
test('web search is reserved for research signals or explicit research mode', () => {
  assert.equal(shouldSearch('Explain photosynthesis', { assistant: 'auto' }), false);
  assert.equal(shouldSearch('Hi, how are you?', { assistant: 'flash' }), false);
  assert.equal(shouldSearch('Why does this Python loop never end?', { assistant: 'math' }), false);
  assert.equal(shouldSearch('What happened in tech news today?', { assistant: 'auto' }), true);
  assert.equal(shouldSearch('Find recent studies on sleep', { assistant: 'flash' }), true);
  assert.equal(shouldSearch('Explain photosynthesis', { assistant: 'search' }), true);
  assert.equal(shouldSearch('What is the latest figure in this report?', { assistant: 'flash', hasPage: true }), false);
  assert.equal(shouldSearch('Search outside this report for current figures', { assistant: 'flash', hasPage: true }), true);
  assert.equal(shouldSearch('What is the latest news?', { assistant: 'auto', enabled: false }), false);
  assert.equal(shouldSearch('Research the latest news', { assistant: 'human' }), false);
});
test('Flash has a distinct compatible fallback when its provider fails', () => {
  assert.deepEqual(chain('flash', []), ['flash', 'math']);
  assert.deepEqual(chain('flash', img), ['flash', 'math']);
  const health = new Health({ threshold: 1 }); health.fail('flash');
  assert.deepEqual(chain('flash', [], health), ['math']);
});
test('chain never offers an assistant that cannot read the attachments', () => {
  assert.deepEqual(chain('human', img), ['flash']);
  assert.deepEqual(chain('legacy', img), ['flash']);
  assert.deepEqual(chain('search', img), ['search', 'flash']);
});
test('chain skips unhealthy assistants but never returns empty', () => {
  let t = 0; const h = new Health({ now: () => t });
  for (let i = 0; i < 3; i++) h.fail('search');
  assert.deepEqual(chain('search', [], h), ['flash']);
  t = 61000; assert.deepEqual(chain('search', [], h), ['search', 'flash']);
  for (let i = 0; i < 3; i++) { h.fail('flash'); h.fail('search'); }
  assert.ok(chain('flash', [], h).length >= 1);
});
test('a success closes the breaker', () => { const h = new Health(); h.fail('math'); h.fail('math'); h.ok('math'); h.fail('math'); assert.ok(h.healthy('math')); });
test('fallback only for server trouble, never for user abort or client errors', () => {
  assert.equal(shouldFallback(503), true); assert.equal(shouldFallback(500), true);
  assert.equal(shouldFallback(502), true); assert.equal(shouldFallback(504), true);
  assert.equal(shouldFallback(429), true);
  assert.equal(shouldFallback(408), true); assert.equal(shouldFallback(425), true);
  assert.equal(shouldFallback(400), false); assert.equal(shouldFallback(401), false);
  assert.equal(shouldFallback(0, new DOMException('x', 'AbortError')), false);
  assert.equal(shouldFallback(0, new TypeError('network failed')), true);
  assert.equal(shouldFallback(0, new Error('first-byte timeout')), true);
});
test('caps.pick still switches when images are not supported', () => assert.equal(pick('human', img).switched, true));
import { searchMarker } from '../assets/x/router.js';
test('reads the "not sure, search the web" signal and hides it while it streams', () => {
  assert.deepEqual(searchMarker('[[SEARCH: GTA 6 release date]]'), { state: 'match', query: 'GTA 6 release date' });
  assert.equal(searchMarker('  [[search:who is Jane Doe]] ').state, 'match');
  for (const p of ['[', '[[', '[[SEA', '[[SEARCH', '[[SEARCH: GTA 6 rel']) assert.equal(searchMarker(p).state, 'partial', p);
  for (const n of ['', 'Hello!', '[1] Paris is the capital', '[[Note]] this', 'The answer is 4.']) assert.equal(searchMarker(n).state, null, n);
  assert.equal(searchMarker('[[SEARCH: ' + 'x'.repeat(300)).state, null);
  assert.equal(searchMarker('[[SEARCH: a\nmore text').state, null);
});
test('new fresh-fact patterns route to search', () => {
  for (const t of ['What is the release date of GTA 6?', 'How old is Taylor Swift?', 'What happened to the Titan submarine?']) assert.equal(classify(t).assistant, 'search', t);
  assert.equal(classify('How does photosynthesis work?').assistant, 'flash');
});
