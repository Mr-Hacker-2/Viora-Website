/* Shared Personal Intelligence UI pieces: the live discovery progress view and the finding card.
   Everything shown here comes from the server (GET /api/intel/discovery). Nothing is simulated: no fake percentages, no animated
   guesses. Step states are exactly what the server's job reports, and the page only polls to display them; the search itself keeps
   running on the server whether or not any page is open. All text from the server is written with textContent. */
(function (root) {
  'use strict';
  const STAGE_LABEL = { pending: 'Waiting', running: 'In progress', waiting: 'Retrying automatically', done: 'Done', failed: 'Failed', skipped: 'Not used' };
  const SOURCE_LABEL = { ok: 'Succeeded', failed: 'Failed', unavailable: 'Unavailable', not_configured: 'Not configured', waiting: 'Retrying automatically', running: 'Searching', pending: 'Waiting' };
  const CONFIDENCE = { strong: 'Strong match', possible: 'Possible match', uncertain: 'Uncertain' };

  const isActive = discovery => !!(discovery && discovery.active);

  /** Plain data model for the progress area (also what the tests check). */
  function describe(discovery) {
    const job = discovery && (discovery.active || discovery.latest);
    if (!job) return { state: 'idle', headline: '', detail: '', stages: [], sources: [], resultsReady: false, summary: null };
    const state = job.active ? 'active' : job.status === 'failed' ? 'failed' : job.status === 'cancelled' ? 'stopped' : 'done';
    let headline;
    if (job.status === 'queued') headline = job.waitingForStart ? 'Queued' : 'Starting discovery';
    else if (job.status === 'running') headline = 'Discovery is running on the server';
    else if (job.status === 'waiting') headline = 'Retrying some sources automatically';
    else if (job.status === 'succeeded') headline = 'Discovery finished';
    else if (job.status === 'partial') headline = 'Discovery finished with some sources unavailable';
    else if (job.status === 'failed') headline = 'No public source could be reached';
    else headline = 'Discovery was stopped';
    return {
      state, headline, detail: job.message || '',
      stages: (job.stages || []).map(s => ({ id: s.id, label: s.label, status: s.status, statusLabel: STAGE_LABEL[s.status] || s.status })),
      sources: (job.sources || []).map(s => ({ id: s.id, label: s.label, status: s.status, statusLabel: SOURCE_LABEL[s.status] || s.status, count: s.count || 0, attempts: s.attempts || 0, detail: s.detail || '', nextAttemptAt: s.nextAttemptAt || null })),
      resultsReady: job.unseen === true, summary: job.summary || null, finishedAt: job.finishedAt || null
    };
  }

  const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };

  /** Draw the progress area into `container`. Hidden when there is nothing to show. */
  function render(container, discovery, { showFinished = true } = {}) {
    const m = describe(discovery);
    container.replaceChildren();
    container.hidden = m.state === 'idle' || (!showFinished && m.state !== 'active');
    if (container.hidden) return m;
    container.dataset.state = m.state;
    const head = node('div', 'pi-progress-head');
    head.append(node('strong', '', m.headline));
    if (m.state === 'active') head.append(node('span', 'pi-progress-note', 'You can close this page; it keeps going.'));
    container.append(head);
    if (m.detail && m.state !== 'active') container.append(node('p', 'pi-progress-detail', m.detail));
    const steps = node('ol', 'pi-steps');
    for (const s of m.stages) {
      const li = node('li', 'pi-step'); li.dataset.status = s.status;
      li.append(node('span', 'pi-step-dot')); li.append(node('span', 'pi-step-label', s.label)); li.append(node('span', 'pi-step-status', s.statusLabel));
      steps.append(li);
    }
    container.append(steps);
    const sourceRows = m.sources.filter(s => s.status !== 'pending');
    if (sourceRows.length) {
      const list = node('ul', 'pi-sources');
      for (const s of sourceRows) {
        const li = node('li', 'pi-source'); li.dataset.status = s.status;
        li.append(node('b', '', s.label), node('span', 'pi-source-status', s.statusLabel + (s.status === 'ok' ? ' · ' + s.count + ' result' + (s.count === 1 ? '' : 's') : '')));
        if (s.detail && s.status !== 'ok') li.append(node('span', 'pi-source-detail', s.detail));
        list.append(li);
      }
      container.append(list);
    }
    if (m.state === 'done' && m.summary) container.append(node('p', 'pi-progress-detail', m.summary.newFindings ? m.summary.newFindings + ' new finding' + (m.summary.newFindings === 1 ? '' : 's') + ' to review below.' : 'No new findings this time.'));
    return m;
  }

  /** Poll the server for progress while a job is active. Only displays server state; stopping this never stops the search. */
  function watch({ fetchStatus, onUpdate, intervalMs = 2500 }) {
    let stopped = false, timer = null, was = null;
    const tick = async () => {
      if (stopped) return;
      let d = null;
      try { d = await fetchStatus(); } catch { d = null; }
      if (stopped) return;
      if (d) { onUpdate(d, was); was = isActive(d); }
      if (d && !isActive(d)) { stopped = true; return; }
      timer = setTimeout(tick, document.hidden ? intervalMs * 3 : intervalMs);
    };
    tick();
    return () => { stopped = true; clearTimeout(timer); };
  }

  /** One finding with approve / not me / edit / delete. `act` performs the server call; `categories` feeds the editor. */
  function findingCard(f, { act, categories = [], compact = false }) {
    const btn = (text, cls, fn) => { const b = node('button', 'btn ' + cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const tags = node('div', 'pi-tags');
    tags.append(node('span', 'pi-tag ' + f.confidence, CONFIDENCE[f.confidence] || 'Uncertain'));
    for (const s of (f.sources && f.sources.length ? f.sources : [f.source])) tags.append(node('span', 'pi-tag', s));
    if (f.isNew) tags.append(node('span', 'pi-tag new', 'New'));
    if (f.autoApproved) tags.append(node('span', 'pi-tag auto-approved', 'Auto-approved'));
    if (f.status === 'approved' && !f.autoApproved) tags.append(node('span', 'pi-tag approved', 'Approved'));
    const card = node('article', 'pi-f'); card.dataset.status = f.status;
    const link = node('a', '', f.title || f.url); link.href = f.url; link.target = '_blank'; link.rel = 'noopener noreferrer nofollow';
    card.append(tags, link, node('span', 'url', f.url));
    if (f.snippet && !compact) card.append(node('p', 'snip', f.snippet));
    card.append(node('p', 'basis', 'Why this was found: ' + f.matchBasis));
    const would = node('p', 'basis', f.facts.length ? (f.status === 'approved' ? 'Added to your profile: ' : 'Would add: ') + f.facts.map(x => x.text).slice(0, 6).join(' · ') + (f.facts.length > 6 ? ' …' : '') : 'No profile details come from this source.');
    card.append(would);
    const acts = node('div', 'acts');
    if (f.status !== 'approved') acts.append(btn('Approve', 'btn-primary', () => act('approve', f)));
    if (f.autoApproved) acts.append(btn('Undo', 'btn-ghost', () => act('pending', f)));
    if (f.status !== 'rejected') acts.append(btn('Not me', 'btn-ghost', () => act('reject', f)));
    acts.append(btn('Edit', 'btn-ghost', () => openEditor()));
    acts.append(btn('Delete', 'btn-ghost', () => act('delete', f)));
    card.append(acts);

    function openEditor() {
      if (card.querySelector('.pi-edit')) return;
      const box = node('div', 'pi-edit');
      box.append(node('p', 'basis', 'Change what this finding adds to your profile. Remove anything that is not right.'));
      const rows = node('div', 'pi-edit-rows');
      const addRow = fact => {
        const row = node('div', 'pi-edit-row');
        const sel = node('select'); sel.setAttribute('aria-label', 'Category');
        for (const c of categories) { const o = node('option', '', c.label); o.value = c.id; if (c.id === fact.category) o.selected = true; sel.append(o); }
        const input = node('input'); input.type = 'text'; input.maxLength = 200; input.value = fact.text; input.setAttribute('aria-label', 'Detail');
        const rm = btn('Remove', 'btn-ghost', () => row.remove());
        row.append(sel, input, rm); rows.append(row);
      };
      for (const fact of f.facts) addRow(fact);
      const save = btn('Save changes', 'btn-primary', () => {
        const facts = [...rows.children].map(r => ({ category: r.querySelector('select').value, text: r.querySelector('input').value.trim() })).filter(x => x.text);
        act('edit', f, facts);
      });
      box.append(rows, node('div', 'acts'));
      box.lastChild.append(btn('Add a detail', 'btn-ghost', () => addRow({ category: categories[0]?.id || 'topics', text: '' })), save, btn('Cancel', 'btn-ghost', () => box.remove()));
      card.append(box);
    }
    return card;
  }

  root.VioraIntelProgress = { describe, render, watch, findingCard, isActive };
})(globalThis);
