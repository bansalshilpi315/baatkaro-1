import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAMERA_PAN_MAX_X,
  CAMERA_PAN_MIN_X,
  FIGHT_CAMERA_Y,
  FIGHT_CAMERA_Z,
  FIGHT_LOOK_Y,
  computeFixedZoomCameraTarget,
} from './camera';
import { ARENA_MAX_X, ARENA_MIN_X } from './combat';

test('arena playable bounds are expanded to [-9.5, +9.5]', () => {
  assert.equal(ARENA_MIN_X, -9.5);
  assert.equal(ARENA_MAX_X, 9.5);
});

test('camera keeps strictly fixed zoom Z regardless of fighter separation', () => {
  const close = computeFixedZoomCameraTarget(-0.6, 0.6);
  const medium = computeFixedZoomCameraTarget(-3.2, 3.2);
  const wide = computeFixedZoomCameraTarget(-9.5, 9.5);
  const leftCorner = computeFixedZoomCameraTarget(-9.5, -8.2);
  const rightCorner = computeFixedZoomCameraTarget(8.2, 9.5);

  for (const target of [close, medium, wide, leftCorner, rightCorner]) {
    assert.equal(target.z, FIGHT_CAMERA_Z);
    assert.equal(target.y, FIGHT_CAMERA_Y);
    assert.equal(target.lookY, FIGHT_LOOK_Y);
    assert.equal(target.lookZ, 0);
    assert.equal(target.lookX, target.x);
  }
});

test('camera smoothly tracks horizontal midpoint and clamps strictly to [-6.5, +6.5]', () => {
  const center = computeFixedZoomCameraTarget(-2.4, 2.4);
  assert.equal(center.x, 0);

  const midLeft = computeFixedZoomCameraTarget(-6.0, -2.0);
  assert.equal(midLeft.x, -4.0);

  const midRight = computeFixedZoomCameraTarget(3.0, 7.0);
  assert.equal(midRight.x, 5.0);

  const farLeft = computeFixedZoomCameraTarget(-9.5, -8.4);
  assert.equal(farLeft.x, CAMERA_PAN_MIN_X);
  assert.equal(farLeft.x, -6.5);

  const farRight = computeFixedZoomCameraTarget(8.4, 9.5);
  assert.equal(farRight.x, CAMERA_PAN_MAX_X);
  assert.equal(farRight.x, 6.5);
});
