import test from 'node:test'; import assert from 'node:assert/strict';
import { analyze, signalsHtml } from '../assets/x/humanize-stats.js';
import { decorateLinks } from '../assets/x/sources.js';

const ROBOT = 'It is important to note that effective communication is crucial. Furthermore, teams must leverage robust tools to foster collaboration. Moreover, a comprehensive approach underscores the vital role of trust — and it delves into every nuanced detail.';
const HUMAN = 'Good communication matters. Teams need tools they actually like using, and honestly, trust does most of the work. People talk more when they feel safe. That is it.';

test('analyze counts words, sentences, stock phrases and em dashes', () => {
  const a = analyze(ROBOT);
  assert.equal(a.sentences, 3);
  assert.ok(a.words > 30);
  assert.ok(a.stock >= 7, 'stock phrases: ' + a.stock);
  assert.equal(a.dashes, 1);
  assert.equal(analyze(HUMAN).stock, 0);
});
test('sentence variety is higher for uneven sentences than for uniform ones', () => {
  const uniform = 'We went to the shop today. They sold some fresh bread. Everyone bought a loaf. Then we all went home.';
  const uneven = 'We went. The shop on the corner, the one with the green door that never opens before ten, was shut anyway. Typical. Nobody minded much.';
  assert.ok(analyze(uneven).spread > analyze(uniform).spread);
});
test('analyze handles empty and one-sentence input', () => { assert.deepEqual(analyze(''), { words: 0, sentences: 0, avgLen: 0, spread: 0, stock: 0, dashes: 0 }); assert.equal(analyze('Just one sentence here.').spread, 0); });

test('panel shows measured before/after changes and an honest note', () => {
  const h = signalsHtml(ROBOT, HUMAN);
  assert.match(h, /Sentence variety/); assert.match(h, /AI-style phrases/); assert.match(h, /Em dashes/); assert.match(h, /Length/);
  assert.match(h, /not an AI-detector score/);
  assert.doesNotMatch(h, /\d+\s*%\s*(human|AI)/i, 'must not invent a detector percentage');
});
test('panel is empty when there is nothing to compare', () => { assert.equal(signalsHtml('', 'x'), ''); assert.equal(signalsHtml('x', ''), ''); assert.equal(signalsHtml('Same text here.', 'Same text here.'), ''); });
test('very short texts do not get a made-up variety number', () => { assert.match(signalsHtml('Hello there you.', 'Hi.'), /too short to measure/); });
test('panel output is escaped', () => { assert.doesNotMatch(signalsHtml('<img src=x onerror=1> a. b. c.', 'safe text. here. now.'), /<img/); });

/* decorateLinks: a tiny fake DOM is enough, the function only uses a handful of methods. */
const link = (href, extra = {}) => { const a = { dataset: {}, classList: { c: new Set(), add(x) { this.c.add(x); } }, html: '', title: '', _href: href, getAttribute(n) { return n === 'href' ? this._href : null; }, querySelector: () => (extra.hasIcon ? {} : null), closest: () => (extra.inCard ? {} : null), insertAdjacentHTML(_p, h) { this.html += h; } }; return a; };
const root = links => ({ querySelectorAll: () => links });

test('every ordinary web link gets a small logo, opens safely and gets a title', () => {
  const a = link('https://www.wikipedia.org/wiki/Cat'); decorateLinks(root([a]));
  assert.match(a.html, /class="vfav"/); assert.match(a.html, /width="14"/);
  assert.equal(a.target, '_blank'); assert.match(a.rel, /noopener/); assert.equal(a.title, 'wikipedia.org'); assert.ok(a.classList.c.has('vlink'));
});
test('unsafe, relative and credential links are left alone', () => {
  const bad = [link('javascript:alert(1)'), link('/local/page'), link('mailto:a@b.co'), link('https://user:pw@example.com')];
  decorateLinks(root(bad)); for (const a of bad) { assert.equal(a.html, ''); assert.equal(a.dataset.vl, undefined); }
});
test('links that already have a logo, or live in source cards, are not decorated twice', () => {
  const cited = link('https://example.com'); cited.dataset.vc = '1';
  const had = link('https://example.com', { hasIcon: true }), card = link('https://example.com', { inCard: true });
  decorateLinks(root([cited, had, card])); for (const a of [cited, had, card]) assert.equal(a.html, '');
  const again = link('https://example.com'); decorateLinks(root([again])); decorateLinks(root([again])); assert.equal((again.html.match(/class="vfav"/g) || []).length, 1);
});
test('decorateLinks tolerates a missing element', () => { assert.doesNotThrow(() => decorateLinks(null)); assert.doesNotThrow(() => decorateLinks({})); });

import { factCheck, rewriteDepth } from '../assets/x/humanize-stats.js';
const DRAFT = 'In 2023, Acme Corp grew revenue by 42% to $1,200,000 (Smith, 2021). See https://acme.com/report. It is important to note that NASA helped.';
test('fact check finds kept facts, ignores formatting changes, and does not treat sentence starts as names', () => {
  const f = factCheck(DRAFT, 'Acme Corp grew revenue 42% in 2023, reaching $1200000 (Smith, 2021). Details at https://acme.com/report. NASA helped too.');
  assert.deepEqual(f.missing, []); assert.deepEqual(f.added, []); assert.equal(f.kept, f.total); assert.ok(f.total >= 8, String(f.total));
});
test('fact check lists dropped facts and made-up numbers', () => {
  const f = factCheck(DRAFT, 'Acme Corp grew revenue a lot, by 55%, in 2023. NASA helped.');
  for (const x of ['42%', '$1,200,000', '(Smith, 2021)', 'https://acme.com/report']) assert.ok(f.missing.includes(x), x + ' missing from ' + f.missing);
  assert.deepEqual(f.added, ['55%']);
});
test('rewrite depth is 0 for identical text, 1 for unrelated text, and in between otherwise', () => {
  assert.equal(rewriteDepth(DRAFT, DRAFT), 0);
  assert.equal(rewriteDepth('the cat sat', 'dogs bark loudly'), 1);
  const d = rewriteDepth('We went to the shop and bought bread.', 'We went to the shop. Bread was bought.');
  assert.ok(d > 0 && d < 1, String(d));
  assert.equal(rewriteDepth('', ''), 0);
});
test('panel shows words changed and warns about dropped facts', () => {
  const h = signalsHtml(DRAFT, 'Acme grew a lot, by 55%. That was good. People were happy.');
  assert.match(h, /Words changed/); assert.match(h, /Facts kept/); assert.match(h, /is-warn/); assert.match(h, /Check before using/); assert.match(h, /New numbers/);
  assert.doesNotMatch(signalsHtml(DRAFT, 'Acme Corp grew revenue 42% in 2023 to $1,200,000 (Smith, 2021). See https://acme.com/report. NASA helped.'), /Check before using/);
});
