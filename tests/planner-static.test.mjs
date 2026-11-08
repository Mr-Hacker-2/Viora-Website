import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../planner.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../planner.html', import.meta.url), 'utf8');

test('planner.js never treats the single-element helper $() as a list', () => {
  // $ is querySelector (one element); $$ is the list helper. $(...).forEach crashed startup and left the page loading forever.
  assert.doesNotMatch(js, /(?<!\$)\$\([^)]*\)\.(?:forEach|map|filter|some|every)\(/);
});

test('hidden or optional inputs inside the task form are never required', () => {
  // The checklist and comment boxes live inside #task-form. A required one blocks saving every new task.
  const form = html.slice(html.indexOf('<form id="task-form"'), html.indexOf('</form>', html.indexOf('<form id="task-form"')));
  const required = [...form.matchAll(/<input\b[^>]*\brequired\b[^>]*>/g)].map(m => m[0]);
  for (const tag of required) assert.doesNotMatch(tag, /name="text"/, 'checklist/comment input must not be required: ' + tag);
});

test('every close/cancel button in a Planner dialog skips form validation', () => {
  // Cancel is a submit button; without formnovalidate the browser validates the empty required fields first
  // and silently refuses to close the dialog.
  const buttons = [...html.matchAll(/<button\b[^>]*\bvalue="cancel"[^>]*>/g)].map(m => m[0]);
  assert.ok(buttons.length >= 4, 'expected the task and project dialogs to each have a close and a cancel button');
  for (const tag of buttons) assert.match(tag, /\bformnovalidate\b/, 'missing formnovalidate: ' + tag);
});

test('Cancel and × never save: both dialog submit handlers return early for the cancel button', () => {
  // Cancel is a submit button. Without this check, pressing Cancel on a filled-in form created the task/project
  // (or applied the edits) instead of discarding them.
  const task = js.slice(js.indexOf('async function saveTask'), js.indexOf('async function saveTask') + 400);
  assert.match(task, /event\.submitter[^;]*value\s*===\s*'cancel'\s*\)\s*return;\s*[\s\S]*?event\.preventDefault\(\)/, 'saveTask must return for cancel before preventDefault');
  const project = js.slice(js.indexOf("$('#project-form').addEventListener('submit'"), js.indexOf("$('#project-form').addEventListener('submit'") + 260);
  assert.match(project, /event\.submitter[^;]*value\s*===\s*'cancel'\)return;event\.preventDefault\(\)/, 'project submit must return for cancel before preventDefault');
});
