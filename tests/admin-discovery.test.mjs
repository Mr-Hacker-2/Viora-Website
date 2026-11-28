import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = () => readFile(new URL('../admin/index.html', import.meta.url), 'utf8');

test('admin has a Discovery jobs view wired to the admin API, display only', async () => {
  const page = await html();
  assert.match(page, /data-view="discovery"/);
  assert.match(page, /id="view-discovery"/);
  assert.match(page, /\/api\/admin\/discovery/);
  assert.match(page, /if\(name==='discovery'\)loadDiscovery\(\)/);
  const block = page.slice(page.indexOf('Discovery jobs (Personal Intelligence'), page.indexOf('function showView'));
  assert.doesNotMatch(block, /method:\s*'(POST|PUT|DELETE)'/, 'monitoring never changes a job');
  assert.doesNotMatch(block, /innerHTML/, 'server text is only written with textContent');
  assert.match(block, /textContent/);
});

test('the discovery view renders stats, source health and a filterable job table', async () => {
  const page = await html();
  const start = page.indexOf('const discState'), end = page.indexOf('function showView');
  const code = page.slice(start, end);
  const elements = new Map();
  const mk = (tag = 'div') => ({ tag, className: '', dataset: {}, children: [], hidden: false, value: '', textContent: '', colSpan: 0, append(...k) { this.children.push(...k); }, replaceChildren(...k) { this.children = k; }, addEventListener() {} });
  const sel = id => { if (!elements.has(id)) elements.set(id, mk()); return elements.get(id); };
  const doc = { createElement: mk, hidden: false };
  const $ = s => sel(s);
  $('#disc-search').value = ''; $('#disc-status').value = '';
  const fn = new Function('$', 'document', 'currentView', 'clearError', 'showError', 'api', 'clearInterval', 'setInterval', code + '; return { renderDiscovery, drawDiscoveryJobs, discState };');
  const out = fn($, doc, 'discovery', () => {}, () => {}, async () => ({}), () => {}, () => 1);
  const data = {
    autoRetryScheduled: 1, truncated: false, accountsScanned: 2,
    worker: { running: true, activeRuns: 1, maxConcurrent: 2, tickMs: 3000, maxAttempts: 4, maxStartsPerHour: 10 },
    active: { queued: 2, running: 1, waiting: 1, delayed: 1, stale: 0 },
    last24h: { total: 3, succeeded: 1, partial: 1, failed: 1, cancelled: 0, avgDurationMs: 4200 },
    sources: { github: { label: 'GitHub', ok: 2, failed: 0, unavailable: 1, notConfigured: 0, inProgress: 0, retries: 3 } },
    recent: [
      { account: 'abcd1234', kind: 'signup', status: 'failed', createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), durationMs: 4200, recovered: 1, delayed: false, message: 'none reachable', sources: [{ id: 'github', label: 'GitHub', status: 'unavailable', attempts: 4 }] },
      { account: 'ffff0000', kind: 'manual', status: 'succeeded', createdAt: new Date().toISOString(), startedAt: null, durationMs: null, recovered: 0, delayed: true, message: '', sources: [] }
    ]
  };
  out.discState.data = data;
  out.renderDiscovery(data);
  assert.equal($('#disc-stats').children.length, 7);
  assert.equal($('#disc-stats').children[4].dataset.tone, 'bad', 'failures are highlighted');
  assert.match($('#disc-worker').textContent, /Worker running · 1 of 2 slots busy/);
  assert.equal($('#disc-sources tbody').children.length, 1);
  assert.equal($('#disc-jobs tbody').children.length, 2);
  $('#disc-status').value = 'failed'; out.drawDiscoveryJobs();
  assert.equal($('#disc-jobs tbody').children.length, 1);
  $('#disc-status').value = ''; $('#disc-search').value = 'ffff'; out.drawDiscoveryJobs();
  assert.equal($('#disc-jobs tbody').children.length, 1);
  $('#disc-search').value = 'nomatch'; out.drawDiscoveryJobs();
  assert.equal($('#disc-empty').hidden, false);
});
