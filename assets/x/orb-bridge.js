/* Connects the Viora orb to the activity the app already reports. Nothing here invents activity.
   Sources of truth (all written by app.html + think.js from real events):
     #send[aria-label="Stop"]            a reply is in flight
     .vt[data-phase]  think | write      waiting for the model | answer text is streaming
     .vt-step[data-st=active] data-h     the step that is really running ("search|Searching the web|…")
     .vt[data-out]    failed | stopped   how the reply ended
     #hz-run.is-stop / #hz-output        the same, for the Humanizer studio
     #input focus + text                 the person is typing
   Expressions: typing → listening · waiting for the model → thinking · searching → eyes sweep side to side ·
   answer streaming → speaking (pulsed by each real chunk) · reply finished → happy · failed → concerned. */
import { Orb, restingState } from './viora-orb.js';

const $ = s => document.querySelector(s);
const mounted = new Set();
let prevBusy = false, settling = 0, raf = 0;

function place() {
  for (const o of [...mounted]) if (!o.host.isConnected) { o.destroy(); mounted.delete(o); }
  const bar = $('#sh-center .bar-id');
  if (bar && !bar.querySelector('.v-orb-bar')) {
    const h = document.createElement('span'); h.className = 'v-orb-bar'; bar.insertBefore(h, bar.querySelector('.wordmark') || null);
    mounted.add(Orb.mount(h));
  }
  const stage = $('#thread .welcome-v2 .logo-stage');
  if (stage && !stage.querySelector('.v-orb-hero')) {
    const h = document.createElement('span'); h.className = 'v-orb-hero'; stage.append(h);
    mounted.add(Orb.mount(h));
  }
}

const busyNow = () => $('#send')?.getAttribute('aria-label') === 'Stop' || !!$('#hz-run.is-stop');
const lastVt = () => { const m = document.querySelectorAll('#thread .msg.assistant'); return m.length ? m[m.length - 1].querySelector('.vt') : null; };

function liveState() {
  if ($('#hz-run.is-stop')) return $('#hz-output')?.value.trim() ? 'responding' : 'thinking';
  const vt = lastVt();
  if (!vt) return 'thinking';
  if (vt.dataset.phase === 'write') return 'responding';
  const kind = ($('#thread .msg.assistant:last-of-type .vt-step[data-st="active"]')?.dataset.h || '').split('|')[0];
  return kind === 'search' || kind === 'sources' ? 'searching' : 'thinking';
}

function update() {
  raf = 0; place();
  const busy = busyNow();
  if (busy) {
    clearTimeout(settling); settling = 0;
    const live = liveState(); Orb.set(live);
    if (live === 'responding') Orb.pulse(.45);       // update() runs as answer text really arrives, so each chunk nudges the talking animation
  }
  else if (prevBusy) {
    /* The reply just ended. Give the thread one beat to render its final outcome, then show it. */
    clearTimeout(settling);
    settling = setTimeout(() => { settling = 0; const out = lastVt()?.dataset.out; Orb.set(out === 'failed' ? 'error' : out === 'stopped' ? 'idle' : 'done'); }, 160);
  } else if (!settling) {
    /* Typing = listening. An error and the short happy beat after a finished reply are left to finish on their own. */
    const i = $('#input'), next = restingState(Orb.get(), !!(i && document.activeElement === i && i.value.trim()));
    if (next) Orb.set(next);
  }
  prevBusy = busy;
}
const queue = () => { if (!raf) raf = requestAnimationFrame(update); };

function init() {
  if (!$('#thread') || !$('#composer')) return;
  const mo = new MutationObserver(queue);
  mo.observe($('#thread'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase', 'data-out', 'data-st', 'data-h'] });
  const send = $('#send'); if (send) mo.observe(send, { attributes: true, attributeFilter: ['aria-label'] });
  const hz = $('#humanizer-studio'); if (hz) mo.observe(hz, { subtree: true, attributes: true, attributeFilter: ['class'] });
  const input = $('#input'); if (input) ['input', 'focus', 'blur'].forEach(ev => input.addEventListener(ev, queue));
  update();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
