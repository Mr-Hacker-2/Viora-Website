/* Viora web app — the thinking panel.

   A small, honest activity trace for one assistant reply. app.html records a step only at the moment
   something REALLY happens (files are being processed, the request is sent, the server reports sources,
   the first token arrives…). Nothing here invents activity, and nothing here carries the model's
   private reasoning: a step is a short label, an optional factual detail and a timestamp.

   - createTrace / begin / note / end / detail / finish : the data model (plain JSON, safe to save with the chat)
   - thinkHtml                                           : first render of the panel for one message
   - sync                                                : in-place update, so animations and the expand
                                                           transition keep running while the thread re-renders
   - startTicker / stopTicker                            : one shared 1 s timer for the elapsed time while a reply is live

   Styling lives in viora-think.css. */

const MAX_STEPS = 14;
const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- data model ---------- */
export function createTrace(now = Date.now()) { return { v: 1, t0: now, t1: null, out: null, steps: [] }; }
const activeStep = tr => { for (let i = tr.steps.length - 1; i >= 0; i--) if (tr.steps[i].st === 'active') return tr.steps[i]; return null; };
export const current = activeStep;
const closeActive = (tr, now, st = 'done') => { const a = activeStep(tr); if (a) { a.e = Math.max(a.s, now - tr.t0); a.st = st; } return a; };

/* Start a step. The previous active step is closed (the timeline is linear). Beginning the step that is already
   active only refreshes its detail, so repeated events never stack duplicate rows. */
export function begin(tr, k, label, detail = '', opts = {}, now = Date.now()) {
  if (!tr || tr.t1 != null) return null;
  const a = activeStep(tr);
  if (a && a.k === k && a.l === label) { if (detail) a.d = clip(detail, 140); return a; }
  closeActive(tr, now);
  const step = { k, l: clip(label, 60), d: clip(detail, 140), s: Math.max(0, now - tr.t0), e: null, st: 'active' };
  if (opts.tool) step.tool = 1;
  tr.steps.push(step);
  if (tr.steps.length > MAX_STEPS) tr.steps.splice(0, tr.steps.length - MAX_STEPS);
  return step;
}
/* A step that is already finished when it is recorded (a server event that reports a result).
   opts.dur is a duration the SERVER reported; it is shown labelled as such. */
export function note(tr, k, label, detail = '', opts = {}, now = Date.now()) {
  if (!tr || tr.t1 != null) return null;
  let s;
  if (opts.keep) { /* record a result without ending the step that is running (e.g. a review notice while the answer streams) */
    s = { k, l: clip(label, 60), d: clip(detail, 140), s: Math.max(0, now - tr.t0), e: null, st: 'done' };
    if (opts.tool) s.tool = 1;
    tr.steps.push(s); if (tr.steps.length > MAX_STEPS) tr.steps.splice(0, tr.steps.length - MAX_STEPS);
  } else { s = begin(tr, k, label, detail, opts, now); if (!s) return null; }
  s.e = s.s; s.st = 'done'; if (Number.isFinite(opts.dur) && opts.dur >= 0) s.dm = Math.round(opts.dur);
  return s;
}
/* Close the active step if it has this key. */
export function end(tr, k, detail, now = Date.now(), st = 'done') {
  const a = tr && activeStep(tr); if (!a || a.k !== k) return null;
  if (detail) a.d = clip(detail, 140);
  return closeActive(tr, now, st);
}
/* Refresh the detail of the active step (only when it has this key). */
export function detail(tr, k, text) { const a = tr && activeStep(tr); if (a && a.k === k && a.d !== clip(text, 140)) { a.d = clip(text, 140); return true; } return false; }
/* The reply is over. out: 'done' | 'stopped' | 'failed'. Whatever was running is closed with that outcome. */
export function finish(tr, out = 'done', now = Date.now()) {
  if (!tr || tr.t1 != null) return;
  closeActive(tr, now, out === 'done' ? 'done' : out);
  tr.t1 = now; tr.out = out;
}

/* ---------- formatting ---------- */
export function fmtDur(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 950) return Math.max(0.1, Math.round(ms / 100) / 10).toFixed(1) + 's';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const s = Math.round(ms / 1000); return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
}
export const elapsed = (tr, now = Date.now()) => Math.max(0, (tr.t1 != null ? tr.t1 : now) - tr.t0);
/* think = waiting, no answer text yet · write = the answer is streaming in · done = finished (any outcome) */
export const phaseOf = (live, hasContent) => !live ? 'done' : hasContent ? 'write' : 'think';

