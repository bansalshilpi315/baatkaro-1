import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildFighterRig,
  FIGHTER_CONFIGS,
  FIGHTER_LIST,
  ROSTER_SLOTS,
  UTKARSH_GLB_HEAD_CONFIG,
} from './characters';
import {
  buildFittedKrishGlbHead,
  buildFittedUtkarshGlbHead,
  KRISH_NECK_PIVOT_Y,
  UTKARSH_GLB_HEAD_URL,
  UTKARSH_NECK_PIVOT_Y,
  UTKARSH_TARGET_HEAD_HEIGHT,
} from './characters/fatherGlbHead';
import {
  isPhotoFaceFighter,
  REAL_FACE_PHOTO_URLS,
} from './characters/photoFaceLoader';
import { getSuperAudioUrl, UTKARSH_SUPER_AUDIO_URL } from './audio';
import {
  PRELOAD_AUDIO_URLS,
  PRELOAD_GLB_URLS,
  PRELOAD_PORTRAIT_URLS,
  TOTAL_STARTUP_PRELOAD_ASSETS,
} from './assetPreloader';
import {
  computeSignatureDamage,
  createEmptyInput,
  createMatchState,
  stepMatch,
} from './combat';
import {
  FIGHTER_UNLOCK_ADS,
  FIGHTER_UNLOCK_COSTS,
  STARTER_FIGHTERS,
} from './playerAccount';
import {
  buildBugReportMailtoUrl,
  DEVELOPER_BUG_EMAIL,
  DEVELOPER_HOBBIES,
  DEVELOPER_NAME,
  DEVELOPER_ROLE_BADGE,
  DEVELOPER_VISION_NOTE,
} from '../utils/bugReport';

// Minimal headless canvas shim so Three.js CanvasTexture & faceCanvas work in Node tests
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const makeStubGradient = () => ({ addColorStop: noop });
  const makeStubCtx = () =>
    new Proxy(
      {
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        globalAlpha: 1,
        font: '12px sans-serif',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        shadowColor: 'transparent',
        shadowBlur: 0,
        createLinearGradient: makeStubGradient,
        createRadialGradient: makeStubGradient,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
        measureText: (txt: string) => ({ width: txt.length * 8 }),
      } as Record<string, unknown>,
      {
        get(target, prop) {
          if (prop in target) return target[prop as string];
          return noop;
        },
      },
    );

  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 256,
          height: 256,
          getContext: () => makeStubCtx(),
        };
      }
      return {};
    },
  };
}

function collectNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((obj) => {
    if (obj.name) names.push(obj.name);
  });
  return names;
}

function findProceduralNeckMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const lower = obj.name.toLowerCase();
      if (lower.includes('neck') && !lower.includes('vneck')) {
        found.push(obj);
      }
    }
  });
  return found;
}

test('PART 1: Utkarsh is active playable Slot #3 (125 HP, Unlocked starter, SWIFT COMBO, UTKARSH QUICK-STEP RUSH)', () => {
  assert.equal(FIGHTER_LIST.length, 10);
  assert.equal(ROSTER_SLOTS.length, 10);
  assert.equal(FIGHTER_LIST[2].id, 'utkarsh');
  assert.equal(ROSTER_SLOTS[2].kind, 'playable');
  assert.equal(ROSTER_SLOTS[2].fighter.id, 'utkarsh');

  const utkarsh = FIGHTER_CONFIGS.utkarsh;
  assert.equal(utkarsh.name, 'Utkarsh');
  assert.equal(utkarsh.maxHp, 125);
  assert.equal(utkarsh.walkSpeed, 5.25);
  assert.equal(utkarsh.jumpVelocity, 11.3);
  assert.equal(utkarsh.special.id, 'swift_combo');
  assert.equal(utkarsh.special.shortLabel, 'SWIFT COMBO');
  assert.equal(utkarsh.special.cooldown, 3.5);
  assert.equal(utkarsh.superName, 'UTKARSH QUICK-STEP RUSH');

  assert.equal(STARTER_FIGHTERS.includes('utkarsh'), true);
  assert.equal(FIGHTER_UNLOCK_COSTS.utkarsh, 0);
  assert.equal(FIGHTER_UNLOCK_ADS.utkarsh, 0);

  assert.equal(UTKARSH_GLB_HEAD_URL, '/models/utkarsh_head.glb');
  assert.equal(UTKARSH_SUPER_AUDIO_URL, '/audio/supers/utkarsh.mp3');
  assert.equal(getSuperAudioUrl('utkarsh'), '/audio/supers/utkarsh.mp3');
  assert.equal(isPhotoFaceFighter('utkarsh'), true);
  assert.equal(REAL_FACE_PHOTO_URLS.utkarsh, '/textures/faces/utkarsh.png');

  assert.equal(TOTAL_STARTUP_PRELOAD_ASSETS, 27);
  assert.ok(PRELOAD_GLB_URLS.includes('/models/utkarsh_head.glb'));
  assert.ok(PRELOAD_PORTRAIT_URLS.includes('/textures/faces/utkarsh.png'));
  assert.ok(PRELOAD_AUDIO_URLS.includes('/audio/supers/utkarsh.mp3'));
});

