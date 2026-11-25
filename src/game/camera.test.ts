import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAMERA_PAN_MAX_X,
  CAMERA_PAN_MIN_X,
  FIGHT_CAMERA_Y,
  FIGHT_CAMERA_Z,
  FIGHT_LOOK_Y,
  computeFixedZoomCameraTarget,
  computeIntroCameraTarget,
  computeKoWinnerCameraTarget,
  computeSuperCameraTarget,
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

test('Round 1 intro camera sweeps from P1 (0..2.0s) to CPU (2.0..4.0s) to fixed fight angle (4.85s)', () => {
  const p1Start = computeIntroCameraTarget(1, 0.2, 4.85, -2.4, 2.4);
  const p1Late = computeIntroCameraTarget(1, 1.85, 4.85, -2.4, 2.4);
  assert.ok(p1Start.x < -2.4, 'Opening pose should sit behind/beside P1 shoulder');
  assert.ok(p1Late.x < -2.4, 'Camera should remain framed on P1 for the full 2.0s P1 intro dialogue');
  assert.ok(p1Start.z < FIGHT_CAMERA_Z, 'Opening pose should be closer than fight camera');
  assert.ok(p1Start.lookX > p1Start.x, 'Opening pose should look across toward CPU');

  const p2Mid = computeIntroCameraTarget(1, 2.6, 4.85, -2.4, 2.4);
  const p2Late = computeIntroCameraTarget(1, 3.85, 4.85, -2.4, 2.4);
  assert.ok(p2Mid.x > 0 && p2Late.x > 0, 'Camera should hold on CPU for the full 2.0s CPU intro dialogue');

  const endPose = computeIntroCameraTarget(1, 4.85, 4.85, -2.4, 2.4);
  assert.equal(endPose.z, FIGHT_CAMERA_Z);
  assert.equal(endPose.y, FIGHT_CAMERA_Y);
  assert.equal(endPose.lookY, FIGHT_LOOK_Y);

  const round2EndPose = computeIntroCameraTarget(2, 1.55, 1.55, -2.4, 2.4);
  assert.equal(round2EndPose.z, FIGHT_CAMERA_Z);
  assert.equal(round2EndPose.y, FIGHT_CAMERA_Y);
});

test('Super camera sweeps low-angle close-up -> dynamic high-angle 3D orbit -> smooth return', () => {
  const startup = computeSuperCameraTarget(0.25, 1.6, -1.5, 1, 1.2, false);
  assert.ok(startup.y < FIGHT_CAMERA_Y, 'Super startup should dip to dramatic low angle');
  assert.ok(startup.z < FIGHT_CAMERA_Z, 'Super startup should close in on attacker');

  const highOrbit = computeSuperCameraTarget(0.9, 1.6, -1.5, 1, 1.2, false);
  assert.ok(highOrbit.y > FIGHT_CAMERA_Y, 'Super impact phase should rise to dynamic high-angle orbit');

  const returnEnd = computeSuperCameraTarget(1.6, 1.6, -1.5, 1, 1.2, false);
  assert.equal(returnEnd.z, FIGHT_CAMERA_Z);
  assert.equal(returnEnd.y, FIGHT_CAMERA_Y);
});

test('KO winner celebration camera zooms in gently on the victorious fighter', () => {
  const pose = computeKoWinnerCameraTarget(-1.2, 1);
  assert.ok(pose.z < FIGHT_CAMERA_Z, 'Winner celebration should gently zoom closer');
  assert.ok(Math.abs(pose.lookX - -1.2) < 0.01, 'Winner celebration should focus on winner X');
});

