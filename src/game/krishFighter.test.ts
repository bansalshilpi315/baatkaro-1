import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { KRISH_SUPER_AUDIO_URL, getSuperAudioUrl } from './audio';
import { FIGHTER_CONFIGS, FIGHTER_LIST } from './characters/configs';
import {
  KRISH_GLB_HEAD_CONFIG,
  KRISH_GLB_HEAD_URL,
  KRISH_NECK_PIVOT_Y,
  KRISH_TARGET_HEAD_HEIGHT,
  attachKrishGlbHead,
  buildFittedKrishGlbHead,
  clearKrishGlbHeadCacheForTests,
  getKrishGlbHeadStatus,
} from './characters/fatherGlbHead';
import { REAL_FACE_PHOTO_URLS, isPhotoFaceFighter } from './characters/photoFaceLoader';
import {
  computeSignatureDamage,
  computeTotalSuperDamage,
  createEmptyInput,
  createMatchState,
  stepMatch,
} from './combat';
import type { FighterId } from './types';

test('Krish is registered in the 10-playable roster with 140 HP, DROP-BARRAGE, and 10KG HEAVY BAG SMASH', () => {
  assert.equal(FIGHTER_LIST.length, 10);
  assert.deepEqual(
    FIGHTER_LIST.map((f) => f.id),
    ['sheru', 'billa', 'utkarsh', 'anda', 'krish', 'adi', 'mausi', 'neta', 'samyak', 'father'],
  );

  const krish = FIGHTER_CONFIGS.krish;
  assert.equal(krish.name, 'Krish');
  assert.equal(krish.maxHp, 140);
  assert.equal(krish.attackPowerMultiplier, 1.12);
  assert.equal(krish.special.id, 'drop_barrage');
  assert.equal(krish.special.shortLabel, 'DROP-BARRAGE');
  assert.equal(krish.special.cooldown, 3.5);
  assert.equal(krish.superName, '10KG HEAVY BAG SMASH');
  assert.equal(getSuperAudioUrl('krish'), '/audio/supers/krish.mp3');
  assert.equal(KRISH_SUPER_AUDIO_URL, '/audio/supers/krish.mp3');
  assert.equal(KRISH_GLB_HEAD_URL, '/models/krish_head.glb');

  // Both Adi and Krish are wired to their 2D PNG portraits across UI
  assert.equal(isPhotoFaceFighter('adi'), true);
  assert.equal(isPhotoFaceFighter('krish'), true);
  assert.equal(REAL_FACE_PHOTO_URLS.adi, '/textures/faces/adi.png');
  assert.equal(REAL_FACE_PHOTO_URLS.krish, '/textures/faces/krish.png');
});

test('buildFittedKrishGlbHead applies exact THREE.Box3 normalization, neck seating, and PBR material/sRGB fixes', () => {
  assert.deepEqual(KRISH_GLB_HEAD_CONFIG, {
    scaleMultiplier: 1.0,
    offsetX: 0.0,
    offsetY: 0.0,
    offsetZ: 0.0,
    rotationY: 0,
  });

  const mockScene = new THREE.Group();
  const albedoTex = new THREE.DataTexture(new Uint8Array([210, 170, 140, 255]), 1, 1);
  albedoTex.colorSpace = THREE.NoColorSpace;
  const rawMat = new THREE.MeshStandardMaterial({
    map: albedoTex,
    metalness: 0.9,
    roughness: 0.12,
    side: THREE.FrontSide,
  });
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.0, 2.0), rawMat);
  headMesh.position.set(3.5, 9.0, -4.0);
  mockScene.add(headMesh);
  mockScene.add(new THREE.PointLight(0xffffff, 2));

  const flashMaterials: THREE.MeshStandardMaterial[] = [];
  const { glbRoot, materials } = buildFittedKrishGlbHead(
    mockScene,
    KRISH_GLB_HEAD_CONFIG,
    KRISH_TARGET_HEAD_HEIGHT,
    KRISH_NECK_PIVOT_Y,
    flashMaterials,
  );

  let foundLight = false;
  glbRoot.traverse((obj) => {
    if ((obj as THREE.Light).isLight) foundLight = true;
  });
  assert.equal(foundLight, false, 'Embedded lights must be stripped from Krish GLB head');

  const fittedBox = new THREE.Box3().setFromObject(glbRoot);
  const fittedSize = new THREE.Vector3();
  const fittedCenter = new THREE.Vector3();
  fittedBox.getSize(fittedSize);
  fittedBox.getCenter(fittedCenter);

  assert.ok(
    Math.abs(fittedSize.y - KRISH_TARGET_HEAD_HEIGHT) < 1e-4,
    `Expected normalized head height ${KRISH_TARGET_HEAD_HEIGHT}, got ${fittedSize.y}`,
  );
  assert.ok(
    Math.abs(fittedBox.min.y - KRISH_NECK_PIVOT_Y) < 1e-4,
    `Expected neck bottom seated at ${KRISH_NECK_PIVOT_Y}, got ${fittedBox.min.y}`,
  );
  assert.ok(Math.abs(fittedCenter.x) < 1e-4, 'Head must be centered on X');
  assert.ok(Math.abs(fittedCenter.z) < 1e-4, 'Head must be centered on Z');

  assert.equal(materials.length, 1);
  const calibrated = materials[0] as THREE.MeshStandardMaterial;
  assert.equal(calibrated.metalness, 0.0);
  assert.equal(calibrated.roughness, 0.72);
  assert.equal(calibrated.side, THREE.DoubleSide);
  assert.equal(calibrated.map?.colorSpace, THREE.SRGBColorSpace);
  assert.equal(flashMaterials.length, 1);
});

