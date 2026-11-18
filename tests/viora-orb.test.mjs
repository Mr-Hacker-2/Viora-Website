import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Orb, STATES, BLINK_MS, blinkLid, gazeFromPointer, eyePose, restingState } from '../assets/x/viora-orb.js';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

/* A just-enough browser for mounting an orb in Node: records every canvas call and every requestAnimationFrame. */
function fakeBrowser({ reduce }) {
  const calls = [], raf = { n: 0 }, stub = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); return stub; }),
    set: (t, k, v) => { t[k] = v; return true; }
  });
  const observer = class { observe() {} disconnect() {} };
  Object.assign(globalThis, {
    document: {
      hidden: false, head: { append() {} }, getElementById: () => ({}), addEventListener() {}, removeEventListener() {},
      createElement: () => ({ getContext: () => ctx, remove() {}, style: {} }),
      documentElement: { dataset: {}, addEventListener() {} }
    },
    matchMedia: () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }),
    IntersectionObserver: observer, ResizeObserver: observer, devicePixelRatio: 1,
    requestAnimationFrame: () => { raf.n++; return raf.n; }, cancelAnimationFrame() {}
  });
  const host = { classList: { add() {} }, setAttribute() {}, append() {}, clientWidth: 200, dataset: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) };
  return { calls, raf, host };
}

test('every state describes the whole face, so moving between states never leaves a gap', () => {
  const keys = Object.keys(STATES.idle).sort();
  for (const name of ['idle', 'listening', 'thinking', 'searching', 'responding', 'happy', 'error']) {
    assert.deepEqual(Object.keys(STATES[name]).sort(), keys, name + ' is missing or has extra settings');
  }
});

test('each expression says what the brief asks for', () => {
  assert.ok(STATES.happy.sm > .9, 'happy: eyes curve up into a smile');
  assert.ok(STATES.error.tl > .9 && STATES.error.w === 1, 'error: concerned tilt and a warm tint');
  assert.ok(STATES.thinking.o < STATES.idle.o, 'thinking: eyes narrow and focus');
  assert.equal(STATES.listening.cw, 0, 'listening: she looks forward, not at the cursor');
  assert.equal(STATES.listening.wd, 0, 'listening: and does not wander');
  assert.ok(STATES.idle.wd > 0 && STATES.idle.cw > 0, 'idle: looks around and follows the cursor');
  assert.ok(STATES.responding.tk > 0 && STATES.idle.tk === 0, 'only responding talks');
  assert.ok(STATES.searching.sc > 0, 'searching: eyes sweep side to side');
});

test('a blink closes fast, opens a little slower, and is over in well under a quarter second', () => {
  assert.equal(blinkLid(-1), 0, 'no blink in progress');
  assert.equal(blinkLid(0), 0);
  assert.equal(blinkLid(.07), 1, 'fully shut at the bottom of the blink');
  assert.ok(blinkLid(.035) > 0 && blinkLid(.035) < 1);
  assert.ok(blinkLid(.12) > 0 && blinkLid(.12) < 1, 'opening');
  assert.equal(blinkLid(.18), 0, 'open again');
  assert.ok(BLINK_MS < 250);
  let prev = 1; for (let p = .07; p <= .18; p += .01) { const v = blinkLid(p); assert.ok(v <= prev + 1e-9, 'opens smoothly, never flickers'); prev = v; }
});

test('the eyes follow the cursor in the right direction, gently, and never past their limit', () => {
  assert.deepEqual(gazeFromPointer(100, 100, 100, 100), [0, 0], 'cursor on top of her: eyes centred');
  const [rx] = gazeFromPointer(500, 100, 100, 100); assert.ok(rx > 0, 'cursor to the right → look right');
  const [lx] = gazeFromPointer(-300, 100, 100, 100); assert.ok(lx < 0, 'cursor to the left → look left');
  const [, uy] = gazeFromPointer(100, -300, 100, 100); assert.ok(uy < 0, 'cursor above → look up');
  const [, dy] = gazeFromPointer(100, 600, 100, 100); assert.ok(dy > 0, 'cursor below → look down');
  const near = Math.hypot(...gazeFromPointer(200, 100, 100, 100)), far = Math.hypot(...gazeFromPointer(5000, 100, 100, 100));
  assert.ok(near < far, 'a farther cursor pulls a little harder');
  assert.ok(far < 1, 'but never to the rim');
});

