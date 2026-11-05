import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const html = await readFile(new URL('../planner.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../planner.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../planner.css', import.meta.url), 'utf8');
const appCss = await readFile(new URL('../assets/x/app-polish.css', import.meta.url), 'utf8');

test('planner page scripts parse and expose authenticated workspace actions', () => {
  assert.doesNotThrow(() => new Script(js));
  assert.match(js, /Authorization: 'Bearer ' \+ token/);
  assert.match(js, /\/api\/planner\/state/);
  assert.match(js, /\/api\/planner\/actions/);
  assert.match(js, /\/api\/planner\/assistant/);
  assert.match(js, /\/api\/planner\/attachments/);
  assert.match(js, /runActions\(\[\{type:'delete_task'/);
});

test('planner offers the requested lists, calendar scales, timeline, and focus timer controls', () => {
  for (const view of ['dashboard','my-tasks','today','upcoming','calendar','important','completed','archived','focus']) assert.match(html, new RegExp('data-view="'+view+'"'));
  for (const mode of ['list','board','calendar','timeline']) assert.match(html, new RegExp('data-mode="'+mode+'"'));
  for (const scale of ['month','week','day']) assert.match(html, new RegExp('value="'+scale+'"'));
  assert.match(html, /id="focus-clock"/); assert.match(html, /id="focus-start"/);
  assert.match(js, /data-schedule-date/); assert.match(js, /dueDate:day\.dataset\.scheduleDate/);
});

test('advanced task fields persist through task CRUD and reminders state their local browser limits', () => {
  for (const field of ['category','scheduledAt','reminderAt','estimatedMinutes','actualMinutes','progress','recurrenceFrequency','important','archived','notes']) assert.match(html, new RegExp('name="'+field+'"'));
  assert.match(html, /id="attachment-file"/); assert.match(js, /Uploading to your private Viora storage/);
  assert.match(js, /Notification\.requestPermission/); assert.match(html, /while Planner is open in this browser/);
  assert.match(js, /frequency==='none'\?null/); assert.match(js, /data-inline-title/);
});

test('main Viora chat executes planner requests and renders task/project cards with deep links', () => {
  assert.match(app, /function isPlannerChatRequest\(text\)/);
  assert.match(app, /API \+ '\/api\/planner\/assistant'/);
  assert.match(app, /function plannerCardsHtml\(card\)/);
  assert.match(app, /planner\.html\?task=/);
  assert.match(app, /timeZone:Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
});

test('planner and conversation visuals adapt at tablet and mobile widths', () => {
  assert.match(css, /@media\(max-width:800px\)/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /\.focus-panel/);
  assert.match(appCss, /\.planner-chat-card/);
});

test('frontend does not contain B2 signing code or storage credentials', () => {
  assert.doesNotMatch(js + html, /AWS4-HMAC-SHA256|B2_APP_KEY|B2_KEY_ID|applicationKey/i);
});
