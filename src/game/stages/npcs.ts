import * as THREE from 'three';
import { getContactShadowTexture } from '../characters/rig';

export type SupporterProp = 'none' | 'chai' | 'sign' | 'notebook' | 'pen' | 'placard' | 'luggage';

export interface AmbientNpc {
  group: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  head: THREE.Object3D;
  baseY: number;
  baseX: number;
  baseZ: number;
  baseYaw: number;
  mode: 'stroll' | 'balcony' | 'seated' | 'vendor' | 'operator' | 'supporter';
  prop: SupporterProp;
  walkMinX: number;
  walkMaxX: number;
  speed: number;
  dir: 1 | -1;
  phase: number;
  isSecondary: boolean;
}

export interface AmbientCow {
  group: THREE.Group;
  legs: THREE.Object3D[];
  head: THREE.Object3D;
  tail: THREE.Object3D;
  walkMinX: number;
  walkMaxX: number;
  speed: number;
  dir: 1 | -1;
  isSecondary: boolean;
}

function markShared<T extends THREE.BufferGeometry | THREE.Material>(asset: T): T {
  asset.userData.shared = true;
  return asset;
}

// Shared low-poly geometries for mobile 60 FPS performance
const torsoGeo = markShared(new THREE.CylinderGeometry(0.19, 0.22, 0.56, 8));
const headGeo = markShared(new THREE.SphereGeometry(0.18, 10, 8));
const armGeo = markShared(new THREE.CapsuleGeometry(0.055, 0.24, 4, 6));
const legGeo = markShared(new THREE.CapsuleGeometry(0.065, 0.26, 4, 6));
const shadowGeo = markShared(new THREE.CircleGeometry(0.36, 12));
const eyeGeo = markShared(new THREE.SphereGeometry(0.022, 6, 6));
const hairCapGeo = markShared(new THREE.SphereGeometry(0.188, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52));
const capGeo = markShared(new THREE.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52));
const turbanGeo = markShared(new THREE.TorusGeometry(0.16, 0.065, 6, 12));
const sareeDrapeGeo = markShared(new THREE.BoxGeometry(0.14, 0.56, 0.44));

// Shared low-poly supporter prop geometries & base materials
const chaiCupGeo = markShared(new THREE.CylinderGeometry(0.07, 0.05, 0.14, 8));
const chaiLiquidGeo = markShared(new THREE.CircleGeometry(0.064, 8));
const stickGeo = markShared(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 6));
const signBoardGeo = markShared(new THREE.BoxGeometry(0.76, 0.4, 0.035));
const placardBoardGeo = markShared(new THREE.BoxGeometry(0.84, 0.44, 0.04));
const notebookGeo = markShared(new THREE.BoxGeometry(0.28, 0.34, 0.05));
const penBodyGeo = markShared(new THREE.CylinderGeometry(0.02, 0.016, 0.36, 6));
const penTipGeo = markShared(new THREE.ConeGeometry(0.02, 0.06, 6));
const luggageGeo = markShared(new THREE.BoxGeometry(0.56, 0.28, 0.34));
const luggageStrapGeo = markShared(new THREE.BoxGeometry(0.58, 0.05, 0.36));

const sharedEyeMat = markShared(new THREE.MeshBasicMaterial({ color: 0x0f172a }));
const sharedCapMat = markShared(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }));
const sharedWoodStickMat = markShared(new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 }));
const sharedChaiCupMat = markShared(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 }));
const sharedChaiTeaMat = markShared(new THREE.MeshBasicMaterial({ color: 0x78350f }));
const sharedNotebookPageMat = markShared(new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.75 }));
const sharedPenBlueMat = markShared(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.25 }));
const sharedPenTipMat = markShared(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 }));
const sharedLuggageMat = markShared(new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.72 }));
const sharedLuggageStrapMat = markShared(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }));
const sharedShadowMat = markShared(
  new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  }),
);

