import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePhotoHeadLocalYaw,
  createBackHeadHemisphereGeometry,
  createFlatOvalFacePlateGeometry,
  getPhotoFaceCropRect,
  isPhotoFaceFighter,
  PHOTO_BACK_DOME_COLOR,
  PHOTO_FACE_CROP_SPECS,
  PHOTO_FACE_PLATE_Z,
  PHOTO_HEAD_OVAL_SCALE,
  REAL_FACE_PHOTO_URLS,
} from './characters/photoFaceLoader';

test('Father Roy Dolphus, Samyak, and Principal Man face crop rects trim grey studio margins & collars tightly', () => {
  for (const id of ['father', 'samyak', 'principal'] as const) {
    assert.equal(isPhotoFaceFighter(id), true);
    assert.ok(REAL_FACE_PHOTO_URLS[id].endsWith('.png'));
    const spec = PHOTO_FACE_CROP_SPECS[id];
    const rect = getPhotoFaceCropRect(id, 1024, 1024);

    assert.ok(spec.sx >= 0.08 && spec.sx <= 0.25, `${id} trims left margin`);
    assert.ok(spec.sx + spec.sw <= 0.91, `${id} trims right margin`);
    assert.ok(spec.sy >= 0.06 && spec.sy <= 0.16, `${id} starts at crown/hairline`);
    assert.ok(spec.sy + spec.sh <= 0.94, `${id} ends cleanly at chin/beard without collar`);
    assert.equal(rect.sx, Math.round(1024 * spec.sx));
    assert.equal(rect.sw, Math.round(1024 * spec.sw));
    assert.equal(rect.sh, Math.round(1024 * spec.sh));
  }
  assert.equal(isPhotoFaceFighter('sheru'), false);
  assert.equal(PHOTO_BACK_DOME_COLOR, 0x1e1e22);
  assert.equal(PHOTO_FACE_PLATE_Z, 0.008);
  assert.deepEqual(PHOTO_HEAD_OVAL_SCALE, { x: 1.0, y: 1.12, z: 0.92 });
});

test('createBackHeadHemisphereGeometry faces backward along -Z and pairs flush with flat CircleGeometry face plate at +Z', () => {
  const radius = 0.15;
  const dome = createBackHeadHemisphereGeometry(radius);
  const pos = dome.attributes.position;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  // Rounded dome extends to -radius along -Z and terminates cleanly at flat rim z ≈ 0
  assert.ok(minZ < -radius * 0.98, `dome apex reaches -radius along -Z (got ${minZ})`);
  assert.ok(Math.abs(maxZ) < 1e-4, `flat circular rim lies at z = 0 (got ${maxZ})`);
  assert.ok(maxX > radius * 0.98 && minX < -radius * 0.98, 'rim spans full -r..+r on X');
  assert.ok(maxY > radius * 0.98 && minY < -radius * 0.98, 'rim spans full -r..+r on Y');

  // Matching flat face plate lies purely in Z = 0 plane facing +Z with zero spherical curvature
  const plate = createFlatOvalFacePlateGeometry(radius);
  const platePos = plate.attributes.position;
  for (let i = 0; i < platePos.count; i++) {
    assert.ok(Math.abs(platePos.getZ(i)) < 1e-6, 'flat face plate has zero Z distortion');
  }

  dome.dispose();
  plate.dispose();
});

test('computePhotoHeadLocalYaw angles flat front face ~25-35 degrees toward camera (+Z) without overriding front-facing poses', () => {
  const bodyYawRight = Math.PI * 0.42; // ~75.6 deg
  const localRight = computePhotoHeadLocalYaw(1, bodyYawRight, 0, 0, 0);
  const worldRightDeg = ((bodyYawRight + localRight) * 180) / Math.PI;
  // ~44-50 deg from +Z means ~26-32 deg turned toward camera from body & ~40-46 deg from profile!
  assert.ok(
    worldRightDeg >= 40 && worldRightDeg <= 52,
    `facing +1 world head yaw should be crisp 3/4 (~40-52 deg from +Z, got ${worldRightDeg.toFixed(1)})`,
  );

  const bodyYawLeft = -Math.PI * 0.42;
  const localLeft = computePhotoHeadLocalYaw(-1, bodyYawLeft, 0, 0, 0);
  const worldLeftDeg = ((bodyYawLeft + localLeft) * 180) / Math.PI;
  assert.ok(
    worldLeftDeg <= -40 && worldLeftDeg >= -52,
    `facing -1 world head yaw should mirror cleanly (got ${worldLeftDeg.toFixed(1)})`,
  );

  // Samyak front flex (already turned toward camera at ~33 deg) must NOT be turned away
  const flexLocal = computePhotoHeadLocalYaw(1, bodyYawRight, -0.58, -0.18, 0.08);
  assert.equal(flexLocal, 0.08, 'front-facing flex pose preserves its natural camera-facing head yaw');
});
