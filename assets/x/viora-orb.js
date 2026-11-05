/* viora-orb.js — the living Viora orb. No dependencies.
   import { Orb } from './assets/x/viora-orb.js';
   const hero = Orb.mount(el, {});   // any number of instances, all kept in sync
   Orb.set('thinking');              // idle | listening | thinking | searching | responding | error | done
   'done' plays a short completion bloom and settles to idle. Leaving thinking/searching/responding for idle does the same.
   Also sets <html data-orb="state"> so the rest of the UI can react to the same state. */

const COL = { violet: [124, 92, 255], blue: [58, 160, 255], deep: [20, 12, 52], magenta: [190, 110, 255], warn: [255, 150, 90], white: [255, 255, 255] };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const TAU = Math.PI * 2;

/* e energy · s motion speed · b breathing depth · r expanding rings · p particles · a rotating arcs · w warning tint */
const STATES = {
  idle:       { e: .38, s: .22, b: .045, r: 0,  p: 0,   a: 0, w: 0 },
  listening:  { e: .58, s: .45, b: .06,  r: .8, p: .12, a: 0, w: 0 },
  thinking:   { e: .88, s: 1.5, b: .09,  r: 0,  p: 1,   a: 0, w: 0 },
  searching:  { e: .78, s: 1.0, b: .05,  r: 0,  p: .3,  a: 1, w: 0 },
  responding: { e: 1,   s: .85, b: .12,  r: 1.4, p: .45, a: 0, w: 0 },
  error:      { e: .26, s: .14, b: .03,  r: 0,  p: 0,   a: 0, w: 1 }
};
const LABEL = { idle: 'idle', listening: 'listening', thinking: 'thinking', searching: 'searching', responding: 'responding', error: 'showing an error' };
const BUSY = ['thinking', 'searching', 'responding'];

const CSS = `.v-orb{position:relative;display:block;aspect-ratio:1;flex:none}.v-orb canvas{display:block;width:100%;height:100%}`;

const instances = new Set();
let current = 'idle', errTimer = 0;

