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
  assert.match(script, /signupOptInPending/);
  assert.match(script, /Cancel pending opt-in/);
  assert.match(script, /Refresh Discovery/);
  assert.match(script, /\/api\/intel\/pause/);
  assert.match(script, /\/api\/intel\/discovery/);
  assert.match(html, /id="pi-memory-progress"/);
  assert.match(html, /What Viora uses in AI conversations/);
  assert.match(html, /intel-progress\.js/);
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
  assert.match(script, /\/api\/intel\/discover/);
  assert.match(html, /id="pi-progress"/);
  assert.match(html, /id="pi-pause"/);
  assert.match(html, /What Viora uses in AI conversations/);
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

test('Google signup forwards the separate Personal Intelligence opt-in, while sign-in remains excluded', async () => {
  const app = await file('assets/app.js');
  assert.ok(app.includes("Auth.googleUrl(mode(), consent.checked, !!$('#auth-intel-consent')?.checked, !!$('#auth-intel-auto')?.checked)"));
  assert.ok(app.includes("if (mode === 'signup' && personalIntelOptIn)"));
  assert.ok(app.includes("url.searchParams.set('intel', '1')"));
  assert.ok(app.includes("url.searchParams.set('intel_adult', '1')"));
});

test('the browser never starts discovery on its own: no auto-run on load, no timers that run searches', async () => {
  for (const name of ['assets/x/personal-intel-memory.js', 'assets/x/intel.js']) {
    const script = await file(name);
    const posts = [...script.matchAll(/call\('\/api\/intel\/discover'[^)]*\)/g)];
    assert.ok(posts.length >= 1, 'a user-initiated Refresh still exists');
    assert.doesNotMatch(script, /state\.discoveryPending/, 'pending state is not used to trigger a browser-side run');
    assert.doesNotMatch(script, /setInterval\s*\(/);
    // The only discover call must sit inside a click handler.
    for (const m of posts) {
      const before = script.slice(Math.max(0, m.index - 260), m.index);
      assert.match(before, /onclick|addEventListener\('click'/, 'discover is only called from a user click');
    }
  }
  assert.ok((await file('assets/x/personal-intel-memory.js')).trimEnd().endsWith('load();\n})();'));
});

test('no 10-minute cooldown message or cooldown wording exists anywhere in the website', async () => {
  const { readdir } = await import('node:fs/promises');
  const walk = async dir => { const out = []; for (const e of await readdir(new URL('../' + dir, import.meta.url), { withFileTypes: true })) { if (['node_modules', '.git', 'tests'].includes(e.name)) continue; const rel = dir ? dir + '/' + e.name : e.name; if (e.isDirectory()) out.push(...await walk(rel)); else if (/\.(html|js|mjs|css|json)$/.test(e.name)) out.push(rel); } return out; };
  for (const rel of await walk('')) {
    const text = await file(rel);
    assert.doesNotMatch(text, /successful discovery ran recently|run another search in about|retryAfterSeconds/i, rel);
  }
  for (const rel of ['assets/x/intel.js', 'assets/x/personal-intel-memory.js', 'assets/x/intel-progress.js', 'intelligence.html', 'app.html']) {
    assert.doesNotMatch(await file(rel), /\b10 minutes?\b|ten minutes?|cooldown/i, rel);
  }
});

test('live progress shows the six real stages and per-source outcomes from the server, with no fake percentages', async () => {
  await import('../assets/x/intel-progress.js');
  const { describe } = globalThis.VioraIntelProgress;
  const stages = ['Preparing discovery', 'Searching public GitHub information', 'Checking available Gravatar information', 'Searching configured public web sources', 'Reviewing potential matches', 'Saving findings'];
  const job = { id: 'j', status: 'waiting', active: true, message: '', stages: stages.map((label, i) => ({ id: 's' + i, label, status: ['done', 'waiting', 'done', 'skipped', 'pending', 'pending'][i] })),
    sources: [{ id: 'github', label: 'GitHub', status: 'waiting', count: 0, attempts: 2, detail: 'GitHub answered 503. Retrying automatically.', nextAttemptAt: new Date().toISOString() }, { id: 'gravatar', label: 'Gravatar', status: 'ok', count: 1 }, { id: 'brave', label: 'Web', status: 'not_configured', detail: 'Requires a key.' }] };
  const m = describe({ active: job, latest: job });
  assert.equal(m.state, 'active');
  assert.deepEqual(m.stages.map(s => s.label), stages);
  assert.deepEqual(m.stages.map(s => s.statusLabel), ['Done', 'Retrying automatically', 'Done', 'Not used', 'Waiting', 'Waiting']);
  assert.deepEqual(m.sources.map(s => s.statusLabel), ['Retrying automatically', 'Succeeded', 'Not configured']);
  assert.equal(describe(null).state, 'idle');
  const failed = describe({ active: null, latest: { ...job, active: false, status: 'failed', message: 'Viora could not reach any public source right now, so nothing was changed.' } });
  assert.equal(failed.state, 'failed'); assert.match(failed.detail, /nothing was changed/);
  const css = await file('assets/x/intel.css'), src = await file('assets/x/intel-progress.js');
  assert.doesNotMatch(css + src, /progress-bar|animation:|@keyframes|Math\.random|width:\s*\d+%|\d+%\s*(complete|done)/, 'no simulated progress');
});

test('privacy policy explains background discovery, pausing and cancellation', async () => {
  const html = await file('privacy.html');
  for (const term of ['in the background', 'pause', 'cancels', 'retried automatically']) assert.ok(html.includes(term), 'privacy policy missing ' + term);
});

test('automatic strong-match approval controls are separate, unchecked signup options', async () => {
  for (const page of ['login.html', 'signup.html']) {
    const html = await file(page);
    assert.match(html, /id="auth-intel-auto" type="checkbox"/);
    assert.match(html, /id="auth-intel-auto-wrap" hidden/);
    assert.match(html, /Possible and uncertain matches will always wait/);
  }
  const app = await file('assets/app.js');
  assert.match(app, /autoApproveStrong = false/);
  assert.match(app, /url.searchParams.set\('intel_auto', '1'\)/);
  assert.match(app, /personalIntelAutoApproveStrong/);
});
test('dashboard and About you & Memory expose automatic approval controls', async () => {
  const html = await file('intelligence.html'), dashboard = await file('assets/x/intel.js');
  const memory = await file('assets/x/personal-intel-memory.js'), app = await file('app.html');
  assert.match(html, /id="pi-auto-approve"/);
  assert.match(dashboard, /\/api\/intel\/settings/);
  const shared = await file('assets/x/intel-progress.js');
  assert.match(shared, /Auto-approved/);
  assert.match(shared, /Undo/);
  assert.match(dashboard, /findingCard/);
  assert.match(app, /id="pi-memory-auto-approve"/);
  assert.match(memory, /\/api\/intel\/settings/);
  assert.match(memory, /auto-approved/);
});
