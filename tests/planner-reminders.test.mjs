import test from 'node:test'; import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scanReminders, seenStore, reminderKey, describeNext, GRACE_MS } from '../assets/x/planner-reminders.js';

const now = Date.parse('2026-11-24T18:00:00Z'), iso = ms => new Date(now + ms).toISOString();
const t = (id, ms, extra = {}) => ({ id, title: 'Task ' + id, reminderAt: iso(ms), status: 'todo', ...extra });

test('sorts reminders into due, missed and upcoming', () => {
  const r = scanReminders([t('a', -60000), t('b', -GRACE_MS - 1000), t('c', 30 * 60000), t('d', 48 * 3600e3)], now);
  assert.deepEqual(r.due.map(x => x.task.id), ['a']); assert.deepEqual(r.missed.map(x => x.task.id), ['b']); assert.deepEqual(r.upcoming.map(x => x.task.id), ['c']);
});
test('completed, archived and reminder-less tasks never fire', () => {
  const r = scanReminders([t('a', -1000, { status: 'completed' }), t('b', -1000, { archived: true }), { id: 'c', title: 'x' }, t('d', -1000, { reminderAt: 'junk' })], now);
  assert.equal(r.due.length + r.missed.length + r.upcoming.length, 0);
});
test('a reminder is shown once, and re-armed when its time changes', () => {
  const store = seenStore({ getItem: () => null, setItem() { throw new Error('quota'); }, key: () => null, length: 0 }); // storage that always fails
  const task = t('a', -1000); assert.equal(scanReminders([task], now, k => store.has(k)).due.length, 1);
  store.add(reminderKey(task)); assert.equal(scanReminders([task], now, k => store.has(k)).due.length, 0, 'memory fallback prevents a repeat');
  assert.equal(scanReminders([{ ...task, reminderAt: iso(-2000) }], now, k => store.has(k)).due.length, 1);
});
test('seen store persists and prunes old entries', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k), key: i => [...data.keys()][i], get length() { return data.size; } };
  const s = seenStore(storage); s.add('viora_planner_reminder_old'); data.set('viora_planner_reminder_old', String(now - 40 * 86400e3)); s.add('viora_planner_reminder_new');
  s.prune(30 * 86400e3, now); assert.equal(data.has('viora_planner_reminder_old'), false); assert.equal(data.has('viora_planner_reminder_new'), true);
});
test('next-reminder text', () => {
  assert.equal(describeNext([], now), '');
  assert.match(describeNext(scanReminders([t('c', 30 * 60000), t('d', 90 * 60000)], now).upcoming, now), /Task c · in 30 min \(\+1 more today\)/);
});
test('planner wires the module, guards double saves and requires a title', async () => {
  const js = await readFile(new URL('../planner.js', import.meta.url), 'utf8'), html = await readFile(new URL('../planner.html', import.meta.url), 'utf8');
  assert.match(js, /^import \{ scanReminders/); assert.match(html, /<script type="module" src="planner.js">/); assert.match(html, /id="reminder-next"/);
  assert.match(js, /if \(taskSaving\) return;/); assert.match(js, /Give the task a title first/);
});
