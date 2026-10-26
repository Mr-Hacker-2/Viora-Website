/* Viora website — shared script: config, icons, nav/footer, theme, auth */
(() => {
'use strict';

/* ================= CONFIG — edit these ================= */
const VIORA = {
  installUrl: 'install.html',            // dedicated install guide and extension download
  supportEmail: 'support@example.com',  // put your real support address here
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
root.dataset.theme = savedTheme || 'dark';
function toggleTheme() {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('viora_theme', next); } catch {}
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
  googleUrl() { return VIORA.authApi + '/auth/google?site=1'; },
  /** Ask the server to confirm the token, and trust ITS answer, not the URL. */
  async finish(token) {
    let r;
    try { r = await fetch(VIORA.authApi + '/api/verify?token=' + encodeURIComponent(token)); }
    catch { throw new Error('Could not reach the sign-in server. It may be waking up, so try again in 30 seconds.'); }
    if (!r.ok) throw new Error('That sign-in could not be verified. Please try again.');
    const d = await r.json();
    const s = { email: d.email, name: d.name || '', picture: d.picture || '', token, provider: 'google', at: Date.now() };
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
      <a href="index.html#assistants">Assistants</a>
      <a href="index.html#features">Features</a>
      <a href="index.html#how">How it works</a>
      <a href="help.html"${page === 'help' ? ' aria-current="page"' : ''}>Help</a>
    </nav>
    <div class="nav-right">
      <button class="icon-btn" id="theme-btn" type="button" aria-label="Toggle theme">${ico('moon', 't-moon')}${ico('sun', 't-sun')}</button>
      ${s ? `<a class="btn btn-ghost hide-sm" href="account.html">${ico('user')}Account</a>` : `<a class="btn btn-ghost hide-sm" href="login.html">Log in</a>`}
      <a class="btn btn-primary" href="${VIORA.installUrl}">${ico('download')}Get Viora</a>
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
        <p>One free AI panel in your browser: chat, research, code, automate and write.</p></div>
      <div><h4>Product</h4><a href="index.html#assistants">Assistants</a><a href="index.html#features">Features</a><a href="${VIORA.installUrl}" target="_blank" rel="noopener noreferrer">Install</a></div>
      <div><h4>Support</h4><a href="help.html">Help center</a><a href="help.html#troubleshooting">Troubleshooting</a><a href="mailto:${VIORA.supportEmail}">Contact us</a></div>
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
  const err = $('#auth-err'), btn = $('#google');
  const fail = msg => { err.textContent = msg; err.classList.add('show'); btn.disabled = false; };
  const hp = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
  (async () => {
    if (hp.get('error')) return fail(hp.get('error') === 'access_denied' ? 'Google sign-in was cancelled, or this Google account is not allowed yet.' : 'Google sign-in failed (' + hp.get('error') + '). Please try again.');
    if (hp.get('token')) {
      btn.disabled = true; btn.lastChild.textContent = 'Signing you in…';
      try { await Auth.finish(hp.get('token')); location.replace('account.html'); } catch (ex) { btn.lastChild.textContent = 'Continue with Google'; fail(ex.message); }
    } else if (s) location.replace('account.html');
  })();
  btn.onclick = () => { btn.disabled = true; btn.lastChild.textContent = 'Opening Google…'; location.href = Auth.googleUrl(); };
}

/* ================= page: account ================= */
if (page === 'account') {
  if (!s) location.replace('login.html');
  else {
    const name = s.name || s.email.split('@')[0];
    const av = $('#avatar'); av.innerHTML = s.picture ? `<img src="${s.picture.replace(/"/g, '')}" alt="" referrerpolicy="no-referrer">` : '';
    if (!s.picture) av.textContent = name[0].toUpperCase();
    $('#a-name').textContent = name; $('#a-email').textContent = s.email;
    $('#kv-email').textContent = s.email; $('#kv-name').textContent = name;
    $('#kv-prov').textContent = 'Google';
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
  if (location.hash) { const t = $(location.hash + '.q'); if (t) t.open = true; }
  const secs = $$('.help-sec'), links = $$('.toc a');
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-30% 0px -60% 0px' });
  secs.forEach(x => spy.observe(x));
  $('#contact-copy')?.addEventListener('click', () => { navigator.clipboard?.writeText(VIORA.supportEmail); toast('Email copied'); });
}
})();