function titleFor(tr, phase) {
  if (phase === 'think') return 'Viora is thinking…';
  if (phase === 'write') return 'Writing your answer';
  const t = fmtDur(elapsed(tr));
  return tr.out === 'stopped' ? 'Stopped after ' + t : tr.out === 'failed' ? 'Stopped by an error after ' + t : 'Worked for ' + t;
}
function statusFor(tr, phase) {
  const a = activeStep(tr);
  if (phase === 'think') return a ? a.l : 'Getting started';
  const n = tr.steps.length;
  if (phase === 'write') return n + (n === 1 ? ' step' : ' steps') + ' so far · tap for details';
  return n + (n === 1 ? ' step' : ' steps') + ' · tap for details';
}

/* ---------- markup ---------- */
const P = {
  understand: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  files: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  code: '<path d="M8.5 8L4 12l4.5 4M15.5 8L20 12l-4.5 4M13.5 5.5l-3 13"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3L16 12l4 4"/>',
  video: '<rect x="3.5" y="5.5" width="12" height="13" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3"/>',
  audio: '<path d="M5 9v6M9 6v12M13 9v6M17 4v16M21 10v4"/>',
  connect: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  sources: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.100-3.800 8.500c-2.600-2.400-3.800-5.200-3.800-8.500S9.400 5.900 12 3.500z"/>',
  analyze: '<path d="M12 3.5l8.5 4.5-8.5 4.500L3.500 8z"/><path d="M3.500 12.500L12 17l8.500-4.500M3.500 16.500L12 21l8.500-4.500"/>',
  refine: '<path d="M20 11a8 8 0 00-14.500-4M4 5v3.500h3.500M4 13a8 8 0 0014.500 4M20 19v-3.500h-3.500"/>',
  review: '<path d="M12 3l7.500 3v5.500c0 4.500-3 8-7.500 9.500-4.500-1.500-7.500-5-7.500-9.500V6z"/><path d="M8.800 12.200l2.400 2.400 4.200-4.600"/>',
  write: '<path d="M4 20l1-4L16.500 4.500a2.100 2.100 0 013 3L8 19z"/><path d="M14.500 6.500l3 3"/>',
  prepare: '<path d="M4 12h3l2.500-6 4 12 2.500-6H20"/>'
};
const ico = k => '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[k] || P.understand) + '</svg>';
const STATE = {
  done: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.500"/></svg>',
  failed: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4.500 4.500l7 7M11.500 4.500l-7 7"/></svg>',
  stopped: '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="4.500" y="4.500" width="7" height="7" rx="1.500"/></svg>',
  active: ''
};
const CHEV = '<svg class="vt-chev" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.500l4 4 4-4"/></svg>';
const PARTICLES = [[0, 21, 5.2, 0], [62, 17, 6.4, -1.3], [118, 23, 7.1, -2.6], [181, 18, 5.8, -0.7], [243, 22, 6.8, -3.4], [305, 16, 7.6, -4.1]]
  .map(([a, d, s, dl]) => `<i style="--a:${a}deg;--d:${d}px;--s:${s}s;--dl:${dl}s"></i>`).join('');

/* One row. A running step shows only when it started (its length is shown once it is finished), so a row's
   markup changes only when something real changed and the list never re-renders on the 1 s timer. */
