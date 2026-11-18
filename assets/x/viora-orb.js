/* viora-orb.js — the living Viora orb, and Viora's face. No dependencies.
   import { Orb } from './assets/x/viora-orb.js';
   const hero = Orb.mount(el, {});   // any number of instances, all kept in sync
   Orb.set('thinking');              // idle | listening | thinking | searching | responding | happy | error | done
   'done' is a happy beat: a short completion bloom with cheerful eyes, then Viora settles to idle by herself.
   Leaving thinking/searching/responding for idle blooms the same way.
   Orb.pulse(n) gives the talking animation a nudge (the bridge calls it as answer text really arrives).
   Also sets <html data-orb="state"> so the rest of the UI can react to the same state.

   The eyes are drawn on the sphere's surface, not on top of it: each one sits at a point on the ball and is foreshortened
   and faded toward the rim as Viora turns to look, so they read as part of the orb. They blink on their own, follow the
   cursor (or a tap on a touch screen) a little, and wander when nobody is pointing at anything.
   Reduced motion: no loop at all. Viora holds a still pose for her state (forward gaze, eyes open, no blinking or floating). */

const COL = { violet: [124, 92, 255], blue: [58, 160, 255], deep: [20, 12, 52], magenta: [190, 110, 255], warn: [255, 150, 90], white: [255, 255, 255] };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ease = x => x * x * (3 - 2 * x);
const TAU = Math.PI * 2;

/* Body  e energy · s motion speed · b breathing depth · r expanding rings · p particles · a rotating arcs · w warning tint · fl floating
   Face  o eye openness · sm smile (eyes curve up) · tl worried tilt · sz eye size · gy gaze bias (− up, + down) · sc reading sweep
         cw how much the eyes follow the cursor · wd how much they wander · tk talking · eg eye glow · bm blink interval multiplier */
export const STATES = {
  idle:       { e: .38, s: .22, b: .045, r: 0,  p: 0,   a: 0, w: 0, fl: 1,   o: 1,   sm: 0,   tl: 0, sz: 1,    gy: 0,   sc: 0, cw: 1,   wd: 1,  tk: 0, eg: .85,  bm: 1 },
  listening:  { e: .58, s: .45, b: .06,  r: .8, p: .12, a: 0, w: 0, fl: .5,  o: 1.1, sm: 0,   tl: 0, sz: 1.06, gy: 0,   sc: 0, cw: 0,   wd: 0,  tk: 0, eg: 1,    bm: 1.4 },
  thinking:   { e: .88, s: 1.5, b: .09,  r: 0,  p: 1,   a: 0, w: 0, fl: .3,  o: .74, sm: 0,   tl: 0, sz: .97,  gy: -.4, sc: 0, cw: .12, wd: 0,  tk: 0, eg: 1.05, bm: 1.8 },
  searching:  { e: .78, s: 1.0, b: .05,  r: 0,  p: .3,  a: 1, w: 0, fl: .3,  o: .82, sm: 0,   tl: 0, sz: .98,  gy: -.1, sc: 1, cw: .08, wd: 0,  tk: 0, eg: 1,    bm: 1.5 },
  responding: { e: 1,   s: .85, b: .12,  r: 1.4, p: .45, a: 0, w: 0, fl: .6,  o: 1,   sm: .18, tl: 0, sz: 1,    gy: 0,   sc: 0, cw: .3,  wd: .2, tk: 1, eg: 1,    bm: 1 },
  happy:      { e: .8,  s: .5,  b: .08,  r: .6, p: .25, a: 0, w: 0, fl: 1.4, o: 1,   sm: 1,   tl: 0, sz: 1.05, gy: 0,   sc: 0, cw: .5,  wd: 0,  tk: 0, eg: 1,    bm: 1 },
  error:      { e: .26, s: .14, b: .03,  r: 0,  p: 0,   a: 0, w: 1, fl: .2,  o: .9,  sm: 0,   tl: 1, sz: .98,  gy: .3,  sc: 0, cw: 0,   wd: .1, tk: 0, eg: .8,   bm: 1 }
};
const LABEL = { idle: 'idle', listening: 'listening', thinking: 'thinking', searching: 'searching', responding: 'responding', happy: 'happy', error: 'showing an error' };
const BUSY = ['thinking', 'searching', 'responding'];
const ERROR_MS = 6000, HAPPY_MS = 1900;