export function createLowPolyNpc(opts: {
  shirtColor: number;
  pantColor: number;
  skinColor?: number;
  hairColor?: number;
  turbanColor?: number;
  sareeColor?: number;
  hasCap?: boolean;
  mode: AmbientNpc['mode'];
  prop?: SupporterProp;
  signTexture?: THREE.CanvasTexture;
  scale?: number;
  faceYaw?: number;
  x: number;
  y?: number;
  z: number;
  walkMinX?: number;
  walkMaxX?: number;
  speed?: number;
  phase?: number;
  isSecondary?: boolean;
}): AmbientNpc {
  const group = new THREE.Group();
  const baseY = opts.y ?? 0;
  const prop: SupporterProp = opts.prop ?? 'none';

  const shirtMat = new THREE.MeshStandardMaterial({ color: opts.shirtColor, roughness: 0.78 });
  const pantMat = new THREE.MeshStandardMaterial({ color: opts.pantColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: opts.skinColor ?? 0xc68652, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: opts.hairColor ?? 0x18181b, roughness: 0.65 });

  // Contact shadow (only on ground/platform NPCs)
  if (opts.mode !== 'balcony' && opts.mode !== 'seated') {
    const shadow = new THREE.Mesh(shadowGeo, sharedShadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);
  }

  const body = new THREE.Group();
  body.position.y = opts.mode === 'seated' ? 0.52 : opts.mode === 'vendor' ? 0.68 : 0.47;
  group.add(body);

  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 0.24;
  body.add(torso);

  if (opts.sareeColor !== undefined) {
    const drape = new THREE.Mesh(
      sareeDrapeGeo,
      new THREE.MeshStandardMaterial({ color: opts.sareeColor, roughness: 0.62 }),
    );
    drape.position.set(0.03, 0.24, 0.01);
    drape.rotation.z = -0.34;
    body.add(drape);
  }

  const head = new THREE.Group();
  head.position.y = 0.68;
  body.add(head);

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  head.add(headMesh);

  if (opts.turbanColor !== undefined) {
    const turban = new THREE.Mesh(
      turbanGeo,
      new THREE.MeshStandardMaterial({ color: opts.turbanColor, roughness: 0.7 }),
    );
    turban.rotation.x = Math.PI / 2;
    turban.position.y = 0.09;
    head.add(turban);
  } else if (opts.hasCap) {
    const cap = new THREE.Mesh(capGeo, sharedCapMat);
    cap.position.y = 0.03;
    head.add(cap);
  } else {
    const hair = new THREE.Mesh(hairCapGeo, hairMat);
    hair.position.y = 0.02;
    head.add(hair);
  }

  // Head luggage trunk for Railway Red-Shirt Coolies!
  if (prop === 'luggage') {
    const trunk = new THREE.Mesh(luggageGeo, sharedLuggageMat);
    trunk.position.set(0, 0.27, 0);
    const strap = new THREE.Mesh(luggageStrapGeo, sharedLuggageStrapMat);
    strap.position.set(0, 0.27, 0);
    head.add(trunk, strap);
  }

  // Eyes (two tiny crisp dots facing +Z)
  [-0.06, 0.06].forEach((ex) => {
    const e = new THREE.Mesh(eyeGeo, sharedEyeMat);
    e.position.set(ex, 0.02, 0.16);
    head.add(e);
  });

  // Articulated arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.24, 0.44, 0);
  const lArmMesh = new THREE.Mesh(armGeo, shirtMat);
  lArmMesh.position.y = -0.14;
  leftArm.add(lArmMesh);
  body.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.24, 0.44, 0);
  const rArmMesh = new THREE.Mesh(armGeo, shirtMat);
  rArmMesh.position.y = -0.14;
  rightArm.add(rArmMesh);
  body.add(rightArm);

  // Attach handheld stage-specific supporter props to rightArm
  if (prop === 'chai') {
    const cup = new THREE.Mesh(chaiCupGeo, sharedChaiCupMat);
    cup.position.set(0, -0.32, 0.06);
    const tea = new THREE.Mesh(chaiLiquidGeo, sharedChaiTeaMat);
    tea.rotation.x = -Math.PI / 2;
    tea.position.set(0, -0.245, 0.06);
    rightArm.add(cup, tea);
  } else if ((prop === 'sign' || prop === 'placard') && opts.signTexture) {
    const holder = new THREE.Group();
    holder.position.set(0, -0.28, 0.06);
    // Point stick upward when arm raises or rests forward
    holder.rotation.x = Math.PI * 0.55;
    const stick = new THREE.Mesh(stickGeo, sharedWoodStickMat);
    stick.position.y = 0.25;
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: opts.signTexture,
      roughness: 0.92,
      metalness: 0,
    });
    // Mark signTexture as shared so multiple supporters sharing one CanvasTexture dispose safely
    opts.signTexture.userData.shared = true;
    const board = new THREE.Mesh(prop === 'placard' ? placardBoardGeo : signBoardGeo, boardMat);
    board.position.y = 0.62;
    holder.add(stick, board);
    rightArm.add(holder);
  } else if (prop === 'notebook') {
    const coverMat = new THREE.MeshStandardMaterial({ color: opts.shirtColor === 0xf8fafc ? 0x2563eb : 0xdc2626, roughness: 0.55 });
    const book = new THREE.Mesh(notebookGeo, [
      coverMat,
      coverMat,
      sharedNotebookPageMat,
      sharedNotebookPageMat,
      coverMat,
      coverMat,
    ]);
    book.position.set(0, -0.34, 0.08);
    book.rotation.x = 0.35;
    rightArm.add(book);
  } else if (prop === 'pen') {
    const pen = new THREE.Group();
    const shaft = new THREE.Mesh(penBodyGeo, sharedPenBlueMat);
    const tip = new THREE.Mesh(penTipGeo, sharedPenTipMat);
    tip.position.y = 0.21;
    pen.add(shaft, tip);
    pen.position.set(0, -0.34, 0.07);
    pen.rotation.x = 0.85;
    rightArm.add(pen);
  }

  // Articulated legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.1, -0.04, 0);
  const lLegMesh = new THREE.Mesh(legGeo, pantMat);
  lLegMesh.position.y = -0.22;
  leftLeg.add(lLegMesh);
  body.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.1, -0.04, 0);
  const rLegMesh = new THREE.Mesh(legGeo, pantMat);
  rLegMesh.position.y = -0.22;
  rightLeg.add(rLegMesh);
  body.add(rightLeg);

  if (opts.mode === 'seated') {
    leftLeg.rotation.x = -Math.PI * 0.45;
    rightLeg.rotation.x = -Math.PI * 0.45;
  }

  if (opts.scale && opts.scale !== 1) {
    group.scale.setScalar(opts.scale);
  }

  const baseYaw = opts.faceYaw ?? 0;
  group.position.set(opts.x, baseY, opts.z);
  group.rotation.y = baseYaw;

  return {
    group,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    baseY,
    baseX: opts.x,
    baseZ: opts.z,
    baseYaw,
    mode: opts.mode,
    prop,
    walkMinX: opts.walkMinX ?? opts.x - 3,
    walkMaxX: opts.walkMaxX ?? opts.x + 3,
    speed: opts.speed ?? 1.15,
    dir: Math.random() > 0.5 ? 1 : -1,
    phase: opts.phase ?? Math.random() * Math.PI * 2,
    isSecondary: opts.isSecondary ?? false,
  };
}