test('PART 1: Utkarsh combat moves (SWIFT COMBO & 33%-capped UTKARSH QUICK-STEP RUSH) work cleanly', () => {
  const sigDmg = computeSignatureDamage(FIGHTER_CONFIGS.krish.maxHp);
  const sigPct = sigDmg / FIGHTER_CONFIGS.krish.maxHp;
  assert.ok(sigPct >= 0.11 && sigPct <= 0.13);

  // Trigger Utkarsh SWIFT COMBO signature lunge
  const sigState = createMatchState('utkarsh', 'krish', true);
  sigState.fighters[0].x = -0.9;
  sigState.fighters[1].x = 1.0;
  const sigStartHp = sigState.fighters[1].hp;
  const sigIn = createEmptyInput();
  sigIn.special = true;
  stepMatch(sigState, [sigIn, createEmptyInput()], 0.016);
  assert.equal(sigState.fighters[0].specialCooldown, 3.5);
  assert.ok(sigState.fighters[0].vx > 0, 'SWIFT COMBO must lunge forward toward opponent');
  for (let i = 0; i < 40; i++) {
    stepMatch(sigState, [createEmptyInput(), createEmptyInput()], 0.02);
  }
  assert.equal(sigStartHp - sigState.fighters[1].hp, sigDmg);

  // Trigger Utkarsh Super against Krish and verify strict 33% maxHp cap
  const state = createMatchState('utkarsh', 'krish', true);
  state.fighters[0].x = -0.9;
  state.fighters[1].x = 0.9;
  state.fighters[0].shakti = 100;
  const startHp = state.fighters[1].hp;
  const maxAllowed = Math.round(state.fighters[1].maxHp * 0.33);

  const superIn = { ...createEmptyInput(), superMove: true };
  const idleIn = createEmptyInput();
  stepMatch(state, [superIn, idleIn], 1 / 60);
  assert.equal(state.fighters[0].action, 'super');

  for (let i = 0; i < 240; i++) {
    stepMatch(state, [idleIn, idleIn], 1 / 60);
  }
  const dealt = startHp - state.fighters[1].hp;
  assert.ok(dealt > 0 && dealt <= maxAllowed, `Utkarsh super dealt ${dealt}, cap is ${maxAllowed}`);
});