test('attachKrishGlbHead caches /models/krish_head.glb across mirror matches and falls back cleanly on load error', () => {
  clearKrishGlbHeadCacheForTests();
  let loadCalls = 0;

  const template = new THREE.Group();
  template.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial()));

  const okLoader = () =>
    ({
      load: (_url: string, onLoad: (gltf: { scene: THREE.Group }) => void) => {
        loadCalls += 1;
        onLoad({ scene: template });
      },
    }) as unknown as Parameters<typeof attachKrishGlbHead>[4] extends
      | (() => infer L)
      | undefined
      ? L
      : never;

  const p1Head = new THREE.Group();
  const p1Fallback = new THREE.Group();
  p1Head.add(p1Fallback);
  const p2Head = new THREE.Group();
  const p2Fallback = new THREE.Group();
  p2Head.add(p2Fallback);

  attachKrishGlbHead(p1Head, p1Fallback, [], () => false, okLoader);
  attachKrishGlbHead(p2Head, p2Fallback, [], () => false, okLoader);

  assert.equal(loadCalls, 1, 'Mirror matches must fetch /models/krish_head.glb only once');
  assert.equal(getKrishGlbHeadStatus(), 'loaded');
  assert.equal(p1Fallback.visible, false);
  assert.equal(p2Fallback.visible, false);

  // Error fallback leaves procedural head visible without crashing
  clearKrishGlbHeadCacheForTests();
  const errHead = new THREE.Group();
  const errFallback = new THREE.Group();
  errHead.add(errFallback);
  attachKrishGlbHead(errHead, errFallback, [], () => false, () => ({
    load: (_url: string, _onLoad: unknown, _onProgress?: unknown, onError?: (err: unknown) => void) => {
      onError?.(new Error('404'));
    },
  }));
  assert.equal(getKrishGlbHeadStatus(), 'failed');
  assert.equal(errFallback.visible, true);
  clearKrishGlbHeadCacheForTests();
});

test('Krish DROP-BARRAGE leaps horizontally forward for 11%-13% maxHP signature damage with 3.5s cooldown', () => {
  const state = createMatchState('krish', 'adi', true);
  state.fighters[0].x = -0.9;
  state.fighters[1].x = 1.0;
  const startHp = state.fighters[1].hp;
  const oppMaxHp = state.fighters[1].maxHp;

  const p1Input = createEmptyInput();
  p1Input.special = true;
  stepMatch(state, [p1Input, createEmptyInput()], 0.016);
  assert.equal(state.fighters[0].specialCooldown, 3.5);
  assert.ok(state.fighters[0].vx > 0, 'DROP-BARRAGE must glide forward toward opponent');

  let landedDropBarrage = false;
  for (let i = 0; i < 40; i++) {
    const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.02);
    if (events.some((e) => e.type === 'heavy_hit' && e.moveCallout === 'DROP-BARRAGE!')) {
      landedDropBarrage = true;
    }
  }
  assert.equal(landedDropBarrage, true, 'DROP-BARRAGE must connect in melee range');
  const dealt = startHp - state.fighters[1].hp;
  const expected = computeSignatureDamage(oppMaxHp);
  assert.equal(dealt, expected);
  assert.ok(dealt / oppMaxHp >= 0.11 && dealt / oppMaxHp <= 0.13);
});

test('Krish Super 10KG HEAVY BAG SMASH respects strict 33% maxHP cap across opponents', () => {
  const opponents: FighterId[] = ['sheru', 'billa', 'mausi', 'father', 'samyak', 'adi', 'krish'];
  for (const oppId of opponents) {
    const state = createMatchState('krish', oppId, true);
    state.fighters[0].x = -0.8;
    state.fighters[1].x = 0.8;
    state.fighters[0].shakti = 100;

    const startHp = state.fighters[1].hp;
    const expectedCap = computeTotalSuperDamage(state.fighters[1].maxHp);

    const p1In = createEmptyInput();
    p1In.superMove = true;
    stepMatch(state, [p1In, createEmptyInput()], 0.016);

    for (let i = 0; i < 165; i++) {
      stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.02);
    }

    const totalDealt = startHp - state.fighters[1].hp;
    assert.equal(
      totalDealt,
      expectedCap,
      `10KG HEAVY BAG SMASH against ${oppId} must deal exactly 33% maxHp (${expectedCap}), got ${totalDealt}`,
    );
    assert.equal(state.fighters[0].shakti, 0);
  }
});
