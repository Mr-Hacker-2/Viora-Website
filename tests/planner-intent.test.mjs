import test from 'node:test'; import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isPlannerRequest as P, followUpTaskIds, verifyAgainstState, failedResults } from '../assets/x/planner-intent.js';

test('the requested example commands all reach the Planner', () => {
  for (const t of ['Change my science project deadline to Friday.', 'Make my math assignment high priority.', 'Move this task to my school project.', 'Mark my completed assignments as done.', 'Rename my project to Spring Plan.', 'Add three subtasks to this task.', 'Organize my Planner for this week.', 'Show me all my unfinished projects.', 'Create a new project and organize everything for me.', 'Create a task for tomorrow to finish my science project.', 'Add a high-priority task for Friday.', 'Show me everything I need to complete this week.', 'Move my math assignment to Monday.', 'Create a study schedule for the next seven days.', 'What deadlines do I have coming up?', 'Break this project into smaller tasks.', '@planner list overdue'])
    assert.equal(P(t), true, t);
});
test('ordinary questions and pasted documents are not Planner commands', () => {
  for (const t of ['How do I create a project plan for a startup?', 'Explain what a task scheduler is in Linux.', 'Write an essay about the project of the Panama canal.', 'What is the capital of France?', 'Tell me a joke about homework.', ('I study every day and my project went well. ').repeat(40)])
    assert.equal(P(t), false, t.slice(0, 50));
});
test('short follow-ups count only right after a Planner answer', () => {
  assert.equal(P('make it high priority'), false); assert.equal(P('make it high priority', { lastWasPlanner: true }), true);
  assert.equal(P('move it to Friday', { lastWasPlanner: true }), true); assert.equal(P('thanks, that is great', { lastWasPlanner: true }), false);
  assert.deepEqual(followUpTaskIds('make it urgent', { tasks: [{ id: 't1' }] }), ['t1']);
  assert.deepEqual(followUpTaskIds('make it urgent', { tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }), []);
  assert.deepEqual(followUpTaskIds('show tasks', { tasks: [{ id: 't1' }] }), []);
});
test('verification catches unsaved and different data, never claims success without a match', () => {
  const live = [{ id: '1', title: 'Math', status: 'todo', priority: 'high', dueDate: '2026-11-27' }];
  assert.equal(verifyAgainstState([{ id: '1', title: 'Math', status: 'todo', priority: 'high', dueDate: '2026-11-27' }], live).ok, true);
  assert.deepEqual(verifyAgainstState([{ id: '2', title: 'Science' }], live).missing, ['Science']);
  assert.deepEqual(verifyAgainstState([{ id: '1', title: 'Math', priority: 'low' }], live).mismatched, ['Math (priority)']);
  assert.equal(failedResults([{ ok: true }, { ok: false, error: 'x' }, { error: 'y' }]).length, 2);
});
test('chat wiring: verification, honest failure text, request id and selected task ids', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /verifyPlannerWrites\(data\.tasks/); assert.match(html, /I could not confirm that these were saved/); assert.match(html, /Not everything was saved/);
  assert.match(html, /selectedTaskIds:followUpTaskIds/); assert.match(html, /requestId:/); assert.match(html, /function isPlannerChatRequest\(text\)/);
});
