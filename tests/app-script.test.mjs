import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the app inline module parses before the chat UI can initialize', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  const start = html.indexOf('<script type="module">');
  const end = html.indexOf('</script>', start);
  assert.notEqual(start, -1, 'app.html must include its chat module');
  assert.notEqual(end, -1, 'the chat module must be closed');

  // Browser-only imports precede the IIFE. Compile without executing browser code.
  const body = html.slice(start + '<script type="module">'.length, end);
  const iife = body.indexOf('(() => {');
  assert.notEqual(iife, -1, 'the chat module must initialize its app IIFE');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(body.slice(iife)));
});