function make(host, opts = {}) {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  host.classList.add('v-orb'); host.setAttribute('role', 'img'); host.append(cv);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const cur = { ...STATES.idle }; let target = STATES.idle, state = 'idle';
  let px = 0, dpr = 1, t = 0, ph = 0, ringT = 0, flash = 0, last = 0, raf = 0, vis = true;
  const parts = Array.from({ length: 18 }, () => ({ a: Math.random() * TAU, rf: 1.18 + Math.random() * .7, sp: (.4 + Math.random() * .8) * (Math.random() < .5 ? -1 : 1) }));

  const fit = () => { px = host.clientWidth || opts.size || 96; dpr = Math.min(devicePixelRatio || 1, 2); cv.width = cv.height = Math.round(px * dpr); };

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, px, px);
    const c = px / 2, e = Math.min(1.2, cur.e + flash * .5), R = px * .24 * (1 + cur.b * Math.sin(ph) + flash * .06);
    const v = mix(COL.violet, COL.warn, cur.w * .7), bl = mix(COL.blue, COL.warn, cur.w * .35), mg = mix(COL.magenta, COL.warn, cur.w * .5);
    let g = ctx.createRadialGradient(c, c, R * .6, c, c, R * 2.1);
    g.addColorStop(0, rgba(v, .38 * e)); g.addColorStop(.5, rgba(bl, .12 * e)); g.addColorStop(1, rgba(bl, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, px, px);
    if (cur.r > .02) for (let i = 0; i < 3; i++) {
      const p = (ringT + i / 3) % 1;
      ctx.beginPath(); ctx.arc(c, c, R * (1.05 + p * .85), 0, TAU);
      ctx.strokeStyle = rgba(bl, (1 - p) * (1 - p) * .38 * Math.min(1, cur.r)); ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.clip();
    g = ctx.createRadialGradient(c - R * .3, c - R * .35, R * .1, c, c, R);
    g.addColorStop(0, rgba(mix(v, COL.white, .25), 1)); g.addColorStop(.55, rgba(v, 1)); g.addColorStop(1, rgba(COL.deep, 1));
    ctx.fillStyle = g; ctx.fillRect(c - R, c - R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = 'lighter';
    [[v, .9, 0], [bl, 1.3, 2.1], [mg, .7, 4.2]].forEach(([col, sp, p0], i) => {
      const x = c + Math.cos(t * sp + p0) * R * .42, y = c + Math.sin(t * sp * 1.13 + p0) * R * .42, r = R * (.55 + .12 * Math.sin(t * 1.7 + i));
      const bg = ctx.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, rgba(col, .55 * e)); bg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = bg; ctx.fillRect(c - R, c - R, 2 * R, 2 * R);
    });
    ctx.restore();
    ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.strokeStyle = rgba(mix(bl, COL.white, .4), .35); ctx.lineWidth = 1; ctx.stroke();
    if (cur.p > .02) {
      ctx.fillStyle = rgba(mix(bl, COL.white, .55), 1);
      for (const P of parts) {
        const a = P.a + t * P.sp * 1.2, rad = R * P.rf + Math.sin(t * 2 + P.a) * R * .06;
        ctx.globalAlpha = Math.min(1, cur.p) * (.35 + .65 * Math.abs(Math.sin(t * 1.5 + P.a * 3)));
        ctx.beginPath(); ctx.arc(c + Math.cos(a) * rad, c + Math.sin(a) * rad, Math.max(.6, px * .006), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (cur.a > .02) {
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, px * .012);
      for (const [rf, len, dir, col] of [[1.28, 1.3, 1, bl], [1.5, .7, -1, v]]) {
        const a0 = t * 1.6 * dir;
        ctx.beginPath(); ctx.arc(c, c, R * rf, a0, a0 + len);
        ctx.strokeStyle = rgba(col, .85 * cur.a); ctx.shadowColor = rgba(col, .9); ctx.shadowBlur = 8; ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  }

  function step(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 4.5);                       // ~0.25 s eased transitions between states
    for (const key in cur) cur[key] += (target[key] - cur[key]) * k;
    flash *= Math.exp(-dt * 2.2);
    t += dt * cur.s; ph += dt * (1.2 + cur.s * 2.2); ringT += dt * (.3 + cur.r * .5);
    draw();
  }
  const loop = now => { step(now); raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf && vis && !document.hidden && !reduce.matches) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  const api = {
    host,
    set(s) {
      let bloom = false;
      if (s === 'done') { if (state === 'error') return; s = 'idle'; bloom = true; }
      if (!STATES[s]) s = 'idle';
      if (s === 'idle' && BUSY.includes(state)) bloom = true;
      if (bloom) flash = 1;
      state = s; target = STATES[s]; host.dataset.state = s; host.setAttribute('aria-label', 'Viora is ' + LABEL[s]);
      if (reduce.matches) { Object.assign(cur, target); draw(); } else start();
    },
    destroy() { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); instances.delete(api); cv.remove(); }
  };
  const onVis = () => (document.hidden ? stop() : start());
  const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; vis ? start() : stop(); });
  const ro = new ResizeObserver(() => { fit(); draw(); });
  io.observe(host); ro.observe(host); document.addEventListener('visibilitychange', onVis);
  fit(); api.set(current); Object.assign(cur, target); draw();
  return api;
}

export const Orb = {
  mount(host, opts) {
    if (!document.getElementById('viora-orb-css')) { const s = document.createElement('style'); s.id = 'viora-orb-css'; s.textContent = CSS; document.head.append(s); }
    const o = make(host, opts); instances.add(o); return o;
  },
  set(s) {
    if (s === 'done') { if (current === 'error') return; } else if (!STATES[s]) s = 'idle';
    clearTimeout(errTimer);
    if (s === 'error') errTimer = setTimeout(() => Orb.set('idle'), 6000);   // an error settles back by itself
    current = s === 'done' ? 'idle' : s;
    document.documentElement.dataset.orb = current;
    instances.forEach(o => o.set(s));
  },
  get: () => current
};
