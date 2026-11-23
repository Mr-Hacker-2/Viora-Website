import test from 'node:test';
import assert from 'node:assert/strict';
import { looksCutOff, suggestFollowUps, CONTINUE_PROMPT } from '../assets/x/suggest.js';

const long = s => s + ' ' + 'This sentence pads the reply so it is long enough to count as a real answer. '.repeat(3);

test('looksCutOff: open code fences and trailing half-sentences count; finished answers do not', () => {
  assert.equal(looksCutOff('Here is the function:\n```js\nfunction add(a, b) {\n  return a +'), true, 'unclosed code block');
  assert.equal(looksCutOff(long('Intro.') + '\nThe three main reasons for the change are cost, speed and the way that the'), true, 'ends mid-sentence');
  for (const done of [long('That covers it.'), long('Is that what you meant?'), long('Done!'), long('Here is the list:\n- Paris\n- Rome'), long('See the table:\n| a | b |\n|---|---|\n| 1 | 2 |'), long('## Summary'), long('It works 🎉'), long('Use `npm test`'), 'Short.']) assert.equal(looksCutOff(done), false, JSON.stringify(done.slice(-30)));
  assert.equal(looksCutOff(''), false); assert.equal(looksCutOff(null), false);
  assert.equal(looksCutOff('A closed block:\n```js\nconsole.log(1)\n```\n' + 'Padding text goes here to make it long. '.repeat(2)), false);
});

test('suggestFollowUps fits the reply, never exceeds three, has no duplicates and skips tiny or writing-studio replies', () => {
  const code = suggestFollowUps(long('Here:\n```py\nprint("hello world, this is code")\n```'));
  assert.deepEqual(code, ['Explain this code line by line', 'Add error handling and edge cases', 'Write tests for it']);
  assert.match(suggestFollowUps(long('We get $$x = 3$$ after dividing.'), { assistant: 'math' })[0], /another way/);
  assert.match(suggestFollowUps(long('Findings below.'), { hasSources: true })[0], /sources/i);
  assert.match(suggestFollowUps(long('Steps:\n1. Open it\n2. Close it\n3. Done'))[0], /go wrong/);
  assert.match(suggestFollowUps(long('| a | b |\n|---|---|\n| 1 | 2 |\n\nTable above.'), { userText: 'compare A vs B' })[0], /pick/i);
  assert.match(suggestFollowUps('x'.repeat(1600))[0], /3 bullet/);
  const plain = suggestFollowUps(long('A plain answer.'));
  assert.equal(plain.length, 3); assert.equal(new Set(plain).size, 3);
  assert.deepEqual(suggestFollowUps('Hi!'), []); assert.deepEqual(suggestFollowUps(''), []);
  assert.deepEqual(suggestFollowUps(long('Rewritten text.'), { assistant: 'humanize' }), []);
  assert.match(CONTINUE_PROMPT, /Continue/);
});