test('the eyes sit on the surface of the ball: they curve away, squeeze and fade as she looks to the side', () => {
  const R = 50, ahead = [eyePose(-1, R, 0, 0), eyePose(1, R, 0, 0)];
  assert.ok(Math.abs(ahead[0].x + ahead[1].x) < 1e-9, 'looking ahead the eyes are symmetrical');
  assert.ok(ahead[0].y === ahead[1].y);
  const left = eyePose(-1, R, 1, 0), right = eyePose(1, R, 1, 0);
  assert.ok(right.zx < left.zx, 'looking right, the right eye is nearer the rim, so it is squeezed more');
  assert.ok(right.a < left.a, 'and it is fainter');
  for (const gx of [-1, -.5, 0, .5, 1]) for (const gy of [-1, 0, 1]) for (const side of [-1, 1]) {
    const P = eyePose(side, R, gx, gy);
    assert.ok(Math.hypot(P.x, P.y) < R, 'an eye never leaves the ball');
    assert.ok(P.zx >= .3 && P.zx <= 1 && P.zy > 0 && P.a >= 0 && P.a <= 1);
  }
  assert.ok(eyePose(1, R, 0, -1).y < eyePose(1, R, 0, 1).y, 'looking up moves the eyes up');
});

test('typing means listening; an error and the happy beat are left to finish by themselves', () => {
  assert.equal(restingState('idle', true), 'listening');
  assert.equal(restingState('idle', false), 'idle');
  assert.equal(restingState('listening', false), 'idle');
  assert.equal(restingState('happy', false), null, 'the happy beat is not cut short');
  assert.equal(restingState('happy', true), 'listening', 'but starting to type wins');
  assert.equal(restingState('error', false), null);
  assert.equal(restingState('error', true), null);
});

test('a finished reply is a short happy beat, then she settles to idle by herself', () => {
  fakeBrowser({ reduce: true }); mock.timers.enable({ apis: ['setTimeout'] });
  try {
    Orb.set('responding'); Orb.set('done');
    assert.equal(Orb.get(), 'happy');
    assert.equal(document.documentElement.dataset.orb, 'happy', 'the rest of the UI sees the same state');
    mock.timers.tick(1800); assert.equal(Orb.get(), 'happy', 'still happy');
    mock.timers.tick(200); assert.equal(Orb.get(), 'idle');
  } finally { mock.timers.reset(); }
});

test('an error is not cheered away by a stray done, and it settles back by itself', () => {
  fakeBrowser({ reduce: true }); mock.timers.enable({ apis: ['setTimeout'] });
  try {
    Orb.set('error'); Orb.set('done');
    assert.equal(Orb.get(), 'error');
    mock.timers.tick(5900); assert.equal(Orb.get(), 'error');
    mock.timers.tick(200); assert.equal(Orb.get(), 'idle');
  } finally { mock.timers.reset(); }
});

test('an unknown state falls back to idle instead of breaking the face', () => {
  fakeBrowser({ reduce: true });
  Orb.set('nonsense'); assert.equal(Orb.get(), 'idle');
});

test('with reduced motion the orb never starts an animation loop, but still shows her expression', () => {
  const { calls, raf, host } = fakeBrowser({ reduce: true });
  Orb.set('idle');
  const orb = Orb.mount(host, {});
  assert.ok(calls.some(c => c[0] === 'ellipse'), 'eyes are drawn');
  for (const s of ['thinking', 'searching', 'responding', 'listening', 'error', 'happy', 'idle']) Orb.set(s);
  Orb.pulse(1);
  assert.equal(raf.n, 0, 'no requestAnimationFrame, ever');

  calls.length = 0; Orb.set('happy');
  assert.ok(calls.some(c => c[0] === 'ellipse' && c[8] === true), 'happy: the eyes are drawn as upward curves');
  calls.length = 0; Orb.set('error');
  const turns = calls.filter(c => c[0] === 'rotate').map(c => c[1]);
  assert.ok(turns.some(a => a < -.25) && turns.some(a => a > .25), 'error: the two eyes tilt toward each other, which reads as concern');
  orb.destroy();
});

test('without reduced motion the orb animates', () => {
  const { raf, host } = fakeBrowser({ reduce: false });
  const orb = Orb.mount(host, {});
  Orb.set('thinking');
  assert.ok(raf.n > 0, 'the loop starts');
  orb.destroy();
});

test('the bridge turns real chat activity into expressions', () => {
  const bridge = read('assets/x/orb-bridge.js');
  assert.match(bridge, /restingState\(/, 'idle/typing decisions go through the shared rule');
  assert.match(bridge, /Orb\.pulse\(/, 'streamed answer text nudges the talking animation');
  assert.match(bridge, /'done'/, 'a finished reply plays the happy beat');
  assert.match(bridge, /'error'/, 'a failed reply shows the concerned face');
});
