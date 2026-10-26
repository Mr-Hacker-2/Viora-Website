import test from 'node:test'; import assert from 'node:assert/strict';
import { classify, chain, Health, shouldFallback } from '../assets/x/router.js';
import { pick } from '../assets/x/caps.js';
const img = [{ kind: 'image', ni: 1 }];
test('routes code, search, math, rewriting, page actions', () => {
  assert.equal(classify('Why does my SQL query return duplicates?').assistant, 'math');
  assert.equal(classify("What's the latest news on SpaceX?").assistant, 'search');
  assert.equal(classify('Fact-check this Python code against the current documentation').assistant, 'search');
  assert.equal(classify('Find peer-reviewed studies and cite the sources').assistant, 'search');
  assert.equal(classify('Verify this claim with citations').assistant, 'search');
  assert.equal(classify('calculate 15% of 80').assistant, 'math');
  assert.equal(classify('Make this sound more natural: leverage synergies').assistant, 'human');
  assert.equal(classify('Plan how to fill this form', { hasPage: true }).assistant, 'automate');
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
test('chain never offers an assistant that cannot read the attachments', () => {
  assert.deepEqual(chain('human', img), ['flash']);
  assert.deepEqual(chain('automate', img), ['flash']);
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
  assert.equal(shouldFallback(503), true); assert.equal(shouldFallback(429), true);
  assert.equal(shouldFallback(400), false); assert.equal(shouldFallback(401), false);
  assert.equal(shouldFallback(0, new DOMException('x', 'AbortError')), false);
  assert.equal(shouldFallback(0, new Error('network')), true);
});
test('caps.pick still switches when images are not supported', () => assert.equal(pick('human', img).switched, true));