const stepKey = s => [s.k, s.l, s.d, s.st, s.s, s.e, s.dm].join('|');
function stepHtml(tr, s) {
  const time = s.dm != null ? fmtDur(s.dm) + ' · server' : s.e != null ? fmtDur(s.e - s.s) : '';
  const clock = new Date(tr.t0 + s.s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  return `<li class="vt-step" data-st="${esc(s.st)}" data-h="${esc(stepKey(s))}"><span class="vt-step-ic" aria-hidden="true">${ico(s.k)}</span>`
    + `<span class="vt-step-main"><span class="vt-step-l">${esc(s.l)}${s.tool ? '<em class="vt-tool">Tool</em>' : ''}</span>${s.d ? `<span class="vt-step-d">${esc(s.d)}</span>` : ''}</span>`
    + `<span class="vt-step-t" title="${esc(clock)}"><b>+${esc(fmtDur(s.s))}</b>${time ? `<span>${esc(time)}</span>` : ''}</span>`
    + `<span class="vt-step-s" aria-hidden="true">${STATE[s.st] || ''}</span></li>`;
}
const stepsHtml = tr => tr.steps.map(s => stepHtml(tr, s)).join('');

/* Full panel for one message. id is the element id (also used for aria-controls). */
export function thinkHtml(tr, o = {}) {
  const phase = o.phase || 'done', open = !!o.open, id = o.id || 'vt', now = o.now || Date.now();
  return `<div class="vt" id="${esc(id)}" data-phase="${phase}" data-open="${open ? 1 : 0}" data-out="${esc(tr.out || '')}" style="--vt-el:${Math.round(elapsed(tr, now))}ms">`
    + `<button type="button" class="vt-head" data-vt-toggle aria-expanded="${open}" aria-controls="${esc(id)}-p">`
    + `<span class="vt-orb" aria-hidden="true"><span class="vt-halo"></span><span class="vt-ring"></span><span class="vt-core"></span>${PARTICLES}</span>`
    + `<span class="vt-copy"><span class="vt-title">${esc(titleFor(tr, phase))}</span><span class="vt-status" role="status" aria-live="polite">${esc(statusFor(tr, phase))}</span></span>`
    + `<span class="vt-wave" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></span>`
    + `<span class="vt-time" aria-hidden="true">${esc(fmtDur(elapsed(tr, now)))}</span>${CHEV}</button>`
    + `<div class="vt-panel" id="${esc(id)}-p"${open ? '' : ' inert'}><div class="vt-panel-in"><ol class="vt-steps">${stepsHtml(tr)}</ol>`
    + `<p class="vt-foot">Short processing steps and real tool activity only. Viora does not show its private reasoning.</p></div></div></div>`;
}

/* Update an existing panel without rebuilding it (keeps the orb animation and the expand transition alive). */
export function sync(root, tr, o = {}) {
  if (!root || !tr) return;
  const phase = o.phase || 'done', open = !!o.open, now = o.now || Date.now();
  if (root.dataset.phase !== phase) root.dataset.phase = phase;
  const msg = root.closest('.msg'); if (msg) msg.classList.toggle('thinking', phase === 'think');
  if (root.dataset.out !== (tr.out || '')) root.dataset.out = tr.out || '';
  const wantOpen = open ? '1' : '0';
  if (root.dataset.open !== wantOpen) {
    root.dataset.open = wantOpen;
    const head = root.querySelector('.vt-head'), panel = root.querySelector('.vt-panel');
    if (head) head.setAttribute('aria-expanded', String(open));
    if (panel) { if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', ''); }
  }
  const set = (sel, text, swap) => {
    const el = root.querySelector(sel); if (!el || el.textContent === text) return;
    el.textContent = text;
    if (swap) { el.classList.remove('vt-swap'); void el.offsetWidth; el.classList.add('vt-swap'); } /* restart the small slide-in */
  };
  set('.vt-title', titleFor(tr, phase)); set('.vt-status', statusFor(tr, phase), phase === 'think'); set('.vt-time', fmtDur(elapsed(tr, now)));
  const list = root.querySelector('.vt-steps');
  if (list) {
    /* Reconcile row by row: only a changed row is replaced, and only a brand-new row plays its entrance. */
    const rows = [...list.children];
    tr.steps.forEach((s, i) => {
      const key = stepKey(s), row = rows[i];
      if (row && row.dataset.h === key) return;
      const t = document.createElement('template'); t.innerHTML = stepHtml(tr, s);
      const li = t.content.firstElementChild;
      if (row) row.replaceWith(li); else { li.classList.add('vt-new'); list.appendChild(li); }
    });
    for (let i = rows.length - 1; i >= tr.steps.length; i--) rows[i].remove();
  }
}

/* ---------- one shared timer ---------- */
let timer = 0, paused = false, tickFn = null;
/* Idempotent: calling it again only swaps the callback, so there is never more than one timer. */
export function startTicker(tick) {
  tickFn = tick;
  if (timer) return;
  timer = setInterval(() => { if (!paused && tickFn) { try { tickFn(); } catch { /* a failed tick must never break the reply */ } } }, 1000);
}
export function stopTicker() { if (timer) { clearInterval(timer); timer = 0; } tickFn = null; }
export const tickerRunning = () => !!timer;
/* Animations stop while the tab is hidden (nothing is visible, so no CPU is spent on them). */
if (typeof document !== 'undefined' && !document.__vtVis) {
  document.__vtVis = true;
  document.addEventListener('visibilitychange', () => { paused = document.hidden; document.documentElement.classList.toggle('vt-paused', document.hidden); });
}
