import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackTitle, normalizeGeneratedTitle, shouldGenerateTitle, renameConversation, finishTitleGeneration } from '../assets/x/chat-title.js';

test('fallback title describes the concrete subject in a short title', () => {
  assert.equal(fallbackTitle('Can you help me build a Raspberry Pi camera?'), 'Build Raspberry Pi Camera');
  assert.equal(fallbackTitle('How can I fix Python errors?'), 'Fix Python Errors');
  assert.equal(fallbackTitle('Hi'), 'Chat About Hi');
});

test('attachment names provide a useful fallback when the message has no words', () => {
  assert.equal(fallbackTitle('', ['algebra_notes.pdf']), 'Discuss Algebra Notes');
});

test('vague first prompts use the completed answer for a useful fallback instead of Chat About Something', () => {
  assert.equal(fallbackTitle('Help me with something', [], 'The project is about Raspberry Pi camera design.'), 'Project Raspberry Pi Camera Design');
  assert.equal(fallbackTitle('something'), 'New Conversation');
  assert.equal(normalizeGeneratedTitle('Chat About Something', 'Project Raspberry Pi Camera Design'), 'Project Raspberry Pi Camera Design');
});

test('generated titles are normalized, concise, and fall back when unusable', () => {
  assert.equal(normalizeGeneratedTitle('Title: "Building a Raspberry Pi Camera!"'), 'Building a Raspberry Pi Camera');
  assert.equal(normalizeGeneratedTitle('Hi', 'Chat About Algebra'), 'Chat About Algebra');
  assert.equal(normalizeGeneratedTitle('Create a Very Detailed Personal Website for Artists', 'Fallback Title'), 'Create a Very Detailed Personal Website');
});

test('title generation is allowed once, only for a new auto-titled conversation', () => {
  const chat = { autoTitle: true, messages: [{ role: 'user', content: 'first' }] };
  assert.equal(shouldGenerateTitle(chat), true);
  assert.equal(shouldGenerateTitle({ ...chat, titleGenerationStarted: true }), false);
  assert.equal(shouldGenerateTitle({ ...chat, titleManual: true }), false);
  assert.equal(shouldGenerateTitle({ ...chat, messages: [...chat.messages, { role: 'user', content: 'second' }] }), false);
});

test('manual titles persist and win if an AI title request finishes later', () => {
  const chat = { title: 'Fallback Title', autoTitle: true, titlePending: true };
  assert.equal(renameConversation(chat, '  My  Raspberry Pi Build  '), true);
  assert.equal(chat.title, 'My Raspberry Pi Build');
  assert.equal(finishTitleGeneration(chat, 'Building a Raspberry Pi Camera', 'Build a Raspberry Pi Camera'), false);
  assert.equal(chat.title, 'My Raspberry Pi Build');
  assert.equal(chat.titlePending, false);
  assert.equal(renameConversation(chat, '   '), false);
});

test('provider failure settles to the first-message fallback', () => {
  const chat = { title: 'Fallback', autoTitle: true, titlePending: true };
  finishTitleGeneration(chat, '', 'Troubleshooting Python Errors');
  assert.equal(chat.title, 'Troubleshooting Python Errors');
  assert.equal(chat.titleGenerated, true);
});

test('different conversation ids keep their titles through storage serialization', () => {
  const chats = [
    { id: 'chat-a', title: 'Fallback A', autoTitle: true },
    { id: 'chat-b', title: 'Fallback B', autoTitle: true }
  ];
  finishTitleGeneration(chats[0], 'Building a Raspberry Pi Camera', 'Build a Raspberry Pi Camera');
  renameConversation(chats[1], 'Algebra Homework');
  const restored = JSON.parse(JSON.stringify(chats));
  assert.deepEqual(restored.map(c => [c.id, c.title]), [['chat-a', 'Building a Raspberry Pi Camera'], ['chat-b', 'Algebra Homework']]);
});
