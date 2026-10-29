import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the app inline module parses before the chat UI can initialize', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  const match = html.match(/<script type="module">([\\s\\S]*?)<\\/script>/i);
  assert.ok(match, 'app.html must include its chat module');

  // The module imports browser-only helpers. Strip those imports and compile the
  // remaining source without running it; AsyncFunction supports module-level await.
  const source = match[1].replace(/^\\s*import\\s+[\\s\\S]*?;\\s*$/gm, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(source));
});