/* ---------- pure helpers (exported so they can be tested without a browser) ---------- */

/* How closed the eyelid is, 0 (open) … 1 (shut), `p` seconds into a blink: a quick close, a slightly slower open. */
export const BLINK_MS = 180;
export const blinkLid = p => (p < 0 ? 0 : p < .07 ? ease(p / .07) : p < .18 ? ease(1 - (p - .07) / .11) : 0);

/* Where Viora should look to meet a pointer at (px,py) from an orb centred on (cx,cy): a unit-ish vector (−1…1 each way).
   It grows with distance but saturates, so a faraway cursor never drags her eyes to the rim. */
export function gazeFromPointer(px, py, cx, cy, reach = 280) {
  const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
  if (d < 1) return [0, 0];
  const m = d / (d + reach);
  return [dx / d * m, dy / d * m];
}

/* One eye as a point on the sphere. side −1 = her left eye on screen, +1 = right. gx/gy are the gaze (−1…1).
   Returns the offset from the orb's centre, how much the eye is squeezed sideways (zx) and vertically (zy) by the curve of the
   ball, and how visible it is (a): it fades out as it turns toward the rim. */
export function eyePose(side, R, gx, gy) {
  const lon = side * .4 + gx * .62, lat = gy * .36 - .05, cl = Math.cos(lat), z = cl * Math.cos(lon);
  return { x: Math.sin(lon) * cl * R * .84, y: Math.sin(lat) * R * .84, zx: Math.max(.3, z), zy: .72 + .28 * z, a: clamp((z - .16) / .4) };
}

/* What the orb does when nothing is in flight: typing → listening, otherwise settle to idle.
   null = leave it alone: an error and the short happy beat both finish on their own. */
export function restingState(current, typing) {
  if (current === 'error') return null;
  if (typing) return 'listening';
  return current === 'happy' ? null : 'idle';
}

/* ---------- pointer (one set of listeners shared by every orb) ---------- */

const ptr = { x: 0, y: 0, until: 0 };
let ptrBound = false;
function bindPointer() {
  if (ptrBound || typeof window === 'undefined') return;
  ptrBound = true;
  const seen = e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.until = performance.now() + (e.pointerType === 'touch' ? 1500 : 5000); };
  addEventListener('pointermove', e => { if (e.pointerType !== 'touch') seen(e); }, { passive: true });   // a mouse or pen follows; a finger only glances at a tap
  addEventListener('pointerdown', seen, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { ptr.until = 0; });
}

/* ---------- drawing ---------- */

/* One glowing eye, centred on (0,0) of a translated context. The top edge is a half-ellipse; the bottom edge is another one that
   flattens and then curves upward as `smile` grows, which turns the round eye into a cheerful crescent. */
