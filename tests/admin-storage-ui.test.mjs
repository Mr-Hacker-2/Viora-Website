import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('every admin navigation item has a matching dashboard view', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const nav = [...html.matchAll(/<button[^>]*data-view="([^"]+)"/g)].map(match => match[1]);
  assert.ok(nav.length >= 12);
  for (const view of nav) assert.match(html, new RegExp('id="view-' + view + '"'), 'missing view for ' + view);
  assert.equal(new Set(nav).size, nav.length, 'navigation keys are unique');
});

test('Backblaze inventory controls call real protected backend endpoints', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join('\n');
  for (const id of ['storage-refresh','storage-list-refresh','storage-search','storage-delete-selected','storage-delete-categories','storage-delete-all','storage-confirm-delete','storage-prev','storage-next']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing storage control ' + id);
  }
  for (const route of ['/api/admin/storage/summary','/api/admin/storage/objects','/api/admin/storage/preview','/api/admin/storage/delete']) {
    assert.ok(script.includes(route), 'missing backend call ' + route);
  }
  assert.match(script, /if\(name==='storage'\)loadStorage\(\)/);
  assert.match(script, /secondConfirm:true/);
  assert.match(script, /DELETE ALL VIORA STORAGE/);
  assert.match(script, /DELETE SELECTED VIORA OBJECTS/);
  assert.match(script, /DELETE SELECTED VIORA CATEGORIES/);
  assert.ok(html.includes('id="storage-delete-categories"'));
});

test('bulk deletion preview displays a complete object-key manifest and two confirmations', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join('\n');
  assert.ok(html.includes('id="storage-key-manifest"'));
  assert.ok(html.includes('id="storage-second-confirm"'));
  assert.match(script, /preview\.objectKeys/);
  assert.match(script, /input\.value!==input\.dataset\.required/);
  assert.match(script, /!check\.checked/);
  assert.match(script, /Enter the exact phrase and complete the second confirmation/);
});

test('storage UI labels protected data and does not expose provider credentials', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  assert.match(html, /user accounts and authentication records/i);
  assert.match(html, /administrator audit records/);
  assert.match(html, /unclassified or unrelated bucket objects/);
  assert.ok(!html.includes('B2_APP_KEY'));
  assert.ok(!html.includes('B2_KEY_ID'));
});

test('admin stylesheet uses the premium dark violet palette rather than the old light green override', async () => {
  const css = await readFile(new URL('../admin/admin.css', import.meta.url), 'utf8');
  assert.match(css, /color-scheme:dark/);
  assert.match(css, /--bg:#090714/);
  assert.match(css, /--violet:#a58aff/);
  assert.doesNotMatch(css, /--bg:#eef3f0/);
  assert.match(css, /\.storage-modal/);
});

test('analytics does not render a disabled fake date-range dropdown', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('id="view-analytics"');
  const end = html.indexOf('</section>', start);
  assert.notEqual(start, -1);
  assert.doesNotMatch(html.slice(start, end), /<select[^>]*disabled/);
});
