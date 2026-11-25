import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFrontProjectedFaceShellGeometry,
  getPhotoFaceCropRect,
  PHOTO_FACE_CROP_SPECS,
} from './characters/photoFaceLoader';

test('Father Roy Dolphus and Samyak face crop rects stay tightly inside portrait bounds and exclude collar/margins', () => {
  for (const id of ['father', 'samyak'] as const) {
    const spec = PHOTO_FACE_CROP_SPECS[id];
    const rect = getPhotoFaceCropRect(id, 1024, 1024);

    assert.ok(spec.sx >= 0.18 && spec.sx <= 0.25, `${id} trims left grey studio margin`);
    assert.ok(spec.sx + spec.sw <= 0.84, `${id} trims right grey studio margin`);
    assert.ok(spec.sy >= 0.04 && spec.sy <= 0.12, `${id} starts at crown/hairline`);
    assert.ok(spec.sy + spec.sh <= 0.94, `${id} ends cleanly at chin/beard without collar`);
    assert.equal(rect.sx, Math.round(1024 * spec.sx));
    assert.equal(rect.sw, Math.round(1024 * spec.sw));
    assert.equal(rect.sh, Math.round(1024 * spec.sh));
  }
});

test('createFrontProjectedFaceShellGeometry covers full ~194-degree front hemisphere with undistorted front-projected UVs', () => {
  const radius = 0.16;
  const geo = createFrontProjectedFaceShellGeometry(radius);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let minZ = Infinity;
  let centerU = -1;
  let centerV = -1;
  let bestFrontZ = -Infinity;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = uv.getX(i);
    const v = uv.getY(i);

    assert.ok(u > 0 && u < 1, 'u stays clamped inside (0,1)');
    assert.ok(v > 0 && v < 1, 'v stays clamped inside (0,1)');

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
    if (z < minZ) minZ = z;

    if (z > bestFrontZ && Math.abs(x) < 0.02 && Math.abs(y) < 0.02) {
      bestFrontZ = z;
      centerU = u;
      centerV = v;
    }
  }

  // Full cheek-to-cheek (-R to +R) and forehead-to-chin (-0.98R to +0.98R), wrapping slightly past z=0 (~194°)
  assert.ok(maxX > radius * 0.98 && minX < -radius * 0.98, 'covers full cheek-to-cheek width');
  assert.ok(maxY > radius * 0.96 && minY < -radius * 0.96, 'covers crown/forehead down to chin');
  assert.ok(maxZ > radius * 0.98, 'faces forward along +Z');
  assert.ok(minZ < -radius * 0.05, 'wraps slightly past 180 degrees behind cheeks');

  // Center of nose (+Z) maps cleanly near (0.5, 0.5)
  assert.ok(Math.abs(centerU - 0.5) < 0.05, `centerU near 0.5 (got ${centerU})`);
  assert.ok(Math.abs(centerV - 0.5) < 0.05, `centerV near 0.5 (got ${centerV})`);

  geo.dispose();
});
