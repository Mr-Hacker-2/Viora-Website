/* Sign-up questions popup.
   VioraOnboarding.ask(questions, save) shows one question at a time and resolves once `save(answers)` succeeds.
   `questions` come from the auth server: [{ id, title, hint?, multi, options: [{ id, label }] }].
   answers look like { use: ['code','study'], role: ['developer'], ... }.
   If `save` throws, the message is shown in the popup and the person can try again. All five are required. */
(() => {
  'use strict';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function ask(questions, save) {
    return new Promise((resolve) => {
      const answers = {};
      const total = questions.length;
      let i = 0, busy = false;
      const opener = document.activeElement;

      const overlay = el('div', 'ob-overlay');
      const dlg = el('div', 'ob-dialog');
      dlg.setAttribute('role', 'dialog');
      dlg.setAttribute('aria-modal', 'true');
      dlg.setAttribute('aria-labelledby', 'ob-title');
      overlay.appendChild(dlg);

      const step = el('span'), welcome = el('span', '', 'Welcome to Viora');
      const eyebrow = el('div', 'ob-eyebrow'); eyebrow.append(welcome, step);
      const bar = el('div', 'ob-bar'), fill = el('span'); bar.appendChild(fill);
      const title = el('h2', 'ob-title'); title.id = 'ob-title';
      const hint = el('p', 'ob-hint');
      const opts = el('div', 'ob-opts');
      const err = el('div', 'ob-err'); err.setAttribute('role', 'alert');
      const back = el('button', 'btn btn-ghost', 'Back'); back.type = 'button';
      const next = el('button', 'btn btn-primary'); next.type = 'button';
      const foot = el('div', 'ob-foot'); foot.append(back, next);
      dlg.append(eyebrow, bar, title, hint, opts, err, foot);

      const showErr = (m) => { err.textContent = m || ''; err.classList.toggle('show', !!m); };
      const q = () => questions[i];
      const chosen = (id) => (answers[q().id] || []).includes(id);

      function refresh() {
        const picked = answers[q().id] || [];
        [...opts.children].forEach((b) => b.setAttribute('aria-checked', String(picked.includes(b.dataset.id))));
        next.disabled = busy || !picked.length;
        back.disabled = busy;
        back.style.visibility = i === 0 ? 'hidden' : 'visible';
        next.textContent = busy ? 'Saving…' : i === total - 1 ? 'Finish' : 'Next';
      }

      function render(focusFirst) {
        const cur = q();
        step.textContent = `Question ${i + 1} of ${total}`;
        fill.style.width = `${((i + 1) / total) * 100}%`;
        title.textContent = cur.title;
        hint.textContent = cur.multi ? (cur.hint || 'Pick all that apply.') : 'Pick one.';
        opts.textContent = '';
        opts.setAttribute('role', cur.multi ? 'group' : 'radiogroup');
        opts.setAttribute('aria-labelledby', 'ob-title');
        for (const o of cur.options) {
          const b = el('button', 'ob-opt'); b.type = 'button'; b.dataset.id = o.id;
          b.setAttribute('role', cur.multi ? 'checkbox' : 'radio');
          b.append(el('span', 'ob-mark'), el('span', '', o.label));
          b.onclick = () => {
            if (busy) return;
            showErr('');
            const list = answers[cur.id] || [];
            answers[cur.id] = cur.multi ? (list.includes(o.id) ? list.filter((x) => x !== o.id) : [...list, o.id]) : [o.id];
            if (!answers[cur.id].length) delete answers[cur.id];
            refresh();
          };
          opts.appendChild(b);
        }
        refresh();
        if (focusFirst) (opts.querySelector('[aria-checked="true"]') || opts.firstChild).focus();
      }

      function close() {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        document.body.style.overflow = prevOverflow;
        try { opener && opener.focus && opener.focus(); } catch {}
      }

      back.onclick = () => { if (i > 0 && !busy) { i--; showErr(''); render(true); } };
      next.onclick = async () => {
        if (busy || !(answers[q().id] || []).length) return;
        if (i < total - 1) { i++; showErr(''); render(true); return; }
        busy = true; showErr(''); refresh();
        try { await save(answers); close(); resolve(answers); }
        catch (e) { busy = false; showErr((e && e.message) || 'Could not save your answers. Please try again.'); refresh(); }
      };

      // The popup is required, so Escape does nothing; Tab stays inside it.
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return; }
        if (e.key !== 'Tab') return;
        const f = [...dlg.querySelectorAll('button:not([disabled])')].filter((b) => b.style.visibility !== 'hidden');
        if (!f.length) return;
        const a = document.activeElement;
        if (e.shiftKey && (a === f[0] || !dlg.contains(a))) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (a === f[f.length - 1] || !dlg.contains(a))) { e.preventDefault(); f[0].focus(); }
      }

      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      render(true);
    });
  }

  window.VioraOnboarding = { ask };
})();
