import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = name => readFile(new URL('../' + name, import.meta.url), 'utf8');

test('signup offers an unchecked, separate adult-only Personal Intelligence opt-in', async () => {
  for (const page of ['login.html', 'signup.html']) {
    const html = await file(page);
    assert.match(html, /id="auth-intel-wrap" hidden/);
    assert.match(html, /id="auth-intel-consent" type="checkbox"/);
    assert.match(html, /18 or older/);
    assert.match(html, /No private accounts, inboxes, or leaked data/);
    assert.match(html, /intelWrap\.hidden = !creating/);
  }
  const app = await file('assets/app.js');
  assert.match(app, /personalIntelOptIn/);
  assert.match(app, /intel_adult/);
  assert.match(app, /personalIntelAdultConfirmed/);
});

test('About you & Memory displays approved Personal Intelligence from the authenticated API', async () => {
  const html = await file('app.html');
  const script = await file('assets/x/personal-intel-memory.js');
  const css = await file('assets/x/intel-memory.css');
  assert.match(html, /id="pi-memory"/);
  assert.match(html, /assets\/x\/personal-intel-memory\.js/);
  assert.match(html, /href="intelligence\.html"/);
  assert.match(script, /\/api\/intel/);
  assert.match(script, /\/api\/intel\/discover/);
  assert.match(script, /\/api\/intel\/consent/);
  assert.match(script, /Authorization: 'Bearer ' \+ s\.token/);
  assert.match(script, /textContent/);
  assert.match(script, /discoveryPending/);
  assert.match(css, /@media\(max-width:620px\)/);
});

test('full Personal Intelligence dashboard requires both age and discovery acknowledgement', async () => {
  const html = await file('intelligence.html');
  const script = await file('assets/x/intel.js');
  assert.match(html, /id="pi-adult"/);
  assert.match(html, /id="pi-ack"/);
  assert.match(script, /#pi-ack/);
  assert.match(script, /#pi-adult/);
  assert.match(script, /adultConfirmed: true/);
  assert.match(script, /discoveryPending/);
  assert.match(script, /\/api\/intel\/discover/);
});

test('privacy policy documents sources, opt-in, review, AI use, and deletion', async () => {
  const html = await file('privacy.html');
  for (const term of ['18', 'GitHub', 'Gravatar', 'Brave Search', 'pending', 'approve', 'Humanizer', 'object versions']) {
    assert.ok(html.toLowerCase().includes(term.toLowerCase()), 'privacy policy missing ' + term);
  }
});

test('frontend does not contain server-side discovery API credentials', async () => {
  for (const path of ['login.html', 'signup.html', 'app.html', 'intelligence.html', 'assets/app.js', 'assets/x/intel.js', 'assets/x/personal-intel-memory.js']) {
    const source = await file(path);
    assert.doesNotMatch(source, /BRAVE_SEARCH_API_KEY|GRAVATAR_API_KEY|GITHUB_TOKEN/);
  }
});
