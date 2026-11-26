/* Shows the user's server-stored, approved public-footprint profile inside About you & Memory.
   All data is fetched through the signed-in user's own /api/intel session. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const panel = $('#pi-memory');
  if (!panel) return;
  let state = null, busy = false;
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
  function render() {
    if (!state) return;
    const total = Object.values(state.profile || {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
    const pending = (state.findings || []).filter(f => f.status === 'pending').length;
    const autoApproved = (state.findings || []).filter(f => f.autoApproved === true && f.status === 'approved').length;
    const autoBox = $('#pi-memory-auto-approve'); if (autoBox) { autoBox.checked = state.autoApproveStrong === true; autoBox.disabled = !state.enabled || !state.emailVerified; }
    const pill = $('#pi-memory-state');
    pill.textContent = state.enabled ? 'Discovery on' : 'Discovery off';
    pill.dataset.enabled = String(state.enabled);
    $('#pi-memory-disable').hidden = !(state.enabled || state.signupOptInPending);
    $('#pi-memory-disable').textContent = state.signupOptInPending && !state.enabled ? 'Cancel pending opt-in' : 'Turn off discovery';
    if (!state.emailVerified) {
      setStatus(state.signupOptInPending
        ? 'You opted in at sign-up, but discovery is paused until you verify this email with Google. You can cancel that pending opt-in here.'
        : 'Verify ownership of this email with Google before discovery can run. Your existing profile, if any, remains private.');
    } else if (state.enabled) {
      const last = state.lastRunAt ? ' Last discovery: ' + new Date(state.lastRunAt).toLocaleString() + '.' : '';
      setStatus(total + ' approved profile detail' + (total === 1 ? '' : 's') + ' · ' + pending + ' finding' + (pending === 1 ? '' : 's') + ' waiting for review · ' + autoApproved + ' auto-approved.' + last + ' Viora uses only relevant approved details in normal chats.' + (state.discoveryPending ? ' The first search has not reached a public source yet; it remains queued and will retry when you open this panel again.' : ''));
    } else {
      setStatus(total ? total + ' approved profile detail' + (total === 1 ? '' : 's') + ' saved. Discovery is off, so Viora is not using this profile in AI requests.' : 'Discovery is off. Nothing from public discovery is being added to your profile.');
    }
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
    if (!shown) facts.append(node('p', 'pi-memory-empty', state.enabled ? 'No approved details yet. Review your pending findings in Personal Intelligence.' : 'No approved public-footprint details have been saved.'));
  }
  async function load() {
    if (busy) return;
    busy = true;
    $('#pi-memory-refresh').disabled = true;
    setStatus('Loading your private Personal Intelligence profile…');
    try {
      state = await call('/api/intel');
      render();
      if (state.enabled && state.discoveryPending) {
        setStatus('Your signup opt-in was saved. Running the first public-source discovery now…');
        state = await call('/api/intel/discover', 'POST', {});
      }
      render();
    } catch (error) {
      if (state) render();
      setStatus(error.message, true);
    } finally {
      busy = false;
      $('#pi-memory-refresh').disabled = false;
    }
  }
  $('#pi-memory-refresh').addEventListener('click', load);
  $('#pi-memory-disable').addEventListener('click', async () => {
    if (!(state?.enabled || state?.signupOptInPending) || busy) return;
    const pendingOnly = state.signupOptInPending && !state.enabled;
    const question = pendingOnly
      ? 'Cancel the Personal Intelligence opt-in saved at sign-up? Viora will not start discovery if you later verify this email.'
      : 'Turn off Personal Intelligence discovery? Viora will stop searching and stop using this profile in AI requests. Your saved findings will remain until you delete them.';
    if (!confirm(question)) return;
    busy = true;
    $('#pi-memory-disable').disabled = true;
    try { state = await call('/api/intel/consent', 'POST', { enable: false }); render(); setStatus(pendingOnly ? 'The pending sign-up opt-in was cancelled.' : 'Discovery is off. Your saved profile remains available to review or delete.'); }
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
  // A signup opt-in is stored as a pending first run. Resolve it when the signed-in app opens.
  load();
})();