test('PART 1: Utkarsh 3D body has ZERO procedural neck, reference-accurate outfit, right-wrist kalava, and clean GLB seating', () => {
  const utkarshRig = buildFighterRig('utkarsh');
  const adiRig = buildFighterRig('adi');
  const krishRig = buildFighterRig('krish');

  // Strict zero procedural neck mesh on Utkarsh
  assert.equal(
    findProceduralNeckMeshes(utkarshRig.torso).length,
    0,
    'Utkarsh torso must have ZERO procedural Three.js neck meshes',
  );
  assert.equal(
    findProceduralNeckMeshes(utkarshRig.head).length,
    0,
    'Utkarsh head must have ZERO procedural Three.js neck meshes',
  );

  // Narrower slim teenage shoulder/torso profile compared to Adi and Krish
  assert.ok(
    Math.abs(utkarshRig.rightShoulder.position.x) < Math.abs(adiRig.rightShoulder.position.x),
    'Utkarsh shoulders should be narrower than Adi',
  );
  assert.ok(
    Math.abs(utkarshRig.rightShoulder.position.x) < Math.abs(krishRig.rightShoulder.position.x),
    'Utkarsh shoulders should be narrower than Krish',
  );

  const allNames = collectNames(utkarshRig.root);
  const expectedOutfitParts = [
    'utkarsh_plaid_torso',
    'utkarsh_vneck_chest_open',
    'utkarsh_undershirt_peek',
    'utkarsh_open_collar',
    'utkarsh_button_placket',
    'utkarsh_chest_pocket',
    'utkarsh_rolled_cuff_left',
    'utkarsh_rolled_cuff_right',
    'utkarsh_kalava_wrist_thread',
    'utkarsh_trackpants_pelvis',
    'utkarsh_drawstrings',
    'utkarsh_trackpant_thigh_left',
    'utkarsh_trackpant_thigh_right',
    'utkarsh_trackpant_shin_left',
    'utkarsh_trackpant_shin_right',
    'utkarsh_sneaker_left',
    'utkarsh_sneaker_right',
  ];
  for (const part of expectedOutfitParts) {
    assert.ok(allNames.includes(part), `Missing Utkarsh 3D outfit part: ${part}`);
  }

  // Pocket on anatomical LEFT (+X when facing +Z)
  const pocket = utkarshRig.torso.getObjectByName('utkarsh_chest_pocket');
  assert.ok(pocket && pocket.position.x > 0, 'Utkarsh chest pocket must be on anatomical left (+X)');

  // Kalava strictly on anatomical RIGHT wrist (rig.leftElbow, -X), NOT on anatomical left wrist (rig.rightElbow)
  assert.ok(
    utkarshRig.leftElbow.getObjectByName('utkarsh_kalava_wrist_thread'),
    'Kalava thread must be on anatomical right wrist (rig.leftElbow)',
  );
  assert.equal(
    utkarshRig.rightElbow.getObjectByName('utkarsh_kalava_wrist_thread'),
    undefined,
    'Kalava thread must NOT appear on anatomical left wrist (rig.rightElbow)',
  );

  // Synthetic GLB head bounding-box seating directly inside open V-neck collar
  assert.deepEqual(UTKARSH_GLB_HEAD_CONFIG, {
    scaleMultiplier: 1.0,
    offsetX: 0.0,
    offsetY: 0.0,
    offsetZ: 0.0,
    rotationY: 0,
  });

  const mockGlb = new THREE.Group();
  const tex = new THREE.DataTexture(new Uint8Array([215, 175, 145, 255]), 1, 1);
  tex.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.2, metalness: 0.5 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 1.0), mat);
  mesh.position.set(1.5, 4.0, -2.0);
  mockGlb.add(mesh);

  const { glbRoot: fitted, materials } = buildFittedUtkarshGlbHead(mockGlb);
  fitted.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fitted);
  const size = new THREE.Vector3();
  box.getSize(size);
  assert.ok(
    Math.abs(size.y - UTKARSH_TARGET_HEAD_HEIGHT) < 0.005,
    `Utkarsh GLB height should normalize to ${UTKARSH_TARGET_HEAD_HEIGHT}, got ${size.y}`,
  );
  assert.ok(
    Math.abs(box.min.y - UTKARSH_NECK_PIVOT_Y) < 0.005,
    `Utkarsh GLB min.y must align with UTKARSH_NECK_PIVOT_Y (${UTKARSH_NECK_PIVOT_Y}), got ${box.min.y}`,
  );
  const neckBottomInTorsoSpace = utkarshRig.head.position.y + box.min.y * utkarshRig.head.scale.y;
  assert.ok(
    neckBottomInTorsoSpace < 0.595 && neckBottomInTorsoSpace > 0.54,
    `Utkarsh GLB neck base (${neckBottomInTorsoSpace.toFixed(3)}) must seat cleanly inside V-neck collar (0.595)`,
  );
  const calibrated = materials[0] as THREE.MeshStandardMaterial;
  assert.equal(calibrated.map?.colorSpace, THREE.SRGBColorSpace);
  assert.ok(calibrated.roughness >= 0.72);
  assert.ok(calibrated.metalness <= 0.05);
});

