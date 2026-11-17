import test from 'node:test'; import assert from 'node:assert/strict';
import { withPersona, looksLikeCode } from '../assets/x/persona.js';

test('looksLikeCode recognises code and batch-file conversations, not small talk', () => {
  for (const q of ['write a .bat file that backs up my folder', 'my batch script says goto label not found', 'how do I loop in PowerShell', 'fix this:\n```js\nlet x\n```', 'run.cmd'])
    assert.equal(looksLikeCode(q), true, q);
  for (const q of ['hi how are you', 'tell me a joke', 'what is the capital of France', '']) assert.equal(looksLikeCode(q), false, q);
  assert.equal(looksLikeCode(undefined), false);
});

test('Flash switches to coding mode only when the conversation is about code', () => {
  const chat = withPersona('flash', 'warm', '', '', 'hi how are you');
  const code = withPersona('flash', 'warm', '', '', 'write a .bat file');
  assert.match(chat, /Viora Flash voice: be friendly/);
  assert.doesNotMatch(chat, /Viora Flash coding mode/);
  assert.match(code, /Viora Flash coding mode/);
  assert.doesNotMatch(code, /Viora Flash voice: be friendly/, 'the casual guide is replaced, not stacked, to stay under the size limit');
  assert.equal(withPersona('flash', 'warm', '', ''), chat, 'with no recent text nothing changes');
});

test('the coding guide carries the batch-file rules that matter', () => {
  const code = withPersona('flash', 'warm', '', '', 'a .bat file');
  for (const re of [/setlocal EnableExtensions/, /EnableDelayedExpansion/, /set "VAR=value"/, /exit \/b/, /robocopy/, /CRLF/, /BOM/, /if not defined/, /rd \/s \/q/, /%%i/, /cd \/d "%~dp0"/, /Important:/, /untested/])
    assert.match(code, re, String(re));
  assert.match(code, /never claim it was run/);
});

test('coding mode leaves room for project instructions under the server limit of 8,000 characters', () => {
  const code = withPersona('flash', 'vivid', '', 'x'.repeat(300), 'x.bat');
  assert.ok(code.length <= 7600, 'code-mode prompt is ' + code.length + ' characters');
  const withProject = withPersona('flash', 'warm', 'Keep it British.', '', 'x.bat');
  assert.ok(withProject.endsWith('Keep it British.'), 'project instructions stay at the end');
});

test('other assistants are unaffected by the recent-conversation argument', () => {
  for (const a of ['math', 'search', 'human']) assert.equal(withPersona(a, 'warm', '', '', 'write a .bat file'), withPersona(a, 'warm', '', ''), a);
});

test('app.html gives Flash the recent conversation and attached file names', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /withPersona\(eff, tone, pj \? pj\.instr : '', who\(\), c\.messages\.slice\(-5, -1\)/);
  assert.match(html, /c\.page\.files\.map\(f => f\.name\)/);
});
