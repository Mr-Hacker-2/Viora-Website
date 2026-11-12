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
    '$', 'api', 'makeHealthRow', 'stateText', 'renderEvents', 'drawRequests', 'fmt', 'showError', 'clearError', 'setServiceStatus', 'currentView', 'requestData', 'document',
    `return (${source});`
  )(
    $,
    async path => responses[path],
    () => ({}),
    value => String(value || 'Unknown'),
    () => {},
    canvas => charts.push(canvas),
    value => String(value),
    () => {},
    selector => cleared.push(selector),
    health => { $('.health-pill').dataset.state = health.storage === 'reachable' && health.aiProvider.credentialsConfigured ? 'online' : 'degraded'; },
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

test('overview metrics remain available when optional health and activity endpoints fail', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('async function loadOverview(){');
  const end = html.indexOf('\nasync function loadUsers()', start);
  const elements = new Map();
  const $ = selector => {
    if (!elements.has(selector)) elements.set(selector, { textContent: '', dataset: {}, replaceChildren() {}, append() {} });
    return elements.get(selector);
  };
  const errors = [];
  const charts = [];
  const loadOverview = new Function(
    '$', 'api', 'makeHealthRow', 'stateText', 'renderEvents', 'drawRequests', 'fmt', 'showError', 'clearError', 'setServiceStatus', 'currentView', 'requestData', 'document',
    `return (${html.slice(start, end)});`
  )(
    $,
    async path => {
      if (path === '/api/admin/overview') return {
        users: { complete: true, total: 4, newToday: 1, newWeek: 2, recentSignIns30d: 3 },
        ai: { byAssistant: { 'Viora Flash': 7 }, submittedRequests: 7, requestsSince: 'server start' }
      };
      throw new Error(path === '/api/admin/health' ? 'Storage is unreachable.' : 'Audit storage is unavailable.');
    },
    () => ({}),
    value => String(value || 'Unknown'),
    () => {},
    canvas => charts.push(canvas),
    value => String(value),
    (selector, message) => errors.push([selector, message]),
    () => {},
    () => {},
    'overview',
    {},
    { createElement: () => ({}) }
  );

  await loadOverview();

  assert.equal($('#m-users').textContent, '4');
  assert.equal($('#monitor-requests').textContent, '7');
  assert.deepEqual(charts, ['#request-chart']);
  assert.deepEqual(errors, [['#overview-error', 'Health status unavailable: Storage is unreachable.']]);
  assert.equal($('#recent-events').textContent, 'Audit log is unavailable: Audit storage is unavailable.');
});

test('service status is degraded when a required dependency is unavailable', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function setServiceStatus(h){');
  const end = html.indexOf('\nfunction drawRequests', start);
  assert.notEqual(start, -1, 'service status helper exists');
  assert.notEqual(end, -1, 'service status helper ends before chart renderer');

  const elements = new Map();
  const $ = selector => {
    if (!elements.has(selector)) elements.set(selector, { textContent: '', dataset: {} });
    return elements.get(selector);
  };
  const setServiceStatus = new Function('$', `${html.slice(start, end)};return setServiceStatus;`)($);

  setServiceStatus({
    backend: 'healthy', auth: 'verified_for_this_request', storage: 'unreachable',
    aiProvider: { credentialsConfigured: true, connection: 'not_tested' }
  });

  assert.equal($('.health-pill').dataset.state, 'degraded');
  assert.equal($('#top-status').textContent, 'Service degraded');
});