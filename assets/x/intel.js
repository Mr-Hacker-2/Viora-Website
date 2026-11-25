/* Personal Intelligence dashboard. Talks only to the auth server's /api/intel routes with the signed-in session token;
   the server decides everything (verification, consent, ownership). All server text is rendered with textContent. */
(() => {
  if (document.body.dataset.page !== 'intelligence') return;
  const $ = s => document.querySelector(s);
  let s; try { s = JSON.parse(localStorage.getItem('viora_session') || 'null'); } catch { s = null; }
  if (!s || !s.token) { location.replace('login.html'); return; }
  const API = (window.VIORA && VIORA.authApi) || '';
  let state = null, filter = 'pending';

  const el = (tag, props = {}, kids = []) => { const n = document.createElement(tag); Object.assign(n, props); for (const k of [].concat(kids)) n.append(k); return n; };
  const msg = (text, err) => { const m = $('#pi-msg'); m.hidden = !text; m.textContent = text || ''; m.classList.toggle('err', !!err); };
  async function call(path, method = 'GET', body) {
    const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + s.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { location.replace('login.html'); throw new Error('Please sign in again.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
    return d;
  }
  const act = async (fn, okText) => { try { msg(''); const d = await fn(); if (d && d.findings) { state = d; render(); } if (okText) msg(okText); } catch (e) { msg(e.message, true); } };

  function render() {
    $('#pi-email').textContent = s.email;
    const st = $('#pi-state');
    st.textContent = state.enabled ? 'Discovery on' : 'Discovery off'; st.classList.toggle('on', state.enabled);
    $('#pi-last').textContent = state.lastRunAt ? 'Last discovery: ' + new Date(state.lastRunAt).toLocaleString() : 'No discovery run yet';
    $('#pi-unverified').hidden = state.emailVerified || state.enabled;
    $('#pi-consent').hidden = !state.emailVerified || state.enabled;
    $('#pi-main').hidden = !state.enabled && !state.findings.length;
    $('#pi-run').disabled = !state.enabled;
    $('#pi-disable').hidden = !state.enabled;

    $('#pi-sources').replaceChildren(...state.sources.map(x => el('li', { textContent: x.label + (x.configured ? '' : ' (not configured on this server yet)') })));
    $('#pi-report').replaceChildren(...(state.lastRunReport || []).map(r => el('li', {}, [el('b', { textContent: r.source + ':' }), r.status === 'ok' ? `${r.count} result${r.count === 1 ? '' : 's'}` : r.status === 'not_configured' ? 'not configured' : r.status === 'rate_limited' ? 'rate limited, try later' : 'failed', r.detail ? ' — ' + r.detail : ''])));

    const list = state.findings.filter(f => f.status === filter);
    $('#pi-findings').replaceChildren(...(list.length ? list.map(card) : [el('p', { className: 'pi-faint', textContent: filter === 'pending' ? 'Nothing waiting for review.' : 'None yet.' })]));

    $('#pi-profile').replaceChildren(...state.categories.map(c => el('label', {}, [c.label, el('textarea', { value: (state.profile[c.id] || []).join('\n'), name: c.id, placeholder: 'Nothing yet' })])));
  }

  function card(f) {
    const label = { strong: 'Strong match', possible: 'Possible match', uncertain: 'Uncertain' }[f.confidence];
    const btn = (text, cls, fn) => el('button', { className: 'btn ' + cls, type: 'button', textContent: text, onclick: fn });
    const acts = [];
    if (f.status !== 'approved') acts.push(btn('Approve', 'btn-primary', () => act(() => call('/api/intel/findings/' + f.id, 'POST', { status: 'approved' }), 'Approved. Its details were added to what Viora has learned.')));
    if (f.status !== 'rejected') acts.push(btn('Not me', 'btn-ghost', () => act(() => call('/api/intel/findings/' + f.id, 'POST', { status: 'rejected' }))));
    acts.push(btn('Delete', 'btn-ghost', () => act(() => call('/api/intel/findings/' + f.id, 'DELETE'))));
    return el('article', { className: 'pi-f' }, [
      el('div', { className: 'pi-tags' }, [el('span', { className: 'pi-tag ' + f.confidence, textContent: label }), el('span', { className: 'pi-tag', textContent: f.source })]),
      el('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer nofollow', textContent: f.title || f.url }),
      el('span', { className: 'url', textContent: f.url }),
      f.snippet ? el('p', { className: 'snip', textContent: f.snippet }) : '',
      el('p', { className: 'basis', textContent: 'Why: ' + f.matchBasis }),
      f.facts.length ? el('p', { className: 'basis', textContent: 'Would add: ' + f.facts.map(x => x.text).slice(0, 6).join(' · ') + (f.facts.length > 6 ? ' …' : '') }) : '',
      el('div', { className: 'acts' }, acts)
    ]);
  }

  $('#pi-ack').onchange = e => { $('#pi-enable').disabled = !e.target.checked; };
  $('#pi-enable').onclick = () => act(() => call('/api/intel/consent', 'POST', { enable: true, acknowledge: true }), 'Discovery is on. Run it whenever you like.');
  $('#pi-disable').onclick = () => act(() => call('/api/intel/consent', 'POST', { enable: false }), 'Discovery is off. Viora will not search again or use your profile until you turn it back on.');
  $('#pi-run').onclick = async () => { const b = $('#pi-run'); b.disabled = true; b.textContent = 'Searching…'; await act(() => call('/api/intel/discover', 'POST', {}), 'Discovery finished. Review the pending findings below.'); b.textContent = 'Run discovery'; b.disabled = !state?.enabled; };
  $('#pi-save').onclick = () => { const profile = {}; document.querySelectorAll('#pi-profile textarea').forEach(t => { profile[t.name] = t.value.split('\n').map(x => x.trim()).filter(Boolean); }); act(() => call('/api/intel/profile', 'PUT', { profile }), 'Saved.'); };
  $('#pi-delete').onclick = () => { if (!confirm('Delete all Personal Intelligence findings and your learned profile? This cannot be undone.')) return; act(async () => { await call('/api/intel', 'DELETE'); return call('/api/intel'); }, 'Your Personal Intelligence profile was deleted.'); };
  document.querySelectorAll('.pi-tabs button').forEach(b => b.onclick = () => { filter = b.dataset.f; document.querySelectorAll('.pi-tabs button').forEach(x => x.classList.toggle('on', x === b)); render(); });

  act(() => call('/api/intel'));
})();
