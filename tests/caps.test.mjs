import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPS, FALLBACK, needs, pick } from '../assets/x/caps.js';

const image = [{ kind: 'image', ni: 1 }];
const video = [{ kind: 'video', ni: 8 }];
const noFrames = [{ kind: 'video', ni: 0 }];

test('capability registry declares all supported assistant choices', () => {
  for (const name of ['auto', 'flash', 'search', 'math', 'automate', 'human']) {
    assert.ok(CAPS[name], `missing capabilities for ${name}`);
    assert.equal(CAPS[name].text, 1);
  }
  assert.equal(FALLBACK, 'flash');
});

test('needs ignores attachments without usable image/frame content', () => {
  assert.deepEqual(needs(image), ['image']);
  assert.deepEqual(needs(video), ['video']);
  assert.deepEqual(needs(noFrames), []);
  assert.deepEqual(needs([]), []);
});

test('compatible assistant stays selected and incompatible assistant switches safely', () => {
  assert.deepEqual(pick('search', image), { assistant: 'search', switched: false });
  assert.equal(pick('human', image).assistant, FALLBACK);
  assert.equal(pick('automate', video).assistant, FALLBACK);
  assert.equal(pick('human', video).switched, true);
});

test('all declared visual-capable assistants support both image and video input', () => {
  for (const [name, caps] of Object.entries(CAPS)) {
    if (caps.image) assert.equal(caps.video, 1, `${name} accepts images but not video frames`);
  }
});