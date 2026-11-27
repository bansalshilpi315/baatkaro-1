import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  clampJoystickAnchor,
  computeJoystickOutput,
  JOYSTICK_ACTIVE_OPACITY,
  JOYSTICK_DEADZONE_PX,
  JOYSTICK_IDLE_BOTTOM_PX,
  JOYSTICK_IDLE_LEFT_PX,
  JOYSTICK_IDLE_OPACITY,
  JOYSTICK_MAX_RADIUS_PX,
  JOYSTICK_TOP_EXCLUSION_PX,
} from './virtualJoystick';
import { SuperAudioSyncController } from './superSync';
import { FatherSuperVfx } from './fatherSuperVfx';
import { SamyakSuperVfx } from './samyakSuperVfx';

// Minimal headless canvas shim so Three.js CanvasTexture works in Node tests
function installCanvasShim() {
  const g = globalThis as unknown as { document?: unknown };
  if (g.document) return () => {};
  const ctxStub = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
  g.document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 256,
          height: 256,
          getContext: () => ctxStub,
        };
      }
      return {};
    },
  };
  return () => {
    delete g.document;
  };
}

test('Dynamic Floating Left-Half Virtual Joystick constants & anchor clamping match spec', () => {
  assert.equal(JOYSTICK_TOP_EXCLUSION_PX, 72);
  assert.equal(JOYSTICK_IDLE_LEFT_PX, 84);
  assert.equal(JOYSTICK_IDLE_BOTTOM_PX, 84);
  assert.equal(JOYSTICK_IDLE_OPACITY, 0.25);
  assert.equal(JOYSTICK_ACTIVE_OPACITY, 0.95);
  assert.ok(JOYSTICK_MAX_RADIUS_PX >= 48 && JOYSTICK_MAX_RADIUS_PX <= 56);
  assert.equal(JOYSTICK_DEADZONE_PX, 10);

  // Touch near left-center snaps directly to touch coordinates
  const mid = clampJoystickAnchor(210, 215, 844, 390);
  assert.equal(mid.x, 210);
  assert.equal(mid.y, 215);

  // Touch right against the left or bottom edge clamps safely inside viewport by joystick radius
  const edge = clampJoystickAnchor(4, 388, 844, 390);
  assert.ok(edge.x >= JOYSTICK_MAX_RADIUS_PX, 'clamped X must keep outer ring inside left edge');
  assert.ok(
    edge.y <= 390 - JOYSTICK_MAX_RADIUS_PX,
    'clamped Y must keep outer ring inside bottom edge',
  );

  // Touch near top HUD boundary stays safely below top HUD bar
  const topTouch = clampJoystickAnchor(120, 72, 844, 390);
  assert.ok(topTouch.y >= JOYSTICK_TOP_EXCLUSION_PX + JOYSTICK_MAX_RADIUS_PX * 0.5);
});

test('Virtual Joystick deadzone (~10px), max radius clamping, and 4-way fighting inputs', () => {
  // Inside 10px deadzone -> zero directional output
  const neutral = computeJoystickOutput(200, 200, 206, 204);
  assert.equal(neutral.left, false);
  assert.equal(neutral.right, false);
  assert.equal(neutral.up, false);
  assert.equal(neutral.down, false);
  assert.equal(neutral.normX, 0);
  assert.equal(neutral.normY, 0);

  // Far drag right -> knob clamped to maxRadius (52px) & right=true
  const farRight = computeJoystickOutput(200, 200, 360, 200);
  assert.ok(Math.abs(farRight.knobX - JOYSTICK_MAX_RADIUS_PX) < 0.001);
  assert.equal(farRight.knobY, 0);
  assert.equal(farRight.right, true);
  assert.equal(farRight.left, false);
  assert.equal(farRight.up, false);
  assert.equal(farRight.down, false);

  // Diagonal up-left jump -> knob hypotenuse clamped to maxRadius, up=true & left=true
  const upLeft = computeJoystickOutput(200, 200, 100, 100);
  assert.ok(Math.abs(Math.hypot(upLeft.knobX, upLeft.knobY) - JOYSTICK_MAX_RADIUS_PX) < 0.01);
  assert.equal(upLeft.left, true);
  assert.equal(upLeft.up, true);
  assert.equal(upLeft.right, false);
  assert.equal(upLeft.down, false);

  // Downward crouch/guard
  const crouch = computeJoystickOutput(200, 200, 200, 240);
  assert.equal(crouch.down, true);
  assert.equal(crouch.up, false);
});

test('SuperAudioSyncController defers Super voiceover to the immediate next rAF after first Super render', () => {
  const sync = new SuperAudioSyncController();
  const played: string[] = [];
  const scheduled: Array<{ id: number; cb: FrameRequestCallback }> = [];
  const cancelled: number[] = [];
  let nextId = 1;

  // Step 1: Super activates during simulation tick -> audio must NOT play synchronously yet
  sync.queue('adi');
  assert.equal(sync.hasQueued(), true);
  assert.equal(played.length, 0);

  // Step 2: Immediately after Three.js renders Super frame 1, flush schedules 1 rAF
  const flushed = sync.flushAfterRender(
    (cb) => {
      const id = nextId++;
      scheduled.push({ id, cb });
      return id;
    },
    (id) => played.push(id),
    () => true,
  );
  assert.equal(flushed, true);
  assert.equal(sync.hasQueued(), false);
  assert.equal(sync.hasPendingRaf(), true);
  assert.equal(played.length, 0, 'audio must wait for the immediate next rAF callback');
  assert.equal(scheduled.length, 1);

  // Step 3: Next rAF fires -> exact frame-locked Super audio starts
  scheduled[0].cb(16.67);
  assert.deepEqual(played, ['adi']);
  assert.equal(sync.hasPendingRaf(), false);

  // Step 4: Cancellation before next rAF prevents stale audio on match reset/dispose
  sync.queue('sheru');
  sync.flushAfterRender(
    (cb) => {
      const id = nextId++;
      scheduled.push({ id, cb });
      return id;
    },
    (id) => played.push(id),
    () => true,
  );
  sync.cancel((id) => cancelled.push(id));
  assert.deepEqual(cancelled, [2]);
  scheduled[1].cb(33.33);
  assert.deepEqual(played, ['adi'], 'cancelled rAF must never fire stale Super audio');
});

test('FatherSuperVfx and SamyakSuperVfx keep SpotLight and PointLight directly on scene for zero shader recompiles', () => {
  const restore = installCanvasShim();
  try {
    const scene = new THREE.Scene();
    const fatherVfx = new FatherSuperVfx(scene);
    const samyakVfx = new SamyakSuperVfx(scene);

    // Count direct scene-level SpotLights & PointLights while VFX roots are hidden (idle state)
    const directLights = scene.children.filter(
      (c) => c instanceof THREE.SpotLight || c instanceof THREE.PointLight,
    );
    assert.equal(
      directLights.length,
      4,
      'FatherSuperVfx + SamyakSuperVfx must attach both SpotLight and PointLight directly to scene so light counts never change on Super frame 1',
    );
    for (const light of directLights) {
      assert.equal(light.visible, true);
      assert.equal((light as THREE.Light).intensity, 0);
    }

    fatherVfx.dispose(scene);
    samyakVfx.dispose(scene);
    const remainingLights = scene.children.filter(
      (c) => c instanceof THREE.SpotLight || c instanceof THREE.PointLight,
    );
    assert.equal(remainingLights.length, 0, 'dispose must cleanly remove scene-level Super lights');
  } finally {
    restore();
  }
});
