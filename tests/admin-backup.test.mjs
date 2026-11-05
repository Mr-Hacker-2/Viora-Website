import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin B2 controls use the protected server API and render connection, usage, stats, config, and errors', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  assert.match(html, /data-view="b2"/);
  assert.match(html, /id="b2-test"/);
  assert.match(html, /id="b2-objects"/);
  assert.match(html, /id="b2-transfer-count"/);
  assert.match(html, /id="b2-config"/);
  assert.match(html, /id="b2-errors"/);
  assert.match(html, /api\('\/api\/admin\/b2'/);
  assert.match(html, /api\('\/api\/admin\/b2\/test'/);
  assert.match(html, /@media\(max-width:760px\)/);
  assert.match(html, /@media\(max-width:480px\)/);
  assert.match(html, /api\('\/api\/admin\/session'\)/);
});

test('account backup buttons transfer website data through authenticated backend endpoints', async () => {
  const html = await readFile(new URL('../account.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
  for (const id of ['backup-now', 'backup-restore', 'backup-status']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(script, /fetch\(VIORA\.authApi \+ '\/api\/backup'/);
  assert.match(script, /Authorization: 'Bearer ' \+ token/);
  assert.match(script, /viora_chats_' \+ s\.email/);
  assert.match(script, /viora_data_' \+ s\.email/);
  assert.match(script, /Restored .*Reopen Viora/);
});
