/* Viora website — shared script: config, icons, nav/footer, theme, auth */
(() => {
'use strict';

/* ================= CONFIG — edit these ================= */
const VIORA = {
  installUrl: 'install.html',            // dedicated install guide and extension download
  supportUrl: 'https://github.com/Mr-Hacker-2/Viora-Website/issues',
  authApi: 'https://viora-auth-website.onrender.com', // your Google sign-in server (Render)
  year: new Date().getFullYear()
};
window.VIORA = VIORA;

/* ================= icons ================= */
const ICONS = {
  zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  code:'<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  pointer:'<path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.06.95l-6.12 1.58a2 2 0 0 0-1.44 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/>',
  pen:'<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.85z"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  at:'<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  cloud:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  book:'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
  db:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
  mail:'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  eye:'<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  terminal:'<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  image:'<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  help:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  spark:'<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  ext:'<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  bug:'<path d="M8 2l1.9 1.9M16 2l-1.9 1.9"/><path d="M9 7.1V6a3 3 0 0 1 6 0v1.1"/><path d="M12 20a6 6 0 0 1-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6zM12 20v-9M6.5 13H2M17.5 13H22M6 18l-3 2M18 18l3 2"/>',
  key:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
};
const sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' +
  Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('') + '</svg>';
document.body.insertAdjacentHTML('afterbegin', sprite);
const ico = (n, c = '') => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
document.querySelectorAll('[data-i]').forEach(el => { el.innerHTML = ico(el.dataset.i); el.removeAttribute('data-i'); });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ================= theme ================= */
const root = document.documentElement;
const savedTheme = (() => { try { return localStorage.getItem('viora_theme'); } catch { return null; } })();
if (window.VioraPrefs) VioraPrefs.apply(); else root.dataset.theme = savedTheme || 'light';
function toggleTheme() {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  if (window.VioraPrefs) VioraPrefs.setTheme(next); else { root.dataset.theme = next; try { localStorage.setItem('viora_theme', next); } catch {} }
}

/* ================= toast ================= */
let toastEl, toastT;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

/* ================= session / auth (Google, via the Viora auth server) ================= */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const session = () => LS.get('viora_session', null);
const Auth = {
  googleUrl(mode, email = '', termsAccepted = false) {
    const url = new URL(VIORA.authApi + '/auth/google');
    url.searchParams.set('site', '1'); url.searchParams.set('mode', mode === 'signup' ? 'signup' : 'signin');
    if (email) url.searchParams.set('email', email);
    if (mode === 'signup' && termsAccepted) url.searchParams.set('terms', '1');
    return url.href;
  },
  async email(path, body) {
    let response;
    try { response = await fetch(VIORA.authApi + '/api/auth/email/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error('Could not reach the Viora sign-in server. Please try again shortly.'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'We could not complete that request. Please try again.'), { status: response.status });
    return data;
  },
  /** The account record in Backblaze (via the auth server): the sign-up questions plus this person's saved answers. */
  async profile(token, answers) {
    let r;
    try {
      r = await fetch(VIORA.authApi + '/api/profile', {
        method: answers ? 'POST' : 'GET',
        headers: { Authorization: 'Bearer ' + token, ...(answers ? { 'Content-Type': 'application/json' } : {}) },
        body: answers ? JSON.stringify({ answers }) : undefined
      });
    } catch { throw Object.assign(new Error('Could not reach the Viora server. It may be waking up, so try again in 30 seconds.'), { status: 0 }); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong. Please try again.'), { status: r.status });
    return d;
  },
  /** Ask the server to confirm the token, and trust ITS answer, not the URL. */
  async finish(token) {
    let r;
    try { r = await fetch(VIORA.authApi + '/api/verify?token=' + encodeURIComponent(token)); }
    catch { throw new Error('Could not reach the sign-in server. It may be waking up, so try again in 30 seconds.'); }
    if (!r.ok) throw new Error('That sign-in could not be verified. Please try again.');
    const d = await r.json();
    const s = { email: d.email, name: d.name || '', picture: d.picture || '', token, provider: d.provider || 'google', at: Date.now() };
    LS.set('viora_session', s); return s;
  },
  signOut() { LS.del('viora_session'); }
};
window.VioraAuth = Auth; window.vtoast = toast; window.vicon = ico;

/* ================= header / footer ================= */
const page = document.body.dataset.page || '';
const s = session();
const header = $('#site-header');
if (header) {
  header.className = 'site-header';
  header.innerHTML = `<div class="wrap nav">
    <a class="brand" href="index.html" aria-label="Viora home"><img src="assets/mark.png" alt="" width="30" height="30">Viora</a>
    <nav class="nav-links" id="nav-links" aria-label="Main">
      <a href="app.html">Open app</a>
      <a href="index.html#assistants">Assistants</a>
      <a href="index.html#features">Features</a>
      <a href="index.html#how">How it works</a>
      <a href="help.html"${page === 'help' ? ' aria-current="page"' : ''}>Help</a>
    </nav>
    <div class="nav-right">
      <button class="icon-btn" id="theme-btn" type="button" aria-label="Toggle theme">${ico('moon', 't-moon')}${ico('sun', 't-sun')}</button>
      ${s ? `<a class="btn btn-ghost hide-sm" href="account.html">${ico('user')}Account</a>` : `<a class="btn btn-ghost hide-sm" href="login.html">Log in</a>`}
      ${s ? `<a class="btn btn-primary" href="app.html">Open app</a>` : `<a class="btn btn-primary" href="${VIORA.installUrl}" target="_blank" rel="noopener noreferrer">${ico('download')}Get Viora</a>`}
      <button class="icon-btn burger" id="burger" type="button" aria-label="Menu" aria-expanded="false">${ico('menu')}</button>
    </div>
  </div>`;
  $('#theme-btn').onclick = toggleTheme;
  $('#burger').onclick = e => { const o = $('#nav-links').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); };
  $$('#nav-links a').forEach(a => a.addEventListener('click', () => $('#nav-links').classList.remove('open')));
  const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
}
const footer = $('#site-footer');
if (footer) {
  footer.className = 'site-footer';
  footer.innerHTML = `<div class="wrap">
    <div class="f-grid">
      <div class="f-brand"><a class="brand" href="index.html"><img src="assets/mark.png" alt="" width="30" height="30">Viora</a>
        <p>One free AI panel in your browser: chat, research, code, and writing.</p></div>
      <div><h4>Product</h4><a href="index.html#assistants">Assistants</a><a href="index.html#features">Features</a><a href="${VIORA.installUrl}" target="_blank" rel="noopener noreferrer">Install</a><a href="download-site.html">Download website ZIP</a></div>
      <div><h4>Support</h4><a href="help.html">Help center</a><a href="help.html#troubleshooting">Troubleshooting</a><a href="${VIORA.supportUrl}" target="_blank" rel="noopener noreferrer">Report an issue</a><a href="mailto:abdullahlababidi70@gmail.com">abdullahlababidi70@gmail.com</a><a href="tel:+13133130904">313-313-0904</a></div>
      <div><h4>Account &amp; legal</h4><a href="login.html">Log in</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></div>
    </div>
    <div class="f-bottom"><span>© ${VIORA.year} Viora. All rights reserved.</span><span>Made for people who live in their browser.</span></div>
  </div>`;
}
if (!$('.aura')) document.body.insertAdjacentHTML('afterbegin', '<div class="aura" aria-hidden="true"><div class="grid-bg"></div></div>');

/* ================= reveal on scroll ================= */
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 }) : null;
$$('.rv').forEach(el => io ? io.observe(el) : el.classList.add('in'));

/* ================= page: login ================= */
if (page === 'login') {
  const err = $('#auth-err'), note = $('#auth-note'), btn = $('#google'), email = $('#auth-email'), consent = $('#auth-consent');
  const emailForm = $('#email-auth'), submit = $('#email-submit'), password = $('#auth-password'), confirm = $('#auth-confirm');
  const query = new URLSearchParams(location.search);
  const mode = () => document.body.dataset.mode === 'signup' ? 'signup' : 'signin';
  let busy = false, resetMode = query.get('reset') === '1';
  const label = () => mode() === 'signup' ? 'Sign up with Google' : 'Continue with Google';
  const fail = msg => { busy = false; err.textContent = msg; err.classList.add('show'); btn.dataset.busy = 'false'; submit.dataset.busy = 'false'; btn.disabled = submit.disabled = mode() === 'signup' && !consent.checked && !resetMode; submit.textContent = resetMode ? 'Update password' : (mode() === 'signup' ? 'Create account with email' : 'Sign in with email'); btn.querySelector('#google-label').textContent = label(); };
  const showNote = msg => { note.textContent = msg; note.classList.add('show'); err.classList.remove('show'); };
  const setMode = next => {
    resetMode = false; document.body.dataset.mode = next;
    const creating = next === 'signup';
    $('#auth-title').textContent = creating ? 'Create your account' : 'Welcome back';
    $('#auth-sub').textContent = creating ? 'Start your Viora workspace with email or Google.' : 'Sign in with email or continue securely with Google.';
    $('#name-field').hidden = !creating; $('#confirm-field').hidden = !creating; $('#auth-consent-wrap').hidden = !creating; $('#forgot-wrap').hidden = creating;
    password.autocomplete = creating ? 'new-password' : 'current-password';
    $('#auth-signin').setAttribute('aria-pressed', String(!creating)); $('#auth-signup').setAttribute('aria-pressed', String(creating));
    submit.textContent = creating ? 'Create account with email' : 'Sign in with email';
    btn.querySelector('#google-label').textContent = label();
    btn.disabled = creating && !consent.checked; submit.disabled = creating && !consent.checked;
    if (creating) showNote('Choose email or Google. Your Google account opens directly without requiring an email above.');
    else { err.classList.remove('show'); note.classList.remove('show'); }
  };
  $('#auth-signin').addEventListener('click', () => setMode('signin'));
  $('#auth-signup').addEventListener('click', () => setMode('signup'));
  consent.addEventListener('change', () => { btn.disabled = submit.disabled = mode() === 'signup' && !consent.checked && !resetMode; });
  $$('[data-toggle-password]').forEach(toggle => toggle.addEventListener('click', () => { const input = $('#' + toggle.dataset.togglePassword); input.type = input.type === 'password' ? 'text' : 'password'; toggle.textContent = input.type === 'password' ? 'Show' : 'Hide'; toggle.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password'); }));
  password.addEventListener('input', () => { if (mode() !== 'signup') return; const v = password.value, score = [v.length >= 10, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length; $('#password-strength').textContent = v ? ['Use at least 10 characters', 'Weak password', 'Fair password', 'Good password', 'Strong password'][score] : ''; $('#password-strength').dataset.level = String(score); });
  const hp = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);

  const friendlyError = code => {
    if (code === 'account_not_found') {
      document.body.dataset.mode = 'signup'; $('#auth-signin').setAttribute('aria-pressed', 'false'); $('#auth-signup').setAttribute('aria-pressed', 'true');
      setMode('signup');
      email.value = email.value || query.get('email') || '';
      const message = "We couldn't find an account with this email. Let's create one!";
      showNote(message); btn.disabled = !consent.checked;
      return true;
    }
    return false;
  };

  // After Google: accounts that have not answered the 5 questions yet see the popup. Answers are saved to Backblaze by the auth server.
  async function finishLogin(sess) {
    btn.disabled = true; btn.dataset.busy = 'true'; btn.lastChild.textContent = 'Setting up your account…';
    let p;
    try { p = await Auth.profile(sess.token); }
    catch (ex) {
      if (ex.status === 401) { Auth.signOut(); return fail('Your sign-in expired. Please sign in again.'); }
      if (ex.status === 503) return location.replace('app.html'); // the server has no Backblaze keys yet, so there is nowhere to save answers
      return fail(ex.message);
    }
    if (!p.onboarded) await window.VioraOnboarding.ask(p.questions, a => Auth.profile(sess.token, a));
    location.replace('app.html');
  }

  (async () => {
    if (hp.get('error')) {
      if (friendlyError(hp.get('error'))) return;
      const messages = { storage_unavailable: 'Viora could not reach secure account storage. Please try again shortly.', account_suspended: 'This account is currently unavailable. Contact Viora support for help.', account_method_conflict: 'This account uses email and password. Please sign in with the email form.', unverified_email: 'Google did not verify this email. Please choose a verified Google account.' };
      return fail(messages[hp.get('error')] || (hp.get('error') === 'access_denied' ? 'Google sign-in was cancelled. You can try again any time.' : 'Google sign-in failed. Please try again.'));
    }
    if (hp.get('token')) {
      btn.disabled = true; btn.dataset.busy = 'true'; btn.lastChild.textContent = 'Signing you in…';
      let sess;
      try { sess = await Auth.finish(hp.get('token')); } catch (ex) { return fail(ex.message); }
      finishLogin(sess);
    } else if (s) finishLogin(s);
  })();
  btn.onclick = () => {
    if (mode() === 'signup' && !consent.checked) return fail('Please accept the Terms and Privacy Policy to create your account.');
    // Google OAuth is intentionally independent from the email/password fields.
    btn.disabled = true; btn.dataset.busy = 'true'; btn.querySelector('#google-label').textContent = 'Opening Google…'; location.href = Auth.googleUrl(mode(), '', consent.checked);
  };
  emailForm.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    err.classList.remove('show'); note.classList.remove('show');
    const address = email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { email.setAttribute('aria-invalid', 'true'); email.focus(); return fail('Enter a valid email address.'); }
    email.removeAttribute('aria-invalid');
    if (mode() === 'signup' && !resetMode && !consent.checked) return fail('Please accept the Terms and Privacy Policy to create your account.');
    if (password.value.length < 10) return fail('Use a password with at least 10 characters.');
    if (mode() === 'signup' && !resetMode && password.value !== confirm.value) return fail('Your passwords do not match.');
    busy = true; submit.disabled = btn.disabled = true; submit.dataset.busy = 'true'; submit.textContent = resetMode ? 'Updating password…' : (mode() === 'signup' ? 'Creating account…' : 'Signing in…');
    try {
      if (resetMode) {
        const result = await Auth.email('reset', { email: address, token: query.get('token'), password: password.value });
        resetMode = false; setMode('signin'); password.value = ''; confirm.value = ''; showNote(result.message || 'Password updated. Sign in to continue.');
      } else if (mode() === 'signup') {
        const result = await Auth.email('register', { name: $('#auth-name').value.trim(), email: address, password: password.value, termsAccepted: consent.checked });
        password.value = ''; confirm.value = ''; showNote(result.message || 'Check your email for a verification link.');
      } else {
        const result = await Auth.email('login', { email: address, password: password.value });
        const sess = await Auth.finish(result.token); await finishLogin(sess);
      }
    } catch (error) { fail(error.message); }
    finally { busy = false; submit.disabled = btn.disabled = mode() === 'signup' && !consent.checked && !resetMode; submit.dataset.busy = 'false'; if (!resetMode) submit.textContent = mode() === 'signup' ? 'Create account with email' : 'Sign in with email'; }
  });
  $('#forgot-password').addEventListener('click', async event => {
    event.preventDefault(); if (busy) return;
    const address = email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { email.setAttribute('aria-invalid', 'true'); email.focus(); return fail('Enter your email address first, then choose Forgot password.'); }
    busy = true; try { const result = await Auth.email('forgot', { email: address }); showNote(result.message); } catch (error) { fail(error.message); } finally { busy = false; }
  });
  if (query.get('mode') === 'signup' || location.pathname.endsWith('/signup.html')) setMode('signup');
  if (resetMode) { document.body.dataset.mode = 'signin'; setMode('signup'); resetMode = true; $('#auth-consent-wrap').hidden = true; $('#name-field').hidden = true; $('#confirm-field').hidden = false; $('#forgot-wrap').hidden = true; $('#auth-title').textContent = 'Choose a new password'; $('#auth-sub').textContent = 'Set a new password for your Viora account.'; submit.textContent = 'Update password'; submit.disabled = false; showNote('Use at least 10 characters for your new password.'); }
  if (query.get('verified') === '1') showNote('Email verified. Sign in to continue.');
  else if (query.get('verified') === 'error') fail('That verification link is invalid or expired. Please sign up again or contact support.');
  if (query.get('email')) email.value = query.get('email');
}

/* ================= page: account ================= */
if (page === 'account') {
  if (!s) location.replace('login.html');
  else {
    const name = s.name || (s.email || 'Account').split('@')[0];
    const av = $('#avatar'); av.textContent = '';
    if (/^https:\/\//i.test(s.picture || '')) { const im = document.createElement('img'); im.src = s.picture; im.alt = ''; im.referrerPolicy = 'no-referrer'; av.appendChild(im); }
    else av.textContent = name[0].toUpperCase();
    $('#a-name').textContent = name; $('#a-email').textContent = s.email;
    $('#kv-email').textContent = s.email; $('#kv-name').textContent = name;
    $('#kv-prov').textContent = s.provider === 'email' ? 'Email and password' : 'Google';
    $('#kv-since').textContent = new Date(s.at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    $('#signout').onclick = () => { Auth.signOut(); location.href = 'index.html'; };
    // If the server no longer accepts this session, sign out instead of showing stale details.
    fetch(VIORA.authApi + '/api/verify?token=' + encodeURIComponent(s.token || '')).then(r => { if (r.status === 401) { Auth.signOut(); location.replace('login.html'); } }).catch(() => {});
  }
}

/* ================= page: help ================= */
if (page === 'help') {
  const items = $$('details.q'), input = $('#help-search'), empty = $('#help-empty');
  let cat = 'all';
  const apply = () => {
    const q = input.value.trim().toLowerCase(); let n = 0;
    items.forEach(d => {
      const hit = (cat === 'all' || d.dataset.cat === cat) && (!q || d.textContent.toLowerCase().includes(q));
      d.hidden = !hit; if (hit) n++;
      if (q && hit) d.open = n <= 3;
    });
    $$('.group').forEach(g => g.hidden = !$$('details.q:not([hidden])', g).length);
    empty.classList.toggle('show', n === 0);
  };
  input.addEventListener('input', apply);
  $$('.chip').forEach(c => c.onclick = () => { cat = c.dataset.cat; $$('.chip').forEach(x => x.setAttribute('aria-pressed', x === c)); apply(); });
  addEventListener('keydown', e => { if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); } });
  if (location.hash.length > 1) { let id = location.hash.slice(1); try { id = decodeURIComponent(id); } catch {} const t = document.getElementById(id); if (t && t.matches('details.q')) t.open = true; }
  const secs = $$('.help-sec'), links = $$('.toc a');
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-30% 0px -60% 0px' });
  secs.forEach(x => spy.observe(x));
}
})();

