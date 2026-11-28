/* Shows the user's server-stored Personal Intelligence profile inside About you & Memory.
   Discovery itself runs on the server as a persistent job. This panel never runs or schedules a search on its own:
   it can ask for a refresh, and it watches the server's real progress. All data goes through the signed-in user's /api/intel session. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const panel = $('#pi-memory');
  if (!panel) return;
  const P = globalThis.VioraIntelProgress;
  let state = null, busy = false, stopWatching = null;
  const session = () => { try { return JSON.parse(localStorage.getItem('viora_session') || 'null'); } catch { return null; } };
  const API = 'https://viora-auth-website.onrender.com';
  const setStatus = (message, error = false) => {
    const el = $('#pi-memory-status');
    el.textContent = message || '';
    el.dataset.error = error ? 'true' : 'false';
  };
  async function call(path, method = 'GET', body) {
    const s = session();
    if (!s?.token) throw new Error('Sign in again to view your Personal Intelligence profile.');
    const response = await fetch(API + path, {
      method,
      headers: { Authorization: 'Bearer ' + s.token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { location.replace('login.html'); throw new Error('Your session expired. Please sign in again.'); }
    if (!response.ok) throw new Error(data.error || 'Could not load Personal Intelligence.');
    return data;
  }
  const node = (tag, cls, value) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value != null) el.textContent = value;
    return el;
  };
  const running = () => P.isActive(state?.discovery);

  function render() {
    if (!state) return;
    const total = Object.values(state.profile || {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
    const pending = (state.findings || []).filter(f => f.status === 'pending').length;
    const autoApproved = (state.findings || []).filter(f => f.autoApproved === true && f.status === 'approved').length;
    const autoBox = $('#pi-memory-auto-approve'); if (autoBox) { autoBox.checked = state.autoApproveStrong === true; autoBox.disabled = !state.enabled || !state.emailVerified; }
    const pill = $('#pi-memory-state');
    pill.textContent = !state.enabled ? 'Discovery off' : state.paused ? 'Discovery paused' : running() ? 'Discovering…' : 'Discovery on';
    pill.dataset.enabled = String(state.enabled);
    $('#pi-memory-disable').hidden = !(state.enabled || state.signupOptInPending);
    $('#pi-memory-disable').textContent = state.signupOptInPending && !state.enabled ? 'Cancel pending opt-in' : 'Turn off discovery';
    const pause = $('#pi-memory-pause');
    pause.hidden = !state.enabled;
    pause.textContent = state.paused ? 'Resume discovery' : 'Pause discovery';
    const refresh = $('#pi-memory-refresh');
    refresh.hidden = !state.enabled;
    refresh.disabled = !state.enabled || !!state.paused;
    refresh.textContent = running() ? 'Searching…' : 'Refresh Discovery';
    $('#pi-memory-last').textContent = state.enabled ? (state.lastRunAt ? 'Last successful discovery: ' + new Date(state.lastRunAt).toLocaleString() : 'No successful discovery yet.') : '';

    if (!state.emailVerified) {
      setStatus(state.signupOptInPending
        ? 'You opted in at sign-up. Discovery starts by itself as soon as this email is verified with Google. You can cancel that pending opt-in here.'
        : 'Verify ownership of this email with Google before discovery can run. Your existing profile, if any, remains private.');
    } else if (state.enabled) {
      const counts = total + ' approved detail' + (total === 1 ? '' : 's') + ' · ' + pending + ' waiting for review · ' + autoApproved + ' auto-approved.';
      setStatus((state.paused ? 'Discovery is paused. ' : '') + counts);
    } else {
      setStatus(total ? total + ' approved profile detail' + (total === 1 ? '' : 's') + ' saved. Discovery is off, so Viora is not using this profile in AI requests.' : 'Discovery is off. Nothing from public discovery is being added to your profile.');
    }
    P.render($('#pi-memory-progress'), state.discovery, { showFinished: true });
    const done = state.discovery?.latest;
    if (done && done.unseen && !running()) setStatus('Discovery finished: ' + (done.summary?.newFindings || 0) + ' new finding(s) are ready to review.');

    const fresh = (state.findings || []).filter(f => f.isNew && f.status !== 'rejected').slice(0, 6);
    $('#pi-memory-new').hidden = !fresh.length;
    $('#pi-memory-new-list').replaceChildren(...fresh.map(f => P.findingCard(f, { act: decide, categories: state.categories || [], compact: true })));

    const facts = $('#pi-memory-facts');
    facts.replaceChildren();
    const categories = Array.isArray(state.categories) ? state.categories : [];
    let shown = 0;
    for (const category of categories) {
      const items = Array.isArray(state.profile?.[category.id]) ? state.profile[category.id] : [];
      if (!items.length) continue;
      const group = node('section', 'pi-memory-group');
      group.append(node('strong', '', category.label));
      const list = node('ul', 'pi-memory-list');
      for (const item of items) {
        if (shown++ >= 40) break;
        list.append(node('li', '', item));
      }
      group.append(list);
      facts.append(group);
      if (shown >= 40) break;
    }
    if (!shown) facts.append(node('p', 'pi-memory-empty', state.enabled ? 'No approved details yet. Approve a finding above, or review all findings in Personal Intelligence.' : 'No approved public-footprint details have been saved.'));
    if (running() && !stopWatching) startWatching();
  }

  /** Follow the server's job. When it finishes, load the results; the search itself never depends on this page. */
  function startWatching() {
    stopWatching = P.watch({
      fetchStatus: async () => (await call('/api/intel/discovery')).discovery,
      onUpdate: async (discovery, wasActive) => {
        if (!state) return;
        state.discovery = discovery;
        if (wasActive === true && !P.isActive(discovery)) { stopWatching = null; try { state = await call('/api/intel'); } catch (e) { setStatus(e.message, true); } }
        else if (!P.isActive(discovery)) stopWatching = null;
        render();
      }
    });
  }

  async function decide(action, finding, facts) {
    if (busy) return;
    busy = true;
    call('/api/intel/discovery/ack', 'POST', {}).catch(() => {});
    try {
      if (action === 'delete') state = await call('/api/intel/findings/' + finding.id, 'DELETE');
      else if (action === 'edit') state = await call('/api/intel/findings/' + finding.id, 'PUT', { facts });
      else state = await call('/api/intel/findings/' + finding.id, 'POST', { status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending' });
      render();
    } catch (error) { setStatus(error.message, true); }
    finally { busy = false; }
  }

  async function load() {
    if (busy) return;
    busy = true;
    setStatus('Loading your private Personal Intelligence profile…');
    try {
      state = await call('/api/intel');
      if (state.discovery?.latest?.unseen && !running()) { /* shown by render(); acknowledged when the user opens the review list */ }
      render();
    } catch (error) {
      if (state) render();
      setStatus(error.message, true);
    } finally { busy = false; }
  }

  // Refresh asks the server for a fresh search. If one is already running the server returns it and we just show its progress.
  $('#pi-memory-refresh').addEventListener('click', async () => {
    if (busy || !state?.enabled) return;
    busy = true;
    try {
      state = await call('/api/intel/discover', 'POST', {});
      if (stopWatching) { stopWatching(); stopWatching = null; }
      render();
    } catch (error) { setStatus(error.message, true); }
    finally { busy = false; }
  });
  $('#pi-memory-pause').addEventListener('click', async () => {
    if (busy || !state?.enabled) return;
    busy = true;
    try { state = await call('/api/intel/pause', 'POST', { paused: !state.paused }); if (stopWatching) { stopWatching(); stopWatching = null; } render(); }
    catch (error) { setStatus(error.message, true); }
    finally { busy = false; }
  });
  $('#pi-memory-disable').addEventListener('click', async () => {
    if (!(state?.enabled || state?.signupOptInPending) || busy) return;
    const pendingOnly = state.signupOptInPending && !state.enabled;
    const question = pendingOnly
      ? 'Cancel the Personal Intelligence opt-in saved at sign-up? Viora will not start discovery if you later verify this email.'
      : 'Turn off Personal Intelligence discovery? Viora will stop any running search and stop using this profile in AI requests. Your saved findings will remain until you delete them.';
    if (!confirm(question)) return;
    busy = true;
    $('#pi-memory-disable').disabled = true;
    try { state = await call('/api/intel/consent', 'POST', { enable: false }); if (stopWatching) { stopWatching(); stopWatching = null; } render(); setStatus(pendingOnly ? 'The pending sign-up opt-in was cancelled.' : 'Discovery is off. Your saved profile remains available to review or delete.'); }
    catch (error) { setStatus(error.message, true); }
    finally { busy = false; $('#pi-memory-disable').disabled = false; }
  });
  const autoBox = $('#pi-memory-auto-approve');
  if (autoBox) autoBox.addEventListener('change', async () => {
    if (busy || !state?.enabled || !state?.emailVerified) { autoBox.checked = state?.autoApproveStrong === true; return; }
    busy = true; autoBox.disabled = true;
    try { state = await call('/api/intel/settings', 'POST', { autoApproveStrong: autoBox.checked }); render(); }
    catch (error) { autoBox.checked = state?.autoApproveStrong === true; setStatus(error.message, true); }
    finally { busy = false; autoBox.disabled = false; }
  });
  const open = $('#mem');
  if (open) open.addEventListener('click', load);
  // Display only: the server already queued and runs the first discovery, whether or not this page was ever opened.
  load();
})();
