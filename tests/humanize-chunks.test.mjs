import test from 'node:test'; import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { splitDocument, needsChunks, minWordsFor, partNote } from '../assets/x/humanize-chunks.js';
import { factCheck } from '../assets/x/humanize-stats.js';

const para = (n, w = 120) => ('Sentence number ' + n + ' covers the topic in some detail. ').repeat(Math.ceil(w / 7)).split(/\s+/).slice(0, w).join(' ') + '.';
const essay = n => Array.from({ length: n }, (_, i) => para(i)).join('\n\n');

test('short essays are not split; long ones are, in order, with nothing lost or duplicated', () => {
  assert.equal(needsChunks(essay(5)), false);
  const long = essay(30); assert.equal(needsChunks(long), true);
  const parts = splitDocument(long, 900);
  assert.ok(parts.length > 1 && parts.every(p => p.split(/\s+/).length <= 900));
  assert.equal(parts.join('\n\n'), long.split(/\n{2,}/).join('\n\n'));
});
test('headings and bullet lists stay attached to their section', () => {
  const doc = '# Title\n\n' + para(1) + '\n\n## Part two\n\n- point one\n- point two\n\n' + para(2);
  assert.equal(splitDocument(doc, 900).join('\n\n'), doc);
});
test('one huge paragraph is cut at sentence ends only', () => {
  const big = Array.from({ length: 400 }, (_, i) => 'This is sentence ' + i + ' of one giant paragraph.').join(' ');
  const parts = splitDocument(big, 300); assert.ok(parts.length > 1); for (const p of parts) assert.match(p, /\.$/);
  assert.equal(parts.join(' '), big);
});
test('completeness floor accepts shorter and longer rewrites but not a cut-off one', () => {
  assert.equal(minWordsFor(1000, {}), 500);
  assert.equal(minWordsFor(1000, { style: 'concise' }), 300);
  assert.equal(minWordsFor(1000, { mode: 'grammar' }), 750);
  assert.ok(620 >= minWordsFor(1000, {})); assert.ok(1600 >= minWordsFor(1000, {})); assert.ok(180 < minWordsFor(1000, {}));
  assert.equal(minWordsFor(0, {}), 0); assert.equal(minWordsFor(3, {}), 2);
});
test('fact check no longer rejects a lower-cased name or "10" written as "ten", but still catches real losses', () => {
  assert.equal(factCheck('We use the Internet daily. It is a big part of life.', 'Daily life leans on the internet.').missing.length, 0);
  assert.equal(factCheck('We counted 10 birds near Lake Tahoe.', 'Near Lake Tahoe we counted ten birds.').missing.length, 0);
  assert.deepEqual(factCheck('We counted 10 birds near Lake Tahoe.', 'We counted some birds nearby.').missing.sort(), ['10', 'Lake', 'Tahoe'].sort());
  assert.equal(factCheck('NASA launched it.', 'It launched.').missing.includes('NASA'), false); // sentence-initial, never tracked
});
test('Humanizer never goes through the Planner router, and has its own status messages', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /if \(!selectedHumanizer && isPlannerChatRequest\(text\)\)/);
  assert.doesNotMatch(html, /if \(isPlannerChatRequest\(text\)\)/);
  for (const t of ['Analyzing your writing…', 'Improving your text…', 'Polishing section ']) assert.ok(html.includes(t), t);
  assert.match(partNote(1, 4), /section 2 of 4/);
});