function drawEye(ctx, x, y, rx, ry, smile, rot, alpha, glow, core, rim, low) {
  ctx.save(); ctx.translate(x, y);
  const hr = Math.max(rx, ry) * 2.7;
  let g = ctx.createRadialGradient(0, 0, 0, 0, 0, hr * .8);                      // a soft dark socket, so the light has something to glow against (not under a smile)
  g.addColorStop(0, rgba(COL.deep, .38 * alpha * (1 - smile))); g.addColorStop(1, rgba(COL.deep, 0));
  ctx.fillStyle = g; ctx.fillRect(-hr, -hr, 2 * hr, 2 * hr);
  ctx.globalCompositeOperation = 'lighter';
  const hy = -ry * .3 * smile, hk = 1 - .55 * smile;                           // when she smiles the light sits in the arch and the halo eases off, so the curve stays crisp
  g = ctx.createRadialGradient(0, hy, 0, 0, hy, hr);
  g.addColorStop(0, rgba(core, .7 * glow * alpha * hk)); g.addColorStop(.4, rgba(rim, .26 * glow * alpha * hk)); g.addColorStop(1, rgba(rim, 0));
  ctx.fillStyle = g; ctx.fillRect(-hr, -hr, 2 * hr, 2 * hr);
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI, TAU);
  const lo = ry * (1 - 1.5 * smile);
  ctx.ellipse(0, 0, rx, Math.max(.01, Math.abs(lo)), 0, 0, Math.PI, lo < 0); ctx.closePath();
  g = ctx.createLinearGradient(0, -ry, 0, ry);
  g.addColorStop(0, rgba(core, alpha)); g.addColorStop(.6, rgba(rim, alpha)); g.addColorStop(1, rgba(low, alpha));
  ctx.fillStyle = g; ctx.fill();
  ctx.globalCompositeOperation = 'lighter';                      // a white-hot centre
  g = ctx.createRadialGradient(0, -ry * .2, 0, 0, -ry * .2, Math.max(rx, ry * .8));
  g.addColorStop(0, rgba(COL.white, .55 * glow * alpha * hk)); g.addColorStop(1, rgba(COL.white, 0));
  ctx.fillStyle = g; ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  if (smile < .6) {                                              // a small wet glint, gone once the eye curves into a smile
    ctx.fillStyle = rgba(COL.white, .6 * alpha * (1 - smile / .6));
    ctx.beginPath(); ctx.ellipse(-rx * .3, -ry * .38, rx * .3, ry * .17, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

const CSS = `.v-orb{position:relative;display:block;aspect-ratio:1;flex:none}.v-orb canvas{display:block;width:100%;height:100%}`;

const instances = new Set();
let current = 'idle', errTimer = 0, happyTimer = 0;

function make(host, opts = {}) {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  host.classList.add('v-orb'); host.setAttribute('role', 'img'); host.append(cv);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const cur = { ...STATES.idle }; let target = STATES.idle, state = 'idle';
  let px = 0, dpr = 1, t = 0, ph = 0, ringT = 0, flash = 0, last = 0, raf = 0, vis = true;
  /* face: gaze, where she wanders to, the blink clock, and the talking envelope */
  let gx = 0, gy = 0, wx = 0, wy = 0, wanderAt = 0, rt = 0, tt = 0, talk = 0, kick = 0, blinkP = -1, nextBlink = 1.2 + Math.random() * 2;
  const parts = Array.from({ length: 18 }, () => ({ a: Math.random() * TAU, rf: 1.18 + Math.random() * .7, sp: (.4 + Math.random() * .8) * (Math.random() < .5 ? -1 : 1) }));

  const fit = () => { px = host.clientWidth || opts.size || 96; dpr = Math.min(devicePixelRatio || 1, 2); cv.width = cv.height = Math.round(px * dpr); };

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, px, px);
    const still = reduce.matches;
    const c = px / 2, cy = c + (still ? 0 : Math.sin(rt * .9) * px * .013 * cur.fl);             // she floats gently
    const e = Math.min(1.2, cur.e + flash * .5), R = px * .24 * (1 + cur.b * Math.sin(ph) + flash * .06 + talk * .025);
    const v = mix(COL.violet, COL.warn, cur.w * .7), bl = mix(COL.blue, COL.warn, cur.w * .35), mg = mix(COL.magenta, COL.warn, cur.w * .5);
    let g = ctx.createRadialGradient(c, cy, R * .6, c, cy, R * 2.1);
    g.addColorStop(0, rgba(v, .38 * e)); g.addColorStop(.5, rgba(bl, .12 * e)); g.addColorStop(1, rgba(bl, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, px, px);
    if (cur.r > .02) for (let i = 0; i < 3; i++) {
      const p = (ringT + i / 3) % 1;
      ctx.beginPath(); ctx.arc(c, cy, R * (1.05 + p * .85), 0, TAU);
      ctx.strokeStyle = rgba(bl, (1 - p) * (1 - p) * .38 * Math.min(1, cur.r)); ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.save(); ctx.beginPath(); ctx.arc(c, cy, R, 0, TAU); ctx.clip();
    g = ctx.createRadialGradient(c - R * .3, cy - R * .35, R * .1, c, cy, R);
    g.addColorStop(0, rgba(mix(v, COL.white, .25), 1)); g.addColorStop(.55, rgba(v, 1)); g.addColorStop(1, rgba(COL.deep, 1));
    ctx.fillStyle = g; ctx.fillRect(c - R, cy - R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = 'lighter';
    [[v, .9, 0], [bl, 1.3, 2.1], [mg, .7, 4.2]].forEach(([col, sp, p0], i) => {
      const x = c + Math.cos(t * sp + p0) * R * .42, y = cy + Math.sin(t * sp * 1.13 + p0) * R * .42, r = R * (.55 + .12 * Math.sin(t * 1.7 + i));
      const bg = ctx.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, rgba(col, .55 * e)); bg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = bg; ctx.fillRect(c - R, cy - R, 2 * R, 2 * R);
    });
    ctx.restore();

    /* the eyes, clipped to the ball so even their glow stays inside it */
    ctx.save(); ctx.beginPath(); ctx.arc(c, cy, R, 0, TAU); ctx.clip();
    const lid = still ? 0 : blinkLid(blinkP), wc = cur.w;
    const core = mix(mix(COL.blue, COL.white, .93), COL.warn, wc * .22), rim = mix(mix(COL.blue, COL.white, .5), COL.warn, wc * .5), low = mix(mix(COL.violet, COL.blue, .4), COL.warn, wc * .6);
    const glow = cur.eg * (1 + 1.6 * cur.b * Math.sin(ph)) + talk * .3;                          // the eyes pulse with the orb
    const boost = R < 20 ? 1 + (20 - R) / 40 : 1;                                                 // still readable in the small header orb
    const open = Math.max(.05, cur.o * (1 + talk * .06)) * (1 - lid), bob = -talk * R * .03;
    for (const side of [-1, 1]) {
      const P = eyePose(side, R, gx, gy);
      if (P.a < .02) continue;
      const rx = R * .13 * cur.sz * boost * P.zx * (1 + cur.sm * .22), ry = Math.max(.6, R * .24 * cur.sz * boost * P.zy * open * (1 + cur.sm * .25));
      drawEye(ctx, c + P.x, cy + P.y + bob, rx, ry, cur.sm, side * cur.tl * .3, P.a, glow, core, rim, low);
    }
    ctx.restore();

    ctx.beginPath(); ctx.arc(c, cy, R, 0, TAU); ctx.strokeStyle = rgba(mix(bl, COL.white, .4), .35); ctx.lineWidth = 1; ctx.stroke();
    if (cur.p > .02) {
      ctx.fillStyle = rgba(mix(bl, COL.white, .55), 1);
      for (const P of parts) {
        const a = P.a + t * P.sp * 1.2, rad = R * P.rf + Math.sin(t * 2 + P.a) * R * .06;
        ctx.globalAlpha = Math.min(1, cur.p) * (.35 + .65 * Math.abs(Math.sin(t * 1.5 + P.a * 3)));
        ctx.beginPath(); ctx.arc(c + Math.cos(a) * rad, cy + Math.sin(a) * rad, Math.max(.6, px * .006), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (cur.a > .02) {
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, px * .012);
      for (const [rf, len, dir, col] of [[1.28, 1.3, 1, bl], [1.5, .7, -1, v]]) {
        const a0 = t * 1.6 * dir;
        ctx.beginPath(); ctx.arc(c, cy, R * rf, a0, a0 + len);
        ctx.strokeStyle = rgba(col, .85 * cur.a); ctx.shadowColor = rgba(col, .9); ctx.shadowBlur = 8; ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  }

  /* Blinking, looking and talking. Runs once per frame, only while the loop is running. */
  function animateFace(dt, now) {
    rt += dt; tt += dt * (5 + cur.tk * 3); kick *= Math.exp(-dt * 6);
    if (blinkP >= 0) {
      blinkP += dt;
      if (blinkP > BLINK_MS / 1000) { blinkP = -1; nextBlink = rt + (Math.random() < .16 ? .18 : (2.2 + Math.random() * 3.4) * cur.bm); }   // now and then a double blink
    } else if (rt >= nextBlink) blinkP = 0;

    if (rt >= wanderAt) {
      wanderAt = rt + 1.6 + Math.random() * 2.8;
      if (Math.random() < .3) { wx = 0; wy = 0; } else { wx = (Math.random() * 2 - 1) * .75; wy = (Math.random() * 2 - 1) * .35; }
    }
    let tx = wx * cur.wd, ty = wy * cur.wd;
    const following = now < ptr.until && cur.cw > .01;
    if (following) {
      const r = host.getBoundingClientRect(), [fx, fy] = gazeFromPointer(ptr.x, ptr.y, r.left + r.width / 2, r.top + r.height / 2);
      tx = tx * (1 - cur.cw) + fx * .85 * cur.cw; ty = ty * (1 - cur.cw) + fy * .85 * cur.cw;
    }
    tx += Math.sin(rt * 1.9) * .55 * cur.sc; ty += cur.gy;                                       // searching reads side to side; thinking looks up
    const kg = 1 - Math.exp(-dt * (following ? 7 : 10));
    gx += (clamp(tx, -1, 1) - gx) * kg; gy += (clamp(ty, -1, 1) - gy) * kg;

    talk = cur.tk > .02 ? Math.min(1, Math.abs(Math.sin(tt * 6.3)) * (.55 + .45 * Math.sin(tt * 1.7 + .6)) * .7 + kick) * cur.tk : 0;
  }

  function step(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 4.5);                       // ~0.25 s eased transitions between states
    for (const key in cur) cur[key] += (target[key] - cur[key]) * k;
    flash *= Math.exp(-dt * 2.2);
    t += dt * cur.s; ph += dt * (1.2 + cur.s * 2.2); ringT += dt * (.3 + cur.r * .5);
    animateFace(dt, now);
    draw();
  }
  const loop = now => { step(now); raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf && vis && !document.hidden && !reduce.matches) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const hold = () => { gx = gy = talk = kick = flash = 0; blinkP = -1; Object.assign(cur, target); draw(); };   // the still pose for reduced motion

  const api = {
    host,
    set(s) {
      if (!STATES[s]) s = 'idle';
      const bloom = (s === 'happy' && state !== 'happy') || (s === 'idle' && BUSY.includes(state));
      if (bloom) flash = 1;
      state = s; target = STATES[s]; host.dataset.state = s; host.setAttribute('aria-label', 'Viora is ' + LABEL[s]);
      if (reduce.matches) hold(); else start();
    },
    pulse(n = .4) { kick = Math.min(1, kick + n); },
    destroy() { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); reduce.removeEventListener?.('change', onReduce); instances.delete(api); cv.remove(); }
  };
  const onVis = () => (document.hidden ? stop() : start());
  const onReduce = () => { if (reduce.matches) { stop(); hold(); } else start(); };
  const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; vis ? start() : stop(); });
  const ro = new ResizeObserver(() => { fit(); draw(); });
  io.observe(host); ro.observe(host); document.addEventListener('visibilitychange', onVis); reduce.addEventListener?.('change', onReduce);
  fit(); api.set(current); Object.assign(cur, target); draw();
  return api;
}

export const Orb = {
  mount(host, opts) {
    if (!document.getElementById('viora-orb-css')) { const s = document.createElement('style'); s.id = 'viora-orb-css'; s.textContent = CSS; document.head.append(s); }
    bindPointer();
    const o = make(host, opts); instances.add(o); return o;
  },
  set(s) {
    if (s === 'done') { if (current === 'error') return; s = 'happy'; } else if (!STATES[s]) s = 'idle';
    clearTimeout(errTimer); clearTimeout(happyTimer);
    if (s === 'error') errTimer = setTimeout(() => Orb.set('idle'), ERROR_MS);         // an error settles back by itself
    if (s === 'happy') happyTimer = setTimeout(() => Orb.set('idle'), HAPPY_MS);       // and so does the happy beat
    current = s;
    document.documentElement.dataset.orb = current;
    instances.forEach(o => o.set(s));
  },
  pulse(n) { instances.forEach(o => o.pulse(n)); },
  get: () => current
};
