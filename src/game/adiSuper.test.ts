import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  ADI_SUPER_BANNER,
  ADI_SUPER_DURATION,
  ADI_SUPER_SIGNATURE_TEXT,
} from './adiSuper';
import { ADI_SUPER_AUDIO_URL, getSuperAudioUrl } from './audio';
import { computeSuperCameraTarget } from './camera';
import { FIGHTER_CONFIGS, FIGHTER_LIST } from './characters/configs';
import {
  ADI_GLB_HEAD_CONFIG,
  ADI_GLB_HEAD_URL,
  ADI_NECK_PIVOT_Y,
  ADI_TARGET_HEAD_HEIGHT,
  buildFittedAdiGlbHead,
} from './characters/fatherGlbHead';
import {
  computeSignatureDamage,
  createEmptyInput,
  createMatchState,
  shouldAllowFloatingCallout,
  stepMatch,
} from './combat';
import type { FighterId } from './types';

test('Adi is registered at index 7 of the 9-fighter roster with balanced agile stats, NOTEBOOK SMASH, and ADI LAST-BENCH STRIKE', () => {
  assert.equal(FIGHTER_LIST.length, 9, 'Roster must have 9 playable fighters with Krish at the end');
  assert.deepEqual(
    FIGHTER_LIST.map((f) => f.id),
    ['sheru', 'billa', 'neta', 'anda', 'mausi', 'father', 'samyak', 'adi', 'krish'],
  );

  const adi = FIGHTER_CONFIGS.adi;
  assert.equal(adi.name, 'Adi');
  assert.equal(adi.maxHp, 120);
  assert.equal(adi.attackPowerMultiplier, 1.12);
  assert.equal(adi.special.id, 'notebook_smash');
  assert.equal(adi.special.shortLabel, 'NOTEBOOK SMASH');
  assert.equal(adi.special.cooldown, 3.5);
  assert.equal(adi.superName, 'ADI LAST-BENCH STRIKE');
  assert.equal(getSuperAudioUrl('adi'), '/audio/supers/adi.mp3');
  assert.equal(ADI_SUPER_AUDIO_URL, '/audio/supers/adi.mp3');
  assert.equal(ADI_GLB_HEAD_URL, '/models/adi_head.glb');
});

test('buildFittedAdiGlbHead applies exact THREE.Box3 bounding-box normalization, neck pivot grounding, and PBR material/sRGB fixes', () => {
  assert.deepEqual(ADI_GLB_HEAD_CONFIG, {
    scaleMultiplier: 1.0,
    offsetX: 0.0,
    offsetY: 0.0,
    offsetZ: 0.0,
    rotationY: 0,
  });

  // Synthetic off-center & oversized raw GLB head scene
  const mockScene = new THREE.Group();
  const albedoTex = new THREE.DataTexture(new Uint8Array([220, 180, 150, 255]), 1, 1);
  albedoTex.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: albedoTex,
    metalness: 0.85,
    roughness: 0.2,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.0, 2.4), mat);
  // Shift mesh off-center in raw space so min.y = 1.5, center = (3.2, 3.5, -1.8)
  mesh.position.set(3.2, 3.5, -1.8);
  mockScene.add(mesh);

  const customCfg = {
    scaleMultiplier: 1.1,
    offsetX: 0.02,
    offsetY: 0.03,
    offsetZ: -0.01,
    rotationY: 0.15,
  };
  const { glbRoot, materials } = buildFittedAdiGlbHead(
    mockScene,
    customCfg,
    ADI_TARGET_HEAD_HEIGHT,
    ADI_NECK_PIVOT_Y,
  );

  glbRoot.updateMatrixWorld(true);
  const fittedBox = new THREE.Box3().setFromObject(glbRoot);
  const fittedSize = new THREE.Vector3();
  const fittedCenter = new THREE.Vector3();
  fittedBox.getSize(fittedSize);
  fittedBox.getCenter(fittedCenter);

  const expectedHeight = ADI_TARGET_HEAD_HEIGHT * customCfg.scaleMultiplier;
  assert.ok(
    Math.abs(fittedSize.y - expectedHeight) < 0.002,
    `Fitted height (${fittedSize.y.toFixed(4)}) must match target*scaleMultiplier (${expectedHeight.toFixed(4)})`,
  );
  assert.ok(
    Math.abs(fittedBox.min.y - (ADI_NECK_PIVOT_Y + customCfg.offsetY)) < 0.002,
    `Bottom min.y (${fittedBox.min.y.toFixed(4)}) must align flush with neckJointY + offsetY (${(ADI_NECK_PIVOT_Y + customCfg.offsetY).toFixed(4)})`,
  );
  assert.ok(
    Math.abs(fittedCenter.x - customCfg.offsetX) < 0.005,
    `Centered X (${fittedCenter.x.toFixed(4)}) must match offsetX (${customCfg.offsetX})`,
  );
  assert.ok(
    Math.abs(fittedCenter.z - customCfg.offsetZ) < 0.005,
    `Centered Z (${fittedCenter.z.toFixed(4)}) must match offsetZ (${customCfg.offsetZ})`,
  );
  assert.equal(glbRoot.rotation.y, customCfg.rotationY);

  assert.equal(materials.length, 1);
  const clonedMat = materials[0] as THREE.MeshStandardMaterial;
  assert.equal(clonedMat.metalness, 0.0);
  assert.equal(clonedMat.roughness, 0.72);
  assert.equal(clonedMat.side, THREE.DoubleSide);
  assert.equal(clonedMat.map?.colorSpace, THREE.SRGBColorSpace);
});

