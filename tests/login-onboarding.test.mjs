import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');

test('sign-in only opens the sign-up questions when the server sent some, and never blocks on them', () => {
  const at = src.indexOf('async function finishLogin');
  assert.ok(at > 0, 'finishLogin should exist');
  const body = src.slice(at, src.indexOf("location.replace('app.html');", src.indexOf('VioraOnboarding', at)) + 40);
  assert.match(body, /Array\.isArray\(p\.questions\)\s*&&\s*p\.questions\.length/, 'must check that questions is a non-empty array');
  assert.match(body, /try\s*\{[^}]*VioraOnboarding\.ask[\s\S]*?\}\s*catch/, 'a failure in the questions popup must not stop sign-in');
});

test('the login page offers Google and email + password, and the password never reaches the page text or storage', async () => {
  const { readFileSync } = await import('node:fs');
  for (const page of ['login.html', 'signup.html']) {
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.match(html, /id="google"/); assert.match(html, /id="pw-form"/);
    assert.match(html, /id="auth-pass"[^>]*type="password"|type="password"[^>]*id="auth-pass"/);
  }
  const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  assert.match(app, /\/api\/auth\/signup/); assert.match(app, /\/api\/auth\/login/);
  assert.doesNotMatch(app, /localStorage[^;\n]*password|LS\.set\([^)]*secret/i, 'the password is never saved in the browser');
});

test('Google and email/password are independent: Google never needs, reads or sends the email box', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const at = app.indexOf('btn.onclick = () =>');
  const handler = app.slice(at, app.indexOf('};', at));
  assert.doesNotMatch(handler, /email/i, 'the Google handler must not read the email box');
  assert.doesNotMatch(app, /Type your email address in the box below/, 'the confusing message is gone');
  assert.doesNotMatch(app, /email\.addEventListener\('keydown'/, 'Enter in the email box submits the password form, not Google');
  const url = app.slice(app.indexOf('googleUrl('), app.indexOf('/** Email + password sign-up'));
  assert.doesNotMatch(url, /searchParams\.set\('email'/, 'no email is sent to Google');
  for (const page of ['login.html', 'signup.html']) {
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    const form = html.slice(html.indexOf('<form class="auth-pw"'), html.indexOf('</form>'));
    for (const id of ['auth-email', 'auth-pass', 'pw-submit']) assert.match(form, new RegExp(`id="${id}"`), `${page}: #${id} lives inside the email/password form`);
    assert.doesNotMatch(form, /id="google"/, `${page}: the Google button is outside the email/password form`);
  }
});
