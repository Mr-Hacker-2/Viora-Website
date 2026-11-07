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