test('Adi 5th Signature Move (NOTEBOOK SMASH) spawns a spiral notebook projectile with 3.5s cooldown & 11-13% scaled damage', () => {
  const state = createMatchState('adi', 'sheru', true);
  const [adi, sheru] = state.fighters;
  adi.x = -2.2;
  sheru.x = 2.0;

  const p1In = createEmptyInput();
  p1In.special = true;
  stepMatch(state, [p1In, createEmptyInput()], 0.016);
  assert.equal(adi.action, 'special');
  assert.equal(adi.specialCooldown, 3.5);

  let spawnedNotebook = false;
  let hitNotebook = false;
  const startHp = sheru.hp;

  for (let i = 0; i < 95; i++) {
    const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.016);
    if (state.projectiles.some((p) => p.kind === 'notebook')) {
      spawnedNotebook = true;
    }
    if (events.some((ev) => ev.type === 'heavy_hit' && ev.moveCallout === 'NOTEBOOK SMASH!')) {
      hitNotebook = true;
      break;
    }
  }

  assert.ok(spawnedNotebook, 'NOTEBOOK SMASH must spawn a 3D spiral notebook projectile');
  assert.ok(hitNotebook, 'NOTEBOOK SMASH projectile must hit opponent cleanly');
  const dmg = startHp - sheru.hp;
  const expectedDmg = computeSignatureDamage(sheru.maxHp, FIGHTER_CONFIGS.adi.attackPowerMultiplier);
  assert.equal(dmg, expectedDmg, `Expected ${expectedDmg} signature damage, got ${dmg}`);
});

test('ADI LAST-BENCH STRIKE! obeys strict 33% maxHP damage cap across opponents and resolves KO cleanly on finisher', () => {
  assert.equal(ADI_SUPER_BANNER, 'ADI LAST-BENCH STRIKE!');
  const opponents: FighterId[] = ['sheru', 'father', 'samyak', 'adi'];

  for (const oppId of opponents) {
    const state = createMatchState('adi', oppId, true);
    const [adi, opp] = state.fighters;
    adi.shakti = 100;
    const expectedCap = Math.round(opp.maxHp * 0.33);
    const startHp = opp.hp;

    const p1In = createEmptyInput();
    p1In.superMove = true;
    stepMatch(state, [p1In, createEmptyInput()], 0.016);

    assert.equal(adi.shakti, 0);
    assert.ok(state.adiSuper?.active);

    let barrageHits = 0;
    let sawImpact = false;
    let sawEnd = false;
    const allowedWords: string[] = [];

    for (let i = 0; i < 340; i++) {
      const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.016);
      for (const ev of events) {
        if (ev.word && shouldAllowFloatingCallout(state, ev)) {
          allowedWords.push(ev.word);
        }
      }
      for (const sig of state.adiSuperSignals) {
        if (sig.kind === 'barrage_hit') barrageHits++;
        if (sig.kind === 'last_bench_impact') sawImpact = true;
        if (sig.kind === 'super_end') sawEnd = true;
      }
      if (!state.adiSuper?.active && sawEnd) break;
    }

    assert.equal(state.adiSuper?.active ?? false, false);
    assert.equal(barrageHits, 6);
    assert.ok(sawImpact);
    assert.ok(sawEnd);
    assert.equal(adi.y, 0);
    assert.equal(adi.action, 'idle');
    assert.deepEqual(allowedWords, [ADI_SUPER_SIGNATURE_TEXT]);
    assert.equal(startHp - opp.hp, expectedCap, `Strict 33% cap failed for ${oppId}`);
    assert.equal(adi.superDamageDealt, expectedCap);
  }

  // Verify non-lethal barrage & clean finisher KO
  const koState = createMatchState('adi', 'billa', true);
  const [adiKo, billa] = koState.fighters;
  adiKo.shakti = 100;
  billa.hp = 18;
  const inp = createEmptyInput();
  inp.superMove = true;
  stepMatch(koState, [inp, createEmptyInput()], 0.016);

  let earlyKo = false;
  let sawKo = false;
  for (let i = 0; i < 340; i++) {
    const events = stepMatch(koState, [createEmptyInput(), createEmptyInput()], 0.016);
    if (koState.adiSuper?.active && koState.adiSuper.elapsed < 3.55 && billa.hp <= 0) {
      earlyKo = true;
    }
    if (events.some((e) => e.type === 'ko')) sawKo = true;
    if (koState.phase === 'ko_freeze') break;
  }
  assert.equal(earlyKo, false);
  assert.ok(sawKo);
  assert.equal(billa.hp, 0);

  const camEnd = computeSuperCameraTarget(ADI_SUPER_DURATION, ADI_SUPER_DURATION, -2, 1, 2, false, 'adi', 0);
  assert.ok(Math.abs(camEnd.z - 9.2) < 0.01);
});