export function updateAmbientNpcs(
  npcs: AmbientNpc[],
  elapsed: number,
  dt: number,
  excitement: number,
): void {
  const cheering = excitement > 0.05;
  const cheerBoost = Math.min(1, excitement);

  for (const npc of npcs) {
    if (!npc.group.visible) continue;
    const t = elapsed + npc.phase;

    if (npc.mode === 'supporter') {
      if (cheering) {
        // Excited 1.5s jump & prop-waving cheer burst!
        const hop = Math.abs(Math.sin(t * 13.5)) * 0.3 * cheerBoost;
        npc.group.position.y = npc.baseY + hop;
        npc.group.rotation.z = Math.sin(t * 11) * 0.09 * cheerBoost;
        npc.group.rotation.y = npc.baseYaw + Math.sin(t * 7) * 0.12 * cheerBoost;
        npc.head.rotation.y = Math.sin(t * 8) * 0.16;

        if (npc.prop === 'sign' || npc.prop === 'placard') {
          // Pump placard/sign high in the air while cheering!
          npc.rightArm.rotation.x = -1.75 + Math.sin(t * 15) * 0.34;
          npc.rightArm.rotation.z = 0.15 + Math.cos(t * 13) * 0.18;
          npc.leftArm.rotation.x = -2.65 + Math.cos(t * 15) * 0.38;
          npc.leftArm.rotation.z = -0.18;
        } else if (npc.prop === 'luggage') {
          // Coolie holds trunk steady with left hand & waves right fist wildly!
          npc.leftArm.rotation.x = -2.55;
          npc.leftArm.rotation.z = 0.35;
          npc.rightArm.rotation.x = -2.65 + Math.sin(t * 16) * 0.45;
          npc.rightArm.rotation.z = 0.22;
        } else {
          // Wave both arms (notebooks, pens, chai cups, clapping hands) high!
          npc.leftArm.rotation.x = -2.55 + Math.sin(t * 15) * 0.42;
          npc.rightArm.rotation.x = -2.55 - Math.sin(t * 15) * 0.42;
          npc.leftArm.rotation.z = -0.18;
          npc.rightArm.rotation.z = 0.18;
        }
        npc.leftLeg.rotation.x = hop * 0.6;
        npc.rightLeg.rotation.x = -hop * 0.6;
      } else {
        // Idle supporter: gentle rhythmic sway, subtle bounce & clapping facing center fighters
        npc.group.position.y = npc.baseY + Math.abs(Math.sin(t * 2.4)) * 0.03;
        npc.group.rotation.z = Math.sin(t * 2.1) * 0.04;
        npc.group.rotation.y = npc.baseYaw;
        npc.head.rotation.y = Math.sin(t * 1.6) * 0.18;
        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;

        if (npc.prop === 'sign' || npc.prop === 'placard') {
          // Hold sign upright so text is crisp & readable, gently bobbing
          npc.rightArm.rotation.x = -1.42 + Math.sin(t * 2.8) * 0.12;
          npc.rightArm.rotation.z = 0.06;
          npc.leftArm.rotation.x = -0.45 + Math.sin(t * 3.2) * 0.16;
          npc.leftArm.rotation.z = 0.1;
        } else if (npc.prop === 'luggage') {
          // Coolie steadies trunk with one hand & claps/bobs with the other
          npc.leftArm.rotation.x = -2.5;
          npc.leftArm.rotation.z = 0.34;
          npc.rightArm.rotation.x = -0.75 + Math.sin(t * 3.8) * 0.22;
          npc.rightArm.rotation.z = 0;
        } else if (npc.prop === 'chai' || npc.prop === 'notebook' || npc.prop === 'pen') {
          npc.rightArm.rotation.x = -1.05 + Math.sin(t * 3.4) * 0.22;
          npc.rightArm.rotation.z = 0.08;
          npc.leftArm.rotation.x = -0.55 + Math.cos(t * 3.4) * 0.18;
          npc.leftArm.rotation.z = -0.05;
        } else {
          // Classic rhythmic clapping in front of chest
          const clap = Math.sin(t * 5.2);
          npc.leftArm.rotation.x = -1.1;
          npc.rightArm.rotation.x = -1.1;
          npc.leftArm.rotation.z = 0.22 + clap * 0.16;
          npc.rightArm.rotation.z = -0.22 - clap * 0.16;
        }
      }
    } else if (npc.mode === 'stroll') {
      if (cheering) {
        // Stop strolling, face front, jump & wave both arms!
        npc.group.rotation.y += (0 - npc.group.rotation.y) * Math.min(1, dt * 10);
        const hop = Math.abs(Math.sin(t * 11)) * 0.24 * cheerBoost;
        npc.group.position.y = npc.baseY + hop;
        npc.leftArm.rotation.x = -2.6 + Math.sin(t * 14) * 0.35;
        npc.rightArm.rotation.x = -2.6 - Math.sin(t * 14) * 0.35;
        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;
      } else {
        npc.group.position.y = npc.baseY;
        npc.group.position.x += npc.dir * npc.speed * dt;
        if (npc.group.position.x > npc.walkMaxX) {
          npc.group.position.x = npc.walkMaxX;
          npc.dir = -1;
        } else if (npc.group.position.x < npc.walkMinX) {
          npc.group.position.x = npc.walkMinX;
          npc.dir = 1;
        }
        const targetYaw = npc.dir === 1 ? Math.PI * 0.46 : -Math.PI * 0.46;
        npc.group.rotation.y += (targetYaw - npc.group.rotation.y) * Math.min(1, dt * 8);
        const stride = Math.sin(t * 5.2);
        npc.leftLeg.rotation.x = stride * 0.45;
        npc.rightLeg.rotation.x = -stride * 0.45;
        npc.leftArm.rotation.x = -stride * 0.35;
        npc.rightArm.rotation.x = stride * 0.35;
      }
    } else if (npc.mode === 'balcony' || npc.mode === 'seated') {
      const bounce = cheering
        ? Math.abs(Math.sin(t * 12)) * 0.22 * cheerBoost
        : Math.sin(t * 2.4) * 0.025;
      npc.group.position.y = npc.baseY + bounce;
      npc.head.rotation.y = Math.sin(t * 1.6) * 0.22;
      if (cheering) {
        npc.leftArm.rotation.x = -2.5 + Math.sin(t * 14) * 0.4;
        npc.rightArm.rotation.x = -2.5 - Math.sin(t * 14) * 0.4;
      } else {
        npc.leftArm.rotation.x = -0.35 + Math.sin(t * 2.1) * 0.12;
        npc.rightArm.rotation.x = -0.35 - Math.sin(t * 2.1) * 0.12;
      }
    } else if (npc.mode === 'vendor') {
      // Serving chai with pouring arm motion + cheers on heavy hit
      npc.group.position.y = npc.baseY + (cheering ? Math.abs(Math.sin(t * 10)) * 0.18 * cheerBoost : 0);
      npc.rightArm.rotation.x = cheering ? -2.4 : -1.0 + Math.sin(t * 4.2) * 0.45;
      npc.leftArm.rotation.x = cheering ? -2.4 : -0.7;
      npc.head.rotation.y = Math.sin(t * 1.4) * 0.28;
    } else if (npc.mode === 'operator') {
      // Studio camera operator leaning & panning with the broadcast rig
      npc.group.position.y = npc.baseY + (cheering ? Math.abs(Math.sin(t * 10)) * 0.12 * cheerBoost : 0);
      npc.leftArm.rotation.x = -1.15;
      npc.rightArm.rotation.x = -1.15;
      npc.head.rotation.y = Math.sin(t * 1.8) * 0.24;
    }
  }
}

