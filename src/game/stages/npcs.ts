import * as THREE from 'three';
import { getContactShadowTexture } from '../characters/rig';

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
  mode: 'stroll' | 'balcony' | 'seated' | 'vendor' | 'operator';
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

// Shared low-poly geometries for mobile 60 FPS performance
const torsoGeo = new THREE.CylinderGeometry(0.19, 0.22, 0.56, 8);
const headGeo = new THREE.SphereGeometry(0.18, 10, 8);
const armGeo = new THREE.CapsuleGeometry(0.055, 0.24, 4, 6);
const legGeo = new THREE.CapsuleGeometry(0.065, 0.26, 4, 6);
const shadowGeo = new THREE.CircleGeometry(0.36, 12);

export function createLowPolyNpc(opts: {
  shirtColor: number;
  pantColor: number;
  skinColor?: number;
  hairColor?: number;
  turbanColor?: number;
  hasCap?: boolean;
  mode: AmbientNpc['mode'];
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

  const shirtMat = new THREE.MeshStandardMaterial({ color: opts.shirtColor, roughness: 0.78 });
  const pantMat = new THREE.MeshStandardMaterial({ color: opts.pantColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: opts.skinColor ?? 0xc68652, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: opts.hairColor ?? 0x18181b, roughness: 0.65 });

  // Contact shadow (only on ground/platform NPCs)
  if (opts.mode !== 'balcony' && opts.mode !== 'seated') {
    const shadow = new THREE.Mesh(
      shadowGeo,
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
  }

  const body = new THREE.Group();
  body.position.y = opts.mode === 'seated' ? 0.52 : 0.76;
  group.add(body);

  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 0.24;
  body.add(torso);

  const head = new THREE.Group();
  head.position.y = 0.68;
  body.add(head);

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  head.add(headMesh);

  if (opts.turbanColor !== undefined) {
    const turban = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.065, 6, 12),
      new THREE.MeshStandardMaterial({ color: opts.turbanColor, roughness: 0.7 }),
    );
    turban.rotation.x = Math.PI / 2;
    turban.position.y = 0.09;
    head.add(turban);
  } else if (opts.hasCap) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }),
    );
    cap.position.y = 0.03;
    head.add(cap);
  } else {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.188, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
      hairMat,
    );
    hair.position.y = 0.02;
    head.add(hair);
  }

  // Eyes (two tiny crisp dots facing +Z)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const eyeGeo = new THREE.SphereGeometry(0.022, 6, 6);
  [-0.06, 0.06].forEach((ex) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
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

  group.position.set(opts.x, baseY, opts.z);

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
    mode: opts.mode,
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
  const cheering = excitement > 0.15;
  for (const npc of npcs) {
    if (!npc.group.visible) continue;
    const t = elapsed + npc.phase;

    if (npc.mode === 'stroll') {
      if (cheering) {
        // Stop strolling, face front, jump & wave both arms!
        npc.group.rotation.y += (0 - npc.group.rotation.y) * Math.min(1, dt * 10);
        const hop = Math.abs(Math.sin(t * 11)) * 0.24 * Math.min(1, excitement);
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
        ? Math.abs(Math.sin(t * 12)) * 0.22 * Math.min(1, excitement)
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
      npc.group.position.y = npc.baseY + (cheering ? Math.abs(Math.sin(t * 10)) * 0.18 : 0);
      npc.rightArm.rotation.x = cheering ? -2.4 : -1.0 + Math.sin(t * 4.2) * 0.45;
      npc.leftArm.rotation.x = cheering ? -2.4 : -0.7;
      npc.head.rotation.y = Math.sin(t * 1.4) * 0.28;
    } else if (npc.mode === 'operator') {
      // Studio camera operator leaning & panning with the broadcast rig
      npc.group.position.y = npc.baseY + (cheering ? Math.abs(Math.sin(t * 10)) * 0.12 : 0);
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
