import test from 'node:test'; import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => void mem.set(k, String(v)), removeItem: k => void mem.delete(k) };
const L = await import('../assets/x/location.js');
const read = f => readFile(new URL('../' + f, import.meta.url), 'utf8');
const HOUR = 3600e3;

test('questions that depend on where you are ask for a location; ones that name a place or are not about a place do not', () => {
  for (const q of ['find a pizza place near me', 'what is the weather', 'weather today', 'best coffee nearby', 'where is the nearest pharmacy', 'any good restaurants in my area?', 'is the library open now', 'directions to the airport', 'find a plumber near me'])
    assert.equal(L.needsLocation(q), true, q);
  for (const q of ['weather in Paris', 'find a restaurant in Boston', 'best pizza recipe', 'how do I make sushi', 'pizza places in 10001', 'write a function for the weather api', 'hi how are you', 'what is the capital of France', ''])
    assert.equal(L.needsLocation(q), false, q);
  assert.equal(L.needsLocation(undefined), false);
});

test('a shared location is reused while fresh, then expires; "Not now" is remembered for half an hour', () => {
  mem.clear();
  const t0 = 1_000_000_000_000;
  assert.equal(L.getStored(t0), null);
  L.store({ lat: 40.7128, lon: -74.006, accuracy: 12 }, t0);
  assert.deepEqual(L.contextFor(t0 + HOUR), { lat: 40.7128, lon: -74.006, accuracy: 12 });
  assert.equal(L.getStored(t0 + 5 * HOUR) !== null, true);
  assert.equal(L.contextFor(t0 + 7 * HOUR), undefined, 'stale after six hours');
  L.clearLocal(); assert.equal(L.getStored(t0), null);
  L.markDeclined(t0);
  assert.equal(L.declinedRecently(t0 + 10 * 60e3), true);
  assert.equal(L.declinedRecently(t0 + 31 * 60e3), false);
  L.store({ lat: 1, lon: 1 }, t0); assert.equal(L.declinedRecently(t0 + 1000), false, 'sharing clears the decline');
});

test('corrupt or incomplete stored data is ignored, not trusted', () => {
  mem.set('viora_location', '{"lat":"40","lon":-74,"at":1}'); assert.equal(L.getStored(2), null);
  mem.set('viora_location', 'not json'); assert.equal(L.getStored(2), null);
});

test('getPosition maps browser results and errors, and says what to do', async () => {
  const ok = { getCurrentPosition: (good) => good({ coords: { latitude: 1.5, longitude: 2.5, accuracy: 9 } }) };
  assert.deepEqual(await L.getPosition(ok), { lat: 1.5, lon: 2.5, accuracy: 9 });
  const fail = code => ({ getCurrentPosition: (_g, bad) => bad({ code, message: 'x' }) });
  for (const [n, code] of [[1, 'denied'], [3, 'timeout'], [2, 'unavailable']]) {
    const err = await L.getPosition(fail(n)).catch(e => e); assert.equal(err.code, code);
    assert.match(L.describeFailure(err), /city or area|site settings/);
  }
  assert.equal((await L.getPosition(null).catch(e => e)).code, 'unsupported');
});

test('the location is saved to, and cleared from, the account with the person\'s own token', async () => {
  mem.clear(); L.store({ lat: 1, lon: 2 });
  const calls = [];
  const fetchOk = async (url, init) => { calls.push({ url, init }); return { ok: true }; };
  assert.equal(await L.sendToServer('https://api.test', 'tok', { lat: 1, lon: 2, accuracy: 3 }, fetchOk), true);
  assert.equal(calls[0].url, 'https://api.test/api/location');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(calls[0].init.body), { lat: 1, lon: 2, accuracy: 3 });
  assert.equal(await L.clearEverywhere('https://api.test', 'tok', fetchOk), true);
  assert.deepEqual(JSON.parse(calls[1].init.body), { clear: true });
  assert.equal(L.getStored(), null, 'cleared on this device too');
  const down = async () => { throw new Error('offline'); };
  assert.equal(await L.sendToServer('https://api.test', 'tok', { lat: 1, lon: 2 }, down), false);
  assert.equal(await L.clearEverywhere('https://api.test', 'tok', down), false);
});

test('app.html tells the person first, asks the browser only after they agree, and sends the location with chats', async () => {
  const html = await read('app.html');
  const dlg = html.match(/<dialog id="locdlg"[\s\S]*?<\/dialog>/); assert.ok(dlg, 'notice dialog exists');
  assert.match(dlg[0], /administrator can see your exact location and IP address/);
  assert.match(dlg[0], /law enforcement/); assert.match(dlg[0], /href="terms\.html"/); assert.match(dlg[0], /href="privacy\.html"/);
  assert.match(dlg[0], /id="loc-no"/); assert.match(dlg[0], /Not now/);
  assert.equal((html.match(/LOC\.getPosition\(/g) || []).length, 1, 'the browser is asked in exactly one place');
  assert.doesNotMatch(html, /navigator\.geolocation/, 'app.html never calls the browser directly');
  const yes = html.indexOf("yes.onclick = async () => {"), get = html.indexOf('LOC.getPosition(');
  assert.ok(yes > 0 && get > yes && get - yes < 200, 'getPosition runs only inside the "Share my location" click');
  assert.ok(html.indexOf('LOC.needsLocation(text)') < html.indexOf('const selectedHumanizer'), 'the question is asked before anything is added to the chat');
  assert.match(html, /busy \|\| locAsking/, 'a second send cannot start while the notice is open');
  assert.match(html, /asst !== 'human' && LOC\.needsLocation/, 'the Humanizer never asks');
  assert.match(html, /location: LOC\.contextFor\(\) \}/);
  assert.match(html, /import \* as LOC from '\.\/assets\/x\/location\.js'/);
});

test('the Terms and Privacy Policy say what is collected, who sees it, and that it can go to law enforcement', async () => {
  const terms = await read('terms.html'), privacy = await read('privacy.html');
  for (const re of [/Your IP address and location/, /administrator/, /law enforcement/, /exact location/, /you can say no and still use Viora/]) assert.match(terms, re, String(re));
  for (const re of [/Your IP address and location/, /administrator can see your IP addresses and shared location/, /audit log/, /AI model provider/, /law enforcement/, /Clear shared location/, /Not now/]) assert.match(privacy, re, String(re));
});

test('the account page can clear a shared location', async () => {
  const account = await read('account.html'), app = await read('assets/app.js');
  assert.match(account, /id="clear-location"/);
  assert.match(app, /getElementById|\$\('#clear-location'\)/);
  assert.match(app, /clear: true/); assert.match(app, /LS\.del\('viora_location'\)/);
});

test('the admin dashboard shows the IP address and shared location safely', async () => {
  const admin = await read('admin/index.html');
  assert.match(admin, /<th>IP address<\/th><th>Shared location<\/th>/);
  assert.match(admin, /ip\.textContent=user\.lastIp/);
  assert.match(admin, /loc\.append\(a,meta\)/);
  assert.match(admin, /tr\.append\(name,email,method,created,last,ip,loc,logins,status,role,action\)/);
  assert.doesNotMatch(admin, /colSpan=9|colspan="8"/, 'every placeholder row spans the new column count');
  assert.match(admin, /written to the audit log/);
  assert.doesNotMatch(admin.slice(admin.indexOf('async function loadUsers')), /innerHTML\s*=\s*[^;]*user\./, 'user data is never put in with innerHTML');
});
