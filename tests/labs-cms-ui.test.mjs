import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Admin dashboard exposes the Labs tools and article managers', async () => {
  const html = await read('admin/index.html');
  assert.match(html, /data-view="labs"/);
  assert.match(html, /id="view-labs"/);
  assert.match(html, /id="labs-tool-form"/);
  assert.match(html, /id="labs-article-form"/);
  assert.match(html, /labs-admin\.js/);
  assert.match(html, /labs-admin\.css/);
});

test('public article page loads a dedicated article renderer', async () => {
  const html = await read('labs-article.html');
  const js = await read('assets/labs/labs-article.js');
  assert.match(html, /assets\/labs\/labs-article\.js/);
  assert.match(js, /\/api\/labs\/content/);
  assert.match(js, /articles\.find\(a => a\.id === slug\)/);
  assert.match(js, /\/api\/labs\/media\//);
});

test('Labs cards use server-published tools and never launch unsupported actions', async () => {
  const js = await read('assets/labs/labs.js');
  assert.match(js, /\/api\/labs\/content/);
  assert.match(js, /if \(!t\.assistant \|\| !LAB_ASSISTANTS\.includes\(t\.assistant\)\) return/);
  assert.match(js, /Coming soon/);
  assert.match(js, /labs-article-search/);
  assert.match(js, /labs-article-category/);
});

test('admin CMS uses authenticated server APIs rather than localStorage publishing', async () => {
  const js = await read('admin/labs-admin.js');
  assert.match(js, /Authorization: 'Bearer '\+token\(\)/);
  assert.match(js, /\/api\/admin\/labs\/tools/);
  assert.match(js, /\/api\/admin\/labs\/articles/);
  assert.match(js, /\/api\/admin\/labs\/media/);
  assert.match(js, /method:'DELETE'/);
  assert.doesNotMatch(js, /localStorage\.setItem\([^)]*labs/i);
});
