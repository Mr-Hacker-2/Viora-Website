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

test('planner commands use the authenticated Planner service', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /function isPlannerChatRequest\(text\)/);
  assert.match(html, /if \(isPlannerChatRequest\(text\)\)/);
  assert.match(html, /\/api\/planner\/assistant/);
  assert.match(html, /\/api\/planner\/assistant\/confirm/);
});

test('login offers Google (which verifies the email) and email + password', async () => {
  const html = await readFile(new URL('../login.html', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="auth-email"[^>]*type="email"[^>]*required/);
  assert.match(html, /Sign in with Google, or with your email and password/);
  assert.match(auth, /googleUrl\(mode, email, termsAccepted = false\)/);
  assert.match(auth, /Auth\.googleUrl\(mode\(\), value, consent\.checked\)/);
});

test('Pro Search exposes real Quick and Deep modes and streams server activity into progress', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /id="research-mode"[^>]*aria-label="Research depth"/);
  assert.match(html, /<option value="quick">Quick Search<\/option><option value="deep">Deep Research<\/option>/);
  assert.match(html, /researchMode: a === 'search' \? researchDepth : 'quick'/);
  assert.match(html, /researchRequestId: web2 \? researchRequestId : undefined/);
  assert.match(html, /API \+ '\/api\/progress\?id='/);
  assert.match(html, /m\.research\.queryCount/);
});

test('research report copy and Markdown export include source status and evidence limits', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /function researchReport\(c, index\)/);
  assert.match(html, /Page retrieved/);
  assert.match(html, /Search snippet only/);
  assert.match(html, /Claim support was not independently verified/);
  assert.match(html, /data-export/);
  assert.match(html, /text\/markdown;charset=utf-8/);
});

test('conversation titles use the completed first exchange through a non-blocking fast AI path', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /fallbackTitle\(text/);
  assert.match(html, /if \(shouldGenerateTitle\(c\)\) void generateConversationTitle\(c\);/);
  assert.doesNotMatch(html, /await generateConversationTitle\(c\)/);
  const send = html.slice(html.indexOf('async function send(text)'), html.indexOf('async function generateConversationTitle(c)'));
  assert.ok(send.indexOf('T.finish(tr, outcome)') < send.indexOf('void generateConversationTitle(c)'));
  assert.match(html, /max_tokens: 48, temperature: 0\.2/);
  assert.match(html, /finishTitleGeneration\(c, raw, fallback\)/);
  assert.match(html, /titleGenerationStarted = true/);
  assert.match(html, /const titleMessages = \[\{ role: 'user', content: starter \}, \...\(replyText \?/);
});

test('chat history supports manual names, persistence, switching, and title search', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /data-rename=/);
  assert.match(html, /renameConversation\(c, value\)/);
  assert.match(html, /\.sh-chat\[data-id\]/);
  assert.match(html, /JSON\.stringify\(\{ chats, data: D \}/);
  assert.match(html, /const titleMatch = String\(x\.title \|\| ''\)\.toLowerCase\(\)\.includes\(filter\)/);
});

test('a streamed reply cannot repaint a different conversation after switching chats', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  const send = html.slice(html.indexOf('async function send(text)'), html.indexOf('async function generateConversationTitle(c)'));
  assert.match(send, /paint = \(\) => \{ if \(chat\(\) !== c\) return;/);
});

test('message editing has a cancel state and replaces only the selected latest turn', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /data-edit-user=/);
  assert.match(html, /historyBeforeEditedTurn\(c\.messages, edited\.index\)/);
  assert.match(html, /id="edit-banner"[^>]*hidden/);
  assert.match(html, /#edit-cancel'\)\.onclick/);
});

test('response copy does not intercept code-block copy buttons and has a clipboard fallback', async () => {
  const html = await readFile(new URL('../app.html', import.meta.url), 'utf8');
  assert.match(html, /e\.target\.closest\('\.msg-act\[data-copy\]'\)/);
  assert.match(html, /async function copyText\(text\)/);
  assert.match(html, /document\.execCommand\('copy'\)/);
});
