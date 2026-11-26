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
  const html = await read('labs-article.html'), js = await read('assets/labs/labs-article.js');
  assert.match(html, /assets\/labs\/labs-article\.js/);
  assert.match(js, /\/api\/labs\/content/);
  assert.match(js, /articles\.find\(a=>a\.id===slug\)/);
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
  assert.match(js, /Authorization: 'Bearer '\s*\+\s*token\(\)/);
  assert.match(js, /\/api\/admin\/labs\/tools/);
  assert.match(js, /\/api\/admin\/labs\/articles/);
  assert.match(js, /\/api\/admin\/labs\/media/);
  assert.match(js, /method:'DELETE'/);
  assert.doesNotMatch(js, /localStorage\.setItem\([^)]*labs/i);
});

test('Labs admin form does not block saving on an optional slug and supports publication dates', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../admin/labs-admin.js', import.meta.url), 'utf8');
  const slugInput = html.match(/<input[^>]*name="id"[^>]*>/)[0];
  assert.doesNotMatch(slugInput, /\brequired\b/);
  assert.match(html, /name="publishedAt" type="datetime-local"/);
  assert.match(js, /article\.isNew=true/);
  assert.match(js, /publishedAt:fromLocalInput/);
});

test('Labs admin styles use the dashboard colour tokens (no unreadable dark-on-light panels)', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../admin/labs-admin.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /#(0f0c19|100d1b|0b0915|171329|110e1c|cfc7df)/i);
});
