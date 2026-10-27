import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl, cleanSources, auditCitations, cardHtml } from '../assets/x/sources.js';

test('source URL parser rejects unsafe, malformed, and credential-bearing URLs', () => {
  assert.equal(parseUrl('javascript:alert(1)'), null);
  assert.equal(parseUrl('not a url'), null);
  assert.equal(parseUrl('https://user:pass@example.com/path'), null);
  assert.equal(parseUrl('https://example.com/path').hostname, 'example.com');
});

test('cleanSources filters invalid URLs, normalizes links, and removes duplicates', () => {
  const list = cleanSources([
    { title: 'Good', url: 'https://example.com/a' },
    { title: 'Unsafe', url: 'javascript:alert(1)' },
    { title: 'Duplicate', url: 'https://example.com/a' },
    { title: 'Bad', url: '' },
    { title: 'Also good', url: 'http://example.org' }
  ]);
  assert.deepEqual(list.map(s => s.title), ['Good', 'Also good']);
  assert.equal(list[0].url, 'https://example.com/a');
});

test('citation audit catches numbered citations outside the supplied source list', () => {
  const sources = [{ url: 'https://example.com' }];
  assert.deepEqual(auditCitations('Fact [1], unsupported [2].', sources).unresolved, [2]);
  assert.deepEqual(auditCitations('Fact [1].', sources).unresolved, []);
});

test('research-style citation claims with no usable source links are flagged', () => {
  const audit = auditCitations('The study found this [1].', [], true);
  assert.equal(audit.missingResearchSources, true);
  assert.equal(audit.hasIssue, true);
});

test('ordinary answers without citations are not unnecessarily flagged', () => {
  assert.equal(auditCitations('Here is the explanation.', [], true).hasIssue, false);
});

test('source cards distinguish fetched pages from snippets without claiming verification', () => {
  const fetched = cardHtml({ title: 'Fetched', url: 'https://example.com/a', pageFetched: true }, 1);
  const snippetOnly = cardHtml({ title: 'Unavailable', url: 'https://example.org/b', pageFetched: false }, 2);
  assert.match(fetched, /Page retrieved/);
  assert.match(snippetOnly, /Search snippet only/);
  assert.doesNotMatch(fetched + snippetOnly, /Verified claim/);
});
