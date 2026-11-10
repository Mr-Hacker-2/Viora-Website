import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('monitoring view shows request count and chart on first load', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('async function loadOverview(){');
  const end = html.indexOf('\nasync function loadUsers()', start);
  assert.notEqual(start, -1, 'admin overview loader exists');
  assert.notEqual(end, -1, 'admin users loader follows overview loader');

  const elements = new Map();
  const $ = selector => {
    if (!elements.has(selector)) {
      elements.set(selector, { textContent: '', dataset: {}, replaceChildren() {}, append() {} });
    }
    return elements.get(selector);
  };
  const charts = [];
  const cleared = [];
  const responses = {
    '/api/admin/overview': {
      users: { complete: true, total: 4, newToday: 1, newWeek: 2, recentSignIns30d: 3 },
      ai: { byAssistant: { 'Viora Flash': 7 }, submittedRequests: 7, requestsSince: 'server start' }
    },
    '/api/admin/health': {
      checkedAt: 'now', backend: 'healthy', storage: 'reachable', auth: 'healthy',
      aiProvider: { name: 'NVIDIA NIM', credentialsConfigured: true }
    },
    '/api/admin/activity': { events: [] }
  };
  const source = html.slice(start, end);
  const loadOverview = new Function(
    '$', 'api', 'makeHealthRow', 'renderEvents', 'drawRequests', 'fmt', 'showError', 'clearError', 'currentView', 'requestData', 'document',
    `return (${source});`
  )(
    $,
    async path => responses[path],
    () => ({}),
    () => {},
    canvas => charts.push(canvas),
    value => String(value),
    () => {},
    selector => cleared.push(selector),
    'monitoring',
    {},
    { createElement: () => ({}) }
  );

  await loadOverview();

  assert.equal($('#monitor-requests').textContent, '7');
  assert.deepEqual(charts, ['#request-chart', '#monitor-chart']);
  assert.equal($('.health-pill').dataset.state, 'online');
  assert.deepEqual(cleared, ['#overview-error', '#monitor-error']);
});

test('user management shows provider and verification metadata without exposing credentials', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const users = await readFile(new URL('../admin/users.js', import.meta.url), 'utf8');
  assert.match(html, /id="user-method-filter"/);
  assert.match(html, /id="user-sort"/);
  assert.match(html, /id="user-details"/);
  assert.match(users, /user\.provider === 'password'/);
  assert.match(users, /user\.emailVerified/);
  assert.match(users, /\/api\/admin\/users/);
  assert.match(users, /User ID.*Not returned by the account API/);
  assert.doesNotMatch(users, /passwordHash|password\s*:/i);
});