export function createStrayCow(x: number, z: number, walkMinX: number, walkMaxX: number): AmbientCow {
  const group = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.8 });
  const spotMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.82 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.5 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.65 });

  // Ground shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 14),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Body + Iconic Indian Cow Hump + Brown Spots
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.68, 0.62), whiteMat);
  body.position.set(0, 0.88, 0);
  group.add(body);

  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), whiteMat);
  hump.position.set(0.32, 1.24, 0);
  hump.scale.set(1.1, 0.9, 0.85);
  group.add(hump);

  const spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.65), spotMat);
  spot1.position.set(-0.18, 0.94, 0);
  group.add(spot1);

  // Head + Snout + Horns + Ears
  const head = new THREE.Group();
  head.position.set(0.76, 1.08, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.34), whiteMat);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.3), snoutMat);
  snout.position.set(0.24, -0.06, 0);
  head.add(skull, snout);

  [-0.14, 0.14].forEach((hz) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 6), hornMat);
    horn.position.set(-0.04, 0.24, hz);
    horn.rotation.x = hz > 0 ? 0.35 : -0.35;
    head.add(horn);
  });
  group.add(head);

  // 4 Articulated Legs
  const legs: THREE.Object3D[] = [];
  const legGeoCow = new THREE.CylinderGeometry(0.065, 0.055, 0.62, 6);
  [
    [0.46, 0.22],
    [0.46, -0.22],
    [-0.48, 0.22],
    [-0.48, -0.22],
  ].forEach(([lx, lz]) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(lx, 0.58, lz);
    const m = new THREE.Mesh(legGeoCow, whiteMat);
    m.position.y = -0.28;
    legPivot.add(m);
    group.add(legPivot);
    legs.push(legPivot);
  });

  // Wagging Tail
  const tail = new THREE.Group();
  tail.position.set(-0.68, 1.05, 0);
  const tailRope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.5, 6), spotMat);
  tailRope.position.y = -0.24;
  tail.add(tailRope);
  group.add(tail);

  group.position.set(x, 0, z);

  return {
    group,
    legs,
    head,
    tail,
    walkMinX,
    walkMaxX,
    speed: 0.62,
    dir: 1,
    isSecondary: true,
  };
}

export function updateStrayCow(cow: AmbientCow, elapsed: number, dt: number): void {
  if (!cow.group.visible) return;
  cow.group.position.x += cow.dir * cow.speed * dt;
  if (cow.group.position.x > cow.walkMaxX) {
    cow.group.position.x = cow.walkMaxX;
    cow.dir = -1;
  } else if (cow.group.position.x < cow.walkMinX) {
    cow.group.position.x = cow.walkMinX;
    cow.dir = 1;
  }
  const targetYaw = cow.dir === 1 ? 0 : Math.PI;
  cow.group.rotation.y += (targetYaw - cow.group.rotation.y) * Math.min(1, dt * 4);

  const stride = Math.sin(elapsed * 3.1);
  cow.legs[0].rotation.z = stride * 0.28;
  cow.legs[1].rotation.z = -stride * 0.28;
  cow.legs[2].rotation.z = -stride * 0.28;
  cow.legs[3].rotation.z = stride * 0.28;
  cow.head.rotation.z = Math.sin(elapsed * 1.4) * 0.08 - 0.05;
  cow.tail.rotation.x = Math.sin(elapsed * 4.5) * 0.32;
}
