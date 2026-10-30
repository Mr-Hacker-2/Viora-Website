import test from 'node:test';
import assert from 'node:assert/strict';
import { chatVoiceSample } from '../assets/x/voice.js';

const msgs = (...t) => t.flatMap(x => [{ role: 'user', content: x }, { role: 'assistant', content: 'Sure! Here is a long polished answer.' }]);
const typed = ['yo can u help me w my history hw', 'ok thats cool but make it shorter lol', 'wait what does mitosis even mean', 'nah i meant the second one, the one about rome', 'ty this is way better now honestly'];

test('builds a sample from what the user typed, newest chat first', () => {
  const v = chatVoiceSample([{ assistant: 'flash', updated: 1, messages: msgs(...typed.slice(0, 2)) }, { assistant: 'auto', updated: 9, messages: msgs(...typed.slice(2)) }]);
  assert.equal(v.msgs, 5); assert.ok(v.words >= 40);
  assert.ok(v.text.startsWith('ty this is way better')); assert.doesNotMatch(v.text, /polished answer/);
});
test('too little chat history gives no sample, so the Humanizer uses a natural voice', () => {
  assert.equal(chatVoiceSample([{ assistant: 'flash', messages: msgs('hi', 'thanks') }]).text, '');
  assert.equal(chatVoiceSample([]).text, ''); assert.equal(chatVoiceSample(null).text, ''); assert.equal(chatVoiceSample([null, {}, { messages: 'x' }]).text, '');
});
test('skips Humanizer chats, pasted text, code, duplicates and links', () => {
  const v = chatVoiceSample([
    { assistant: 'human', updated: 99, messages: msgs('PASTED ESSAY TEXT that is not my voice at all '.repeat(3)) },
    { assistant: 'flash', updated: 5, messages: msgs(...typed, typed[0], 'x'.repeat(700), 'fix this ```js\nlet a\n```', 'look at https://example.com/abc please') }
  ]);
  assert.doesNotMatch(v.text, /PASTED|xxxx|```|example\.com/); assert.equal(v.text.split('\n').filter(l => l === typed[0]).length, 1);
  assert.match(v.text, /look at please/);
});
test('sample stays within the size cap', () => {
  const many = Array.from({ length: 200 }, (_, i) => 'message number ' + i + ' and i type kinda like this ok');
  const v = chatVoiceSample([{ assistant: 'flash', messages: msgs(...many) }]);
  assert.ok(v.text.length <= 1500, String(v.text.length)); assert.ok(v.msgs > 5);
});
