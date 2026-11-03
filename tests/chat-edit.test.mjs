import test from 'node:test';
import assert from 'node:assert/strict';
import { editableUserIndex, historyBeforeEditedTurn } from '../assets/x/chat-edit.js';

test('only the latest completed text-only turn is editable', () => {
  const messages = [
    { role: 'user', content: 'earlier question' }, { role: 'assistant', content: 'earlier answer' },
    { role: 'user', content: 'latest question' }, { role: 'assistant', content: 'latest answer' }
  ];
  assert.equal(editableUserIndex(messages), 2);
  assert.equal(editableUserIndex(messages, { busy: true }), -1);
  assert.equal(editableUserIndex(messages, { hasChatAttachments: true }), -1);
  assert.equal(editableUserIndex(messages.slice(0, -1)), -1);
});

test('editing truncates the old reply while retaining all earlier conversation context', () => {
  const messages = [
    { role: 'user', content: 'first' }, { role: 'assistant', content: 'answer one' },
    { role: 'user', content: 'second' }, { role: 'assistant', content: 'answer two' }
  ];
  assert.deepEqual(historyBeforeEditedTurn(messages, 2), messages.slice(0, 2));
  assert.equal(historyBeforeEditedTurn(messages, 0), null);
});
