/* Personal Intelligence dashboard. Talks only to the auth server's /api/intel routes with the signed-in session token;
   the server decides everything (verification, consent, ownership). Discovery runs as a persistent server-side job: this page can
   request a refresh and watch real progress, but never runs or schedules a search itself. All server text uses textContent. */
(() => {
  if (document.body.dataset.page !== 'intelligence') return;
  const $ = s => document.querySelector(s);
  let s; try { s = JSON.parse(localStorage.getItem('viora_session') || 'null'); } catch { s = null; }
  if (!s || !s.token) { location.replace('login.html'); return; }
  const API = (window.VIORA && VIORA.authApi) || '';
  const P = globalThis.VioraIntelProgress;
  let state = null, filter = 'new', stopWatching = null;

  const el = (tag, props = {}, kids = []) => { const n = document.createElement(tag); Object.assign(n, props); for (const k of [].concat(kids)) n.append(k); return n; };
  const msg = (text, err) => { const m = $('#pi-msg'); m.hidden = !text; m.textContent = text || ''; m.classList.toggle('err', !!err); };
  async function call(path, method = 'GET', body) {
    const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + s.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { location.replace('login.html'); throw new Error('Please sign in again.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
    return d;
  }
  const act = async (fn, okText) => { try { msg(''); const d = await fn(); if (d && d.findings) { state = d; render(); } if (okText) msg(okText); return d; } catch (e) { msg(e.message, true); return null; } };
  const running = () => P.isActive(state?.discovery);

  function startWatching() {
    if (stopWatching) return;
    stopWatching = P.watch({
      fetchStatus: async () => (await call('/api/intel/discovery')).discovery,
      onUpdate: async (discovery, wasActive) => {
        if (!state) return;
        state.discovery = discovery;
        if (!P.isActive(discovery)) {
          stopWatching = null;
          if (wasActive === true) { try { state = await call('/api/intel'); } catch (e) { msg(e.message, true); } }
        }
        render();
      }
    });
  }

  function render() {
    $('#pi-email').textContent = s.email;
    const st = $('#pi-state');
    st.textContent = !state.enabled ? 'Discovery off' : state.paused ? 'Discovery paused' : running() ? 'Discovering…' : 'Discovery on';
    st.classList.toggle('on', state.enabled);
    $('#pi-last').textContent = state.lastRunAt ? 'Last successful discovery: ' + new Date(state.lastRunAt).toLocaleString() : 'No successful discovery yet';
    $('#pi-unverified').hidden = state.emailVerified || state.enabled;
    $('#pi-consent').hidden = !state.emailVerified || state.enabled;
    $('#pi-main').hidden = !state.enabled && !state.findings.length;
    const run = $('#pi-run');
    run.disabled = !state.enabled || !!state.paused;
    run.textContent = running() ? 'Searching…' : 'Refresh Discovery';
    $('#pi-pause').hidden = !state.enabled;
    $('#pi-pause').textContent = state.paused ? 'Resume discovery' : 'Pause discovery';
    $('#pi-disable').hidden = !state.enabled;
    $('#pi-status-line').textContent = !state.enabled ? '' : state.paused ? 'Discovery is paused. Nothing will be searched until you resume.' : running() ? '' : 'Searches run on Viora’s server. Refresh whenever you like.';
    const autoBox = $('#pi-auto-approve'); if (autoBox) { autoBox.checked = state.autoApproveStrong === true; autoBox.disabled = !state.enabled || !state.emailVerified; }
    const autoStatus = $('#pi-auto-status'); if (autoStatus) autoStatus.textContent = state.autoApproveStrong ? 'Automatic approval is on for strong matches only.' : 'Automatic approval is off. All findings wait for your review.';

    $('#pi-sources').replaceChildren(...state.sources.map(x => el('li', { textContent: x.label + (x.configured ? '' : ' (not configured on this server yet)') })));
    P.render($('#pi-progress'), state.discovery);

    const list = state.findings.filter(f => filter === 'new' ? f.isNew && f.status !== 'rejected' : f.status === filter);
    const empty = filter === 'new' ? 'No new findings from the latest search.' : filter === 'pending' ? 'Nothing waiting for review.' : 'None yet.';
    $('#pi-findings').replaceChildren(...(list.length ? list.map(f => P.findingCard(f, { act: decide, categories: state.categories })) : [el('p', { className: 'pi-faint', textContent: empty })]));
    $('#pi-profile').replaceChildren(...state.categories.map(c => el('label', {}, [c.label, el('textarea', { value: (state.profile[c.id] || []).join('\n'), name: c.id, placeholder: 'Nothing yet' })])));
    if (running()) startWatching();
  }

  function decide(action, f, facts) {
    call('/api/intel/discovery/ack', 'POST', {}).catch(() => {});
    if (action === 'delete') return act(() => call('/api/intel/findings/' + f.id, 'DELETE'));
    if (action === 'edit') return act(() => call('/api/intel/findings/' + f.id, 'PUT', { facts }), 'Saved. Your profile now reflects your edits.');
    if (action === 'approve') return act(() => call('/api/intel/findings/' + f.id, 'POST', { status: 'approved' }), 'Approved. Its details were added to what Viora has learned.');
    if (action === 'pending') return act(() => call('/api/intel/findings/' + f.id, 'POST', { status: 'pending' }), 'Automatic approval undone. The finding is pending review.');
    return act(() => call('/api/intel/findings/' + f.id, 'POST', { status: 'rejected' }));
  }

  const updateConsentButton = () => { $('#pi-enable').disabled = !($('#pi-ack').checked && $('#pi-adult').checked); };
  $('#pi-ack').onchange = updateConsentButton;
  $('#pi-adult').onchange = updateConsentButton;
  // Turning discovery on is all it takes: the server queues the first search itself.
  $('#pi-enable').onclick = () => act(() => call('/api/intel/consent', 'POST', { enable: true, acknowledge: true, adultConfirmed: true }), 'Discovery is on. The first search is running on Viora’s server; review the findings before approving anything.');
  $('#pi-auto-approve').onchange = () => act(() => call('/api/intel/settings', 'POST', { autoApproveStrong: $('#pi-auto-approve').checked }), $('#pi-auto-approve').checked ? 'Automatic approval enabled for strong matches.' : 'Automatic approval turned off.');
  $('#pi-disable').onclick = () => act(() => call('/api/intel/consent', 'POST', { enable: false }), 'Discovery is off. Any running search was stopped, and Viora will not use your profile until you turn it back on.');
  $('#pi-pause').onclick = () => act(() => call('/api/intel/pause', 'POST', { paused: !state.paused }), state.paused ? 'Discovery resumed.' : 'Discovery paused. Any running search was stopped.');
  // Refresh asks the server for a new search. If one is already running the server answers with it and we show its progress.
  $('#pi-run').onclick = () => act(async () => { const d = await call('/api/intel/discover', 'POST', {}); if (stopWatching) { stopWatching(); stopWatching = null; } return d; });
  $('#pi-save').onclick = () => { const profile = {}; document.querySelectorAll('#pi-profile textarea').forEach(t => { profile[t.name] = t.value.split('\n').map(x => x.trim()).filter(Boolean); }); act(() => call('/api/intel/profile', 'PUT', { profile }), 'Saved.'); };
  $('#pi-delete').onclick = () => { if (!confirm('Delete all Personal Intelligence findings and your learned profile? This cannot be undone.')) return; act(async () => { await call('/api/intel', 'DELETE'); return call('/api/intel'); }, 'Your Personal Intelligence profile was deleted.'); };
  document.querySelectorAll('.pi-tabs button').forEach(b => b.onclick = () => { filter = b.dataset.f; document.querySelectorAll('.pi-tabs button').forEach(x => x.classList.toggle('on', x === b)); render(); });

  // Display only. The server queued and runs discovery whether or not this page was open.
  act(async () => { const current = await call('/api/intel'); state = current; render(); if (current.discovery?.latest?.unseen && !running()) { call('/api/intel/discovery/ack', 'POST', {}).catch(() => {}); msg('Discovery finished while you were away: ' + (current.discovery.latest.summary?.newFindings || 0) + ' new finding(s) are ready to review.'); } return null; });
})();
