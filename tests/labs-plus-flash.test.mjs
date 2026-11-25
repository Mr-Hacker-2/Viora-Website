import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const labs = await readFile(new URL('../assets/labs/labs.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.html', import.meta.url), 'utf8');

test('launching a Lab records which tool was launched for this session', () => {
  assert.match(labs, /sessionStorage\.setItem\('viora_labs_tool', t\.assistant\)/);
});

test('"+" switches to Viora Flash through the real model switch after a Lab, even when the Labs page is closed', () => {
  const handler = labs.slice(labs.indexOf("document.getElementById('sh-left').addEventListener('click'"));
  // The #new-thread branch must run before the "Labs page not open" early return.
  assert.ok(handler.indexOf("closest('#new-thread')") < handler.indexOf('if (!labsOpen) return;'));
  assert.match(handler, /labsOpen \|\| inLabTool\(\)\) \{ toFlash\(\)/);
  assert.match(labs, /function toFlash\(\) \{\s*if \(activeAssistant\(\) !== 'flash'\) switchAssistant\('flash', 'Viora Flash'\);/);
  // Capture phase, so the model is Flash before the app's own newChat handler empties the chat.
  assert.match(handler, /\}, true\);/);
});

test('switchAssistant goes through #sh-model change, which the app wires to setAsst (saved state used when sending)', () => {
  assert.match(labs, /sel\.dispatchEvent\(new Event\('change'/);
  assert.match(app, /\$\('#sh-model'\)\.onchange = e => setAsst\(e\.target\.value\)/);
  assert.match(app, /const setAsst = k => \{ asst = k; ls\.set\('viora_assistant', k\)/);
  assert.match(app, /\$\('#new-thread'\)\.onclick = \$\('#nav-chat'\)\.onclick = newChat/);
});

test('a Pro Search or Math choice not launched from Labs keeps normal "+" behaviour', () => {
  assert.match(labs, /const inLabTool = \(\) => \{ const a = activeAssistant\(\); return LAB_ASSISTANTS\.includes\(a\) && launchedTool\(\) === a; \}/);
});
