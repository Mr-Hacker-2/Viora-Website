import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the app inline module parses before the chat UI can initialize', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  const start = html.indexOf('<script type="module">');
  const end = html.indexOf('</script>', start);
  assert.notEqual(start, -1, 'app.html must include its chat module');
  assert.notEqual(end, -1, 'the chat module must be closed');

  // The module imports browser-only helpers. Strip those imports and compile the
  // remaining source without running it; AsyncFunction supports module-level await.
  const source = html.slice(start + '<script type="module">'.length, end)
    .split('\\n')
    .filter(line => !line.trimStart().startsWith('import '))
    .join('\\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(source));
});
