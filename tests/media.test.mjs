import test from 'node:test';
import assert from 'node:assert/strict';
import { sniff, IMG_OK, VID_OK, videoSampleTimes } from '../assets/x/media.js';

function file(bytes, name = 'upload.bin') {
  const blob = new Blob([Uint8Array.from(bytes)]);
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
}

test('sniff recognizes supported image and video signatures', async () => {
  assert.equal(await sniff(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(await sniff(file([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(await sniff(file([0x1a, 0x45, 0xdf, 0xa3])), 'webm');
  assert.ok(IMG_OK.has('png'));
  assert.ok(VID_OK.has('webm'));
});

test('video frame sampling covers short clips and caps long clips evenly', () => {
  assert.deepEqual(videoSampleTimes(4), [.25, 3.75]);

  const long = videoSampleTimes(120);
  assert.equal(long.length, 8);
  assert.ok(long[0] < 1);
  assert.ok(long.at(-1) > 119);
  assert.ok(long.every((time, index) => index === 0 || time > long[index - 1]));

  assert.deepEqual(videoSampleTimes(0), []);
  assert.deepEqual(videoSampleTimes(NaN), []);
});

test('sniff detects documents and refuses to trust a misleading extension', async () => {
  assert.equal(await sniff(file([0x25, 0x50, 0x44, 0x46, 0x2d], 'photo.png')), 'pdf');
  assert.equal(await sniff(file([0x4d, 0x5a, 0x90, 0x00], 'report.pdf')), 'unknown');
});

test('sniff recognizes common unsupported audio signatures', async () => {
  assert.equal(await sniff(file([0x49, 0x44, 0x33, 0x04])), 'audio');
  assert.equal(await sniff(file([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])), 'audio');
});