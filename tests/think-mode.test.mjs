import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { thinkKey, readThink, writeThink, thinkApplies, thinkRequestFlag, thinkButtonState, thinkNote } from '../assets/x/think-mode.js';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const memoryStore = () => { const m = new Map(); return { get: (k, d) => (m.has(k) ? JSON.parse(m.get(k)) : d), set: (k, v) => { m.set(k, JSON.stringify(v)); return true; }, keys: () => [...m.keys()] }; };

test('Think is off by default and stays on until it is turned off', () => {
  const store = memoryStore();
  assert.equal(readThink(store, 'a@example.com'), false);
  writeThink(store, 'a@example.com', true);
  assert.equal(readThink(store, 'a@example.com'), true, 'still on when the page is opened again');
  writeThink(store, 'a@example.com', false);
  assert.equal(readThink(store, 'a@example.com'), false);
});

test('the setting belongs to one person: another account in the same browser does not inherit it', () => {
  const store = memoryStore();
  writeThink(store, 'Alice@Example.com', true);
  assert.equal(readThink(store, 'alice@example.com'), true, 'email case does not matter');
  assert.equal(readThink(store, 'bob@example.com'), false);
  assert.notEqual(thinkKey('alice@example.com'), thinkKey('bob@example.com'));
  assert.equal(readThink(store, ''), false); assert.equal(writeThink(store, '', true), false, 'nothing is stored without a signed-in person');
});

test('only a real boolean true is ever stored as on', () => {
  const store = memoryStore();
  store.set(thinkKey('a@example.com'), 'true');
  assert.equal(readThink(store, 'a@example.com'), false);
});

test('the request flag is a strict boolean and never applies to the Writing Studio', () => {
  assert.equal(thinkRequestFlag(true, 'flash'), true);
  assert.equal(thinkRequestFlag(true, 'search'), true);
  assert.equal(thinkRequestFlag(true, 'math'), true);
  assert.equal(thinkRequestFlag(false, 'flash'), false);
  assert.equal(thinkRequestFlag(true, 'human'), false);
  assert.equal(thinkRequestFlag(true, 'humanize'), false);
  assert.equal(thinkRequestFlag('yes', 'flash'), false);
  assert.equal(thinkApplies('auto'), true);
});

test('button state: pressed only when on and usable; always explains itself in the tooltip', () => {
  const off = thinkButtonState(false, 'flash'), on = thinkButtonState(true, 'flash'), hz = thinkButtonState(true, 'human');
  assert.deepEqual([off.pressed, off.disabled], [false, false]);
  assert.deepEqual([on.pressed, on.disabled], [true, false]);
  assert.deepEqual([hz.pressed, hz.disabled], [false, true]);
  for (const s of [off, on, hz]) assert.ok(s.title.length > 10);
  assert.notEqual(off.title, on.title);
});

test('the note under a reply says only what the server reported', () => {
  assert.equal(thinkNote(null), '');
  assert.equal(thinkNote({ requested: false }), '');
  assert.equal(thinkNote({ requested: true, applied: false }), 'Think was not used for this reply');
  assert.equal(thinkNote({ requested: true, applied: true, strongerModel: true, review: true }), 'Think · used a stronger model · answer double-checked');
  assert.equal(thinkNote({ requested: true, applied: true, strongerModel: false, review: false }), 'Think · extra care');
  for (const r of [{ requested: true, applied: true, strongerModel: true, review: true, providerReasoningMode: false }])
    assert.doesNotMatch(thinkNote(r), /reasoning mode|chain of thought/i);
});

test('app.html: the button is accessible and the real chat request carries the setting', () => {
  const app = read('app.html');
  const btn = app.match(/<button id="think-btn"[^>]*>/)?.[0] || '';
  assert.match(btn, /aria-pressed="false"/); assert.match(btn, /title="[^"]{10,}"/); assert.match(btn, /type="button"/);
  assert.match(app, /<button id="think-btn"[\s\S]*?<span>Think<\/span><\/button>/, 'visible label');
  assert.ok(app.indexOf('id="think-btn"') > app.indexOf('id="attach"') && app.indexOf('id="think-btn"') < app.indexOf('id="send"'), 'sits in the composer row near the input');
  assert.match(app, /think-mode\.css/); assert.match(app, /from '\.\/assets\/x\/think-mode\.js'/);
  assert.match(app, /intelligence: \{ review: verifyAnswer \}, think: thinkRequestFlag\(thinkAsked, a\)/, 'the main /api/chat request carries think');
  assert.match(app, /think: thinkRequestFlag\(thinkAsked, askAssistant\)/, 'the continuation request keeps the same mode');
  assert.match(app, /const thinkAsked = thinkOn;/, 'captured once per send');
  assert.match(app, /j\.viora_think/, 'the server report is handled');
  assert.match(app, /let thinkOn = readThink\(ls, S\.email\)/, 'per-person state');
  assert.match(app, /writeThink\(ls, S\.email, thinkOn\)/);
  // title-generation and other helper requests must not be affected
  const withThink = [...app.matchAll(/think: thinkRequestFlag/g)].length;
  assert.equal(withThink, 2);
});

test('think-mode.css: gray outline when off, blue on a light-blue pill when on, animated', () => {
  const css = read('assets/x/think-mode.css');
  assert.match(css, /\.think-btn\{[^}]*background:transparent[^}]*color:var\(--think-off\)/);
  assert.match(css, /\.think-btn\[aria-pressed="true"\][^{]*\{[^}]*color:var\(--think-on\);background:var\(--think-on-bg\)/);
  assert.match(css, /transition:background-color/); assert.match(css, /border-radius:999px/);
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /focus-visible/);
});

test('login and sign-up: Google (and the consent it depends on) come above the email and password fields', () => {
  for (const page of ['login.html', 'signup.html']) {
    const html = read(page), at = id => html.indexOf(`id="${id}"`);
    for (const id of ['google', 'auth-consent-wrap', 'auth-email', 'pw-form', 'auth-pass', 'pw-submit']) assert.ok(at(id) > 0, `${page} has #${id}`);
    assert.ok(at('google') < at('auth-email'), `${page}: Google above the email box`);
    assert.ok(at('google') < at('auth-pass'), `${page}: Google above the password box`);
    assert.ok(at('auth-consent-wrap') < at('google'), `${page}: the agreement sits before the button it enables`);
    assert.ok(at('auth-err') < at('google'), `${page}: error message stays above everything`);
    assert.ok(html.indexOf('class="auth-or"') > at('google') && html.indexOf('class="auth-or"') < at('auth-email'), `${page}: the OR divider sits between Google and email`);
  }
});