test('PART 2: Krish 3D body has ZERO procedural neck mesh and GLB neck seats cleanly inside olive ribbed collar', () => {
  const krishRig = buildFighterRig('krish');

  assert.equal(
    findProceduralNeckMeshes(krishRig.torso).length,
    0,
    'Krish torso must have ZERO duplicate procedural neck meshes',
  );
  assert.equal(
    findProceduralNeckMeshes(krishRig.head).length,
    0,
    'Krish head must have ZERO duplicate procedural neck meshes',
  );

  // Confirm Krish's collar and sweatshirt still exist intact
  const names = collectNames(krishRig.root);
  assert.ok(names.includes('krish_ribbed_collar'));
  assert.ok(names.includes('krish_sweatshirt_torso'));
  assert.ok(names.includes('krish_backpack'));

  const mockGlb = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 2.0, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xd8a882 }),
  );
  mockGlb.add(mesh);

  const { glbRoot: fitted } = buildFittedKrishGlbHead(mockGlb);
  fitted.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fitted);
  assert.ok(
    Math.abs(box.min.y - KRISH_NECK_PIVOT_Y) < 0.005,
    `Krish GLB min.y must seat at KRISH_NECK_PIVOT_Y (${KRISH_NECK_PIVOT_Y}), got ${box.min.y}`,
  );
  const neckBottomInTorsoSpace = krishRig.head.position.y + box.min.y * krishRig.head.scale.y;
  assert.ok(
    neckBottomInTorsoSpace < 0.628 && neckBottomInTorsoSpace > 0.56,
    `Krish GLB neck base (${neckBottomInTorsoSpace.toFixed(3)}) must tuck cleanly inside ribbed collar (0.628)`,
  );
});

test('PART 3: Settings Modal Bug Report mailto builder & About Developer metadata match exact specifications', () => {
  assert.equal(DEVELOPER_BUG_EMAIL, 'bansalansh315@gmail.com');
  assert.equal(DEVELOPER_NAME, 'Ansh Bansal');
  assert.equal(DEVELOPER_ROLE_BADGE, 'CREATOR & LEAD DEVELOPER');
  assert.deepEqual([...DEVELOPER_HOBBIES], [
    '3D Web Game Dev',
    '2D & 3D Character Animation',
    'Interactive Coding',
    'Creative Tech Experiments',
  ]);
  assert.equal(
    DEVELOPER_VISION_NOTE,
    "Hi! I'm Ansh Bansal — I love building 3D browser games, animating characters, and turning creative ideas into playable worlds. I created DESI DANGAL with a simple goal: to fuse classic arcade fighting energy with relatable desi characters, school & mohalla legends, and over-the-top superpowers that anyone can play instantly right in their browser without heavy downloads.",
  );

  const mailtoUrl = buildBugReportMailtoUrl('Utkarsh combo test report', {
    viewportWidth: 1280,
    viewportHeight: 720,
    orientation: 'Landscape',
  });
  assert.ok(mailtoUrl.startsWith('mailto:bansalansh315@gmail.com?'));
  assert.ok(mailtoUrl.includes('subject=DESI%20DANGAL%20-%20Bug%20Report'));
  assert.ok(mailtoUrl.includes('Utkarsh%20combo%20test%20report'));
  assert.ok(mailtoUrl.includes('1280x720'));
  assert.ok(mailtoUrl.includes('Landscape'));

  // Empty description gracefully provides template prompt
  const emptyUrl = buildBugReportMailtoUrl('   ', {
    viewportWidth: 844,
    viewportHeight: 390,
    orientation: 'Landscape',
  });
  assert.ok(emptyUrl.startsWith('mailto:bansalansh315@gmail.com?'));
  assert.ok(emptyUrl.includes('844x390'));
});
