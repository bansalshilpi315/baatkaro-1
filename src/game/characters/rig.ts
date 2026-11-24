import * as THREE from 'three';
import type { FighterId, FighterState } from '../types';
import type { DynamicFace } from './faceCanvas';

export interface FighterRig {
  id: FighterId;
  root: THREE.Group;
  bodyGroup: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  contactShadow: THREE.Mesh;
  handProp: THREE.Object3D | null;
  tailPivot: THREE.Group | null;
  shadesPivot: THREE.Group | null;
  maneGroup: THREE.Group | null;
  shadesLensMat: THREE.MeshStandardMaterial | null;
  billaEyesGroup: THREE.Group | null;
  billaPupils: THREE.Object3D[];
  jholaPivot: THREE.Group | null;
  jholaPapersGroup: THREE.Group | null;
  dharnaRing: THREE.Object3D | null;
  hatPivot: THREE.Group | null;
  shieldAura: THREE.Mesh;
  superAura: THREE.Mesh;
  face: DynamicFace;
  flashMaterials: THREE.MeshStandardMaterial[];
  isEggBody: boolean;
  dispose: () => void;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;

export function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedShadowTex) return sharedShadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  sharedShadowTex = new THREE.CanvasTexture(c);
  return sharedShadowTex;
}

export function createBaseRigSkeleton(
  id: FighterId,
  face: DynamicFace,
  isEggBody = false,
): FighterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const pelvis = new THREE.Group();
  pelvis.position.set(0, isEggBody ? 0.68 : 0.92, 0);
  bodyGroup.add(pelvis);

  const torso = new THREE.Group();
  torso.position.set(0, isEggBody ? 0.04 : 0.14, 0);
  pelvis.add(torso);

  const head = new THREE.Group();
  head.position.set(0, isEggBody ? 0.62 : 0.86, 0);
  torso.add(head);

  const shoulderY = isEggBody ? 0.46 : 0.66;
  const shoulderX = isEggBody ? 0.53 : 0.43;

  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-shoulderX, shoulderY, 0);
  torso.add(leftShoulder);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, isEggBody ? -0.27 : -0.34, 0);
  leftShoulder.add(leftElbow);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(shoulderX, shoulderY, 0);
  torso.add(rightShoulder);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, isEggBody ? -0.27 : -0.34, 0);
  rightShoulder.add(rightElbow);

  const hipX = isEggBody ? 0.2 : 0.19;
  const leftHip = new THREE.Group();
  leftHip.position.set(-hipX, isEggBody ? 0.04 : 0, 0);
  pelvis.add(leftHip);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, isEggBody ? -0.32 : -0.44, 0);
  leftHip.add(leftKnee);

  const rightHip = new THREE.Group();
  rightHip.position.set(hipX, isEggBody ? 0.04 : 0, 0);
  pelvis.add(rightHip);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, isEggBody ? -0.32 : -0.44, 0);
  rightHip.add(rightKnee);

  // Soft radial contact shadow on floor
  const shadowGeo = new THREE.CircleGeometry(0.75, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.018;
  root.add(contactShadow);

  // Dharna shield translucent saffron dome
  const shieldGeo = new THREE.SphereGeometry(1.12, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.65);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xfb923c,
    emissiveIntensity: 0.75,
    transparent: true,
    opacity: 0.36,
    roughness: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shieldAura = new THREE.Mesh(shieldGeo, shieldMat);
  shieldAura.position.y = 0.1;
  shieldAura.visible = false;
  bodyGroup.add(shieldAura);

  // Super strike golden aura ring
  const superGeo = new THREE.TorusGeometry(0.95, 0.09, 10, 28);
  const superMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xfacc15,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.85,
  });
  const superAura = new THREE.Mesh(superGeo, superMat);
  superAura.rotation.x = Math.PI / 2;
  superAura.position.y = 0.9;
  superAura.visible = false;
  bodyGroup.add(superAura);

  const rig: FighterRig = {
    id,
    root,
    bodyGroup,
    pelvis,
    torso,
    head,
    leftShoulder,
    leftElbow,
    rightShoulder,
    rightElbow,
    leftHip,
    leftKnee,
    rightHip,
    rightKnee,
    contactShadow,
    handProp: null,
    tailPivot: null,
    shadesPivot: null,
    maneGroup: null,
    shadesLensMat: null,
    billaEyesGroup: null,
    billaPupils: [],
    jholaPivot: null,
    jholaPapersGroup: null,
    dharnaRing: null,
    hatPivot: null,
    shieldAura,
    superAura,
    face,
    flashMaterials: [],
    isEggBody,
    dispose() {
      face.dispose();
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
    },
  };

  return rig;
}

function lerpAngle(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

export function animateFighterRig(
  rig: FighterRig,
  state: FighterState,
  elapsed: number,
  dt: number,
  hideHandProp = false,
): void {
  const alpha = 1 - Math.exp(-18 * Math.max(dt, 0.008));

  // Position fighter on 2.5D plane (Z = 0)
  rig.root.position.set(state.x, 0, 0);
  rig.bodyGroup.position.y = state.y;

  // Facing rotation: slight 3/4 arcade angle toward camera so cartoon face & silhouette pop!
  const targetYaw = state.facing === 1 ? Math.PI * 0.42 : -Math.PI * 0.42;
  rig.bodyGroup.rotation.y = lerpAngle(rig.bodyGroup.rotation.y, targetYaw, alpha);

  // Squash & stretch
  rig.bodyGroup.scale.set(state.squashX, state.squashY, state.squashX);

  // Contact shadow shrinks & softens as fighter jumps higher
  const shadowScale = Math.max(0.45, 1 - state.y * 0.14);
  rig.contactShadow.scale.set(shadowScale, shadowScale, 1);
  (rig.contactShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
    0.18,
    0.72 - state.y * 0.12,
  );

  // Dynamic Face & Anda Bhai cracks (<70%, <40%, <20% HP)
  let crackLevel = 0;
  if (state.id === 'anda') {
    const hpRatio = state.hp / state.maxHp;
    if (hpRatio < 0.2) crackLevel = 3;
    else if (hpRatio < 0.4) crackLevel = 2;
    else if (hpRatio < 0.7) crackLevel = 1;
  }
  rig.face.update(state.expression, crackLevel);

  // Hit flash emissive highlight
  const flashVal = state.hitFlashTimer > 0 ? 0.65 : 0;
  for (const mat of rig.flashMaterials) {
    mat.emissiveIntensity = flashVal;
  }

  // Dharna Shield & Super aura visibility
  rig.shieldAura.visible = state.dharnaShieldTimer > 0;
  if (rig.shieldAura.visible) {
    const s = 1 + Math.sin(elapsed * 14) * 0.04;
    rig.shieldAura.scale.set(s, s, s);
    if (rig.dharnaRing) {
      rig.dharnaRing.rotation.y = elapsed * 1.65;
    }
  }
  rig.superAura.visible = state.action === 'super' || state.shakti >= 100;
  if (rig.superAura.visible) {
    rig.superAura.rotation.z = elapsed * 5;
    const sc = state.action === 'super' ? 1.35 : 0.88 + Math.sin(elapsed * 6) * 0.06;
    rig.superAura.scale.set(sc, sc, sc);
    rig.superAura.position.y = state.action === 'super' ? 1.05 : 0.16;
  }

  if (rig.handProp) {
    if (state.id === 'billa') {
      rig.handProp.visible = state.action === 'special';
    } else if (state.id === 'mausi') {
      rig.handProp.visible = !hideHandProp;
    } else if (state.id === 'sheru') {
      rig.handProp.visible = state.action === 'special' || state.action === 'victory';
    }
  }

  // Target joint angles
  const basePelvisY =
    state.id === 'billa' ? 0.68 : state.id === 'mausi' ? 0.88 : rig.isEggBody ? 0.68 : 0.92;
  let pelvisY = basePelvisY;
  let pelvisRotX = 0;
  let pelvisRotZ = 0;
  let torsoRotX = 0;
  let torsoRotY = 0;
  let headRotX = 0;
  let lShX = -0.35;
  let lShZ = -0.22;
  let lElbX = -0.95;
  let rShX = -0.5;
  let rShZ = 0.22;
  let rElbX = -1.1;
  let lHipX = 0.12;
  let lKneeX = 0.15;
  let rHipX = -0.14;
  let rKneeX = 0.18;

  const breathe = Math.sin(elapsed * 4.5 + state.slot * 2.1);
  const atkProgress =
    state.actionDuration > 0 ? Math.min(1, state.actionTimer / state.actionDuration) : 0;

  switch (state.action) {
    case 'idle': {
      pelvisY = basePelvisY + breathe * 0.035;
      torsoRotX = 0.06 + breathe * 0.03;
      torsoRotY = Math.sin(elapsed * 2.2 + state.slot) * 0.08;
      lShX = -0.55 + breathe * 0.08;
      rShX = -0.75 - breathe * 0.08;
      lElbX = -1.25;
      rElbX = -1.35;
      break;
    }
    case 'walk': {
      const cyc = state.walkCycle;
      const stride = Math.sin(cyc);
      pelvisY = basePelvisY + Math.abs(Math.cos(cyc)) * 0.06;
      torsoRotX = 0.14;
      torsoRotY = stride * 0.15;
      lHipX = stride * 0.62;
      rHipX = -stride * 0.62;
      lKneeX = Math.max(0, -stride) * 0.7;
      rKneeX = Math.max(0, stride) * 0.7;
      lShX = -0.5 - stride * 0.45;
      rShX = -0.5 + stride * 0.45;
      lElbX = -1.15;
      rElbX = -1.15;
      break;
    }
    case 'jump': {
      torsoRotX = 0.15;
      lShX = -1.9;
      rShX = -1.7;
      lElbX = -0.6;
      rElbX = -0.6;
      lHipX = -0.65;
      lKneeX = 1.05;
      rHipX = -0.25;
      rKneeX = 0.7;
      break;
    }
    case 'crouch': {
      pelvisY = basePelvisY - 0.34;
      torsoRotX = 0.32;
      lHipX = -0.95;
      lKneeX = 1.45;
      rHipX = -0.85;
      rKneeX = 1.35;
      lShX = -0.85;
      rShX = -0.95;
      lElbX = -1.5;
      rElbX = -1.5;
      break;
    }
    case 'block': {
      pelvisY = basePelvisY - 0.1;
      torsoRotX = -0.08;
      lShX = -1.35;
      lShZ = 0.45;
      lElbX = -1.55;
      rShX = -1.42;
      rShZ = -0.45;
      rElbX = -1.6;
      lHipX = -0.22;
      rHipX = 0.25;
      break;
    }
    case 'punch': {
      // Snappy jab forward
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotY = -0.42 * snap;
      torsoRotX = 0.14 * snap;
      rShX = -1.55 * snap - 0.3;
      rElbX = -0.1 * snap - 0.3 * (1 - snap);
      lShX = -0.65;
      lElbX = -1.45;
      break;
    }
    case 'kick': {
      // High arcade kick
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = -0.28 * snap;
      torsoRotY = 0.35 * snap;
      rHipX = -1.55 * snap;
      rKneeX = 0.12 * snap;
      lHipX = 0.18 * snap;
      lShX = -0.9;
      rShX = 0.45 * snap;
      break;
    }
    case 'grab': {
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = 0.28 * snap;
      lShX = -1.48 * snap - 0.3;
      rShX = -1.48 * snap - 0.3;
      lShZ = 0.25;
      rShZ = -0.25;
      lElbX = -0.35;
      rElbX = -0.35;
      break;
    }
    case 'special': {
      const snap = Math.sin(atkProgress * Math.PI);
      if (state.id === 'neta') {
        // Sits cross-legged in protest!
        pelvisY = basePelvisY - 0.44;
        torsoRotX = 0.08;
        lHipX = -1.25;
        lKneeX = 1.6;
        rHipX = -1.25;
        rKneeX = 1.6;
        lShX = -0.95;
        lShZ = 0.48;
        rShX = -0.95;
        rShZ = -0.48;
        lElbX = -1.3;
        rElbX = -1.3;
      } else if (state.id === 'billa') {
        // Giant overhead flyswatter smash arc
        const swing = atkProgress < 0.35 ? -2.7 : -0.35;
        torsoRotX = atkProgress < 0.35 ? -0.25 : 0.38;
        torsoRotY = atkProgress < 0.35 ? 0.35 : -0.45;
        rShX = swing;
        rElbX = -0.15;
        lShX = -0.8;
      } else if (state.id === 'anda') {
        // Cannonball Deewar Drop slam
        torsoRotX = 0.55 * snap;
        lShX = -2.2 * snap;
        rShX = -2.2 * snap;
        lHipX = -0.8 * snap;
        rHipX = -0.8 * snap;
        lKneeX = 1.1;
        rKneeX = 1.1;
      } else {
        // Throwing stance (Paisa Flex / Belan Throw)
        torsoRotY = -0.55 * snap;
        torsoRotX = 0.16;
        rShX = -1.75 * snap - 0.2;
        rElbX = -0.2;
        lShX = -0.4;
      }
      break;
    }
    case 'super': {
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = 0.35;
      torsoRotY = -0.55 * snap;
      rShX = -1.65;
      rElbX = -0.1;
      lShX = 0.45;
      lHipX = -0.4;
      rHipX = 0.45;
      break;
    }
    case 'hit': {
      torsoRotX = -0.42;
      headRotX = -0.25;
      lShX = -1.2;
      lShZ = -0.65;
      rShX = -1.2;
      rShZ = 0.65;
      lElbX = -0.5;
      rElbX = -0.5;
      break;
    }
    case 'ko': {
      // Dramatic topple backward onto arena floor
      pelvisY = 0.32;
      pelvisRotX = -Math.PI * 0.46;
      pelvisRotZ = 0.12;
      lShX = -1.8;
      lShZ = -0.7;
      rShX = -1.5;
      rShZ = 0.7;
      lHipX = 0.2;
      rHipX = -0.15;
      break;
    }
    case 'victory': {
      const pump = Math.sin(elapsed * 7.5);
      pelvisY = basePelvisY + Math.abs(pump) * 0.14;
      torsoRotX = -0.1;
      lShX = -2.55 + pump * 0.28;
      rShX = -2.55 - pump * 0.28;
      lShZ = -0.32;
      rShZ = 0.32;
      lElbX = -0.35;
      rElbX = -0.35;
      break;
    }
  }

  // Sheru Bhai (White Lion Boss) custom swagger animations, Paisa Flex flick & shades/tail dynamics
  const isSheru = state.id === 'sheru';
  let headRotZ = 0;
  let jointAlpha = alpha;

  if (isSheru) {
    if (state.action === 'idle') {
      // Confident billionaire boss stance: chest puffed out, proud head bob, broad shoulders
      pelvisY = basePelvisY + breathe * 0.04;
      torsoRotX = -0.11 + breathe * 0.025;
      torsoRotY = Math.sin(elapsed * 2.0 + state.slot) * 0.09;
      headRotX = 0.06 + breathe * 0.045;
      lShX = -0.32 + breathe * 0.06;
      lShZ = -0.34;
      lElbX = -0.95;
      rShX = -0.58 - breathe * 0.07;
      rShZ = 0.32;
      rElbX = -1.18;
      lHipX = 0.14;
      rHipX = -0.18;
    } else if (state.action === 'walk') {
      // Swaggering billionaire walk cycle with shoulder roll & puffed chest
      const cyc = state.walkCycle;
      const stride = Math.sin(cyc);
      pelvisY = basePelvisY + Math.abs(Math.cos(cyc)) * 0.07;
      pelvisRotZ = stride * 0.065;
      torsoRotX = -0.05;
      torsoRotY = stride * 0.22;
      headRotX = 0.05 + Math.abs(stride) * 0.04;
      lHipX = stride * 0.56;
      rHipX = -stride * 0.56;
      lKneeX = Math.max(0, -stride) * 0.62;
      rKneeX = Math.max(0, stride) * 0.62;
      lShX = -0.28 - stride * 0.42;
      rShX = -0.35 + stride * 0.42;
      lShZ = -0.32;
      rShZ = 0.32;
      lElbX = -0.85;
      rElbX = -0.95;
    } else if (state.action === 'punch') {
      // Heavy sweeping lion paw hook
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotY = -0.58 * snap;
      torsoRotX = 0.1 * snap;
      rShX = -1.48 * snap - 0.25;
      rShZ = 0.55 * (1 - snap) + 0.15;
      rElbX = -0.45 * snap - 0.55 * (1 - snap);
      lShX = -0.55;
      lShZ = -0.34;
      lElbX = -1.35;
    } else if (state.action === 'kick') {
      // Stylish tailored suit high-kick with swagger counter-balance
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = -0.34 * snap;
      torsoRotY = 0.42 * snap;
      rHipX = -1.62 * snap;
      rKneeX = 0.1 * snap;
      lHipX = 0.2 * snap;
      lShX = -0.75;
      lShZ = -0.48 * snap - 0.25;
      rShX = 0.55 * snap;
      rShZ = 0.42 * snap + 0.2;
    } else if (state.action === 'grab') {
      // Dramatic twin-paw billionaire collar grab
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = 0.24 * snap;
      lShX = -1.52 * snap - 0.25;
      rShX = -1.52 * snap - 0.25;
      lShZ = 0.36 * snap;
      rShZ = -0.36 * snap;
      lElbX = -0.42;
      rElbX = -0.42;
    } else if (state.action === 'special') {
      // Paisa Flex: cool lean-back windup, then slick ringed-paw flick forward
      const flick = atkProgress < 0.26 ? 0 : Math.min(1, (atkProgress - 0.26) / 0.32);
      const settle = atkProgress > 0.68 ? (atkProgress - 0.68) / 0.32 : 0;
      const snap = flick * (1 - settle * 0.45);
      torsoRotX = -0.24 * (1 - snap) - 0.08 * snap;
      torsoRotY = 0.35 * (1 - snap) - 0.52 * snap;
      headRotX = -0.1 * (1 - snap) + 0.06 * snap;
      rShX = -0.95 * (1 - snap) - 1.72 * snap;
      rShZ = 0.48 * (1 - snap) + 0.12 * snap;
      rElbX = -1.35 * (1 - snap) - 0.12 * snap;
      lShX = -0.22;
      lShZ = -0.42;
      lElbX = -1.05;
    } else if (state.action === 'hit') {
      headRotX = -0.32;
      headRotZ = 0.18;
    } else if (state.action === 'ko') {
      // Dramatic slow billionaire tumble onto the floor
      jointAlpha = 1 - Math.exp(-5.5 * Math.max(dt, 0.008));
      pelvisY = 0.36;
      pelvisRotX = -Math.PI * 0.48;
      pelvisRotZ = 0.18;
      headRotZ = 0.26;
      lShX = -1.95;
      lShZ = -0.78;
      rShX = -1.6;
      rShZ = 0.78;
    } else if (state.action === 'victory') {
      // Boss victory pose: right paw flexing cash, left hand on hip
      const pump = Math.sin(elapsed * 5.2);
      pelvisY = basePelvisY + Math.abs(pump) * 0.06;
      torsoRotX = -0.14;
      headRotX = 0.08;
      rShX = -2.25 + pump * 0.18;
      rShZ = 0.34;
      rElbX = -0.35;
      lShX = -0.15;
      lShZ = -0.52;
      lElbX = -1.35;
    }

    // Lion Tail smooth sway
    if (rig.tailPivot) {
      const tailSpeed = state.action === 'walk' ? 9.0 : state.action === 'victory' ? 8.5 : 3.6;
      const tailAmp = state.action === 'ko' ? 0.08 : state.action === 'walk' ? 0.38 : 0.22;
      rig.tailPivot.rotation.y = Math.sin(elapsed * tailSpeed + state.slot) * tailAmp;
      rig.tailPivot.rotation.x =
        state.action === 'ko' ? -0.45 : -0.25 + Math.cos(elapsed * tailSpeed * 0.5) * 0.1;
    }

    // Mane subtle bounce
    if (rig.maneGroup) {
      const maneScale = 1 + Math.sin(elapsed * 4.5 + state.slot) * 0.015;
      rig.maneGroup.scale.set(maneScale, 1, maneScale);
    }

    // Aviator Sunglasses tilt & flash on heavy hits / KO
    if (rig.shadesPivot) {
      const targetTiltZ =
        state.action === 'ko'
          ? 0.34
          : state.action === 'hit'
            ? 0.22 * Math.sin(elapsed * 28)
            : 0;
      const targetDropY = state.action === 'ko' ? -0.04 : state.action === 'hit' ? -0.015 : 0;
      rig.shadesPivot.rotation.z = lerpAngle(rig.shadesPivot.rotation.z, targetTiltZ, alpha);
      rig.shadesPivot.position.y = lerpAngle(rig.shadesPivot.position.y, targetDropY, alpha);
    }
    if (rig.shadesLensMat) {
      const glint =
        state.hitFlashTimer > 0
          ? 1.15
          : state.action === 'special' || state.action === 'victory'
            ? 0.28 + Math.max(0, Math.sin(elapsed * 10)) * 0.35
            : 0.04;
      rig.shadesLensMat.emissiveIntensity = glint;
    }
  } else if (state.id === 'billa') {
    // Blue Billa (Oggy-parody cartoon cat): bouncy rubbery idle, slap-flurry punches, springy kicks, giant Swatter Smash & startled eye-pop!
    const boing = Math.sin(elapsed * 6.4 + state.slot * 1.7);
    const boing2 = Math.cos(elapsed * 3.2 + state.slot);

    if (state.action === 'idle') {
      // Bouncy, rubbery goofy cartoon stance
      pelvisY = basePelvisY + Math.abs(boing) * 0.075;
      pelvisRotZ = boing2 * 0.055;
      torsoRotX = 0.09 + boing * 0.05;
      torsoRotY = boing2 * 0.14;
      headRotX = -0.05 - boing * 0.06;
      headRotZ = boing2 * 0.08;
      lShX = -0.58 + boing * 0.18;
      lShZ = -0.46 + boing2 * 0.1;
      lElbX = -1.05 + boing * 0.22;
      rShX = -0.72 - boing * 0.18;
      rShZ = 0.46 + boing2 * 0.1;
      rElbX = -1.15 - boing * 0.22;
      lHipX = 0.14 - Math.abs(boing) * 0.08;
      lKneeX = 0.18 + Math.abs(boing) * 0.16;
      rHipX = -0.16 - Math.abs(boing) * 0.08;
      rKneeX = 0.2 + Math.abs(boing) * 0.16;
    } else if (state.action === 'walk') {
      // Springy lanky cartoon stride with floppy noodle arms
      const cyc = state.walkCycle * 1.15;
      const stride = Math.sin(cyc);
      pelvisY = basePelvisY + Math.abs(Math.cos(cyc)) * 0.095;
      pelvisRotZ = stride * 0.08;
      torsoRotX = 0.18;
      torsoRotY = stride * 0.24;
      headRotZ = -stride * 0.09;
      lHipX = stride * 0.72;
      rHipX = -stride * 0.72;
      lKneeX = Math.max(0, -stride) * 0.85;
      rKneeX = Math.max(0, stride) * 0.85;
      lShX = -0.45 - stride * 0.68;
      rShX = -0.45 + stride * 0.68;
      lShZ = -0.36;
      rShZ = 0.36;
      lElbX = -0.95;
      rElbX = -0.95;
    } else if (state.action === 'punch') {
      // Wild slap-flurry punches with rubbery alternating cartoon arms!
      const flurry = Math.sin(atkProgress * Math.PI * 3.0);
      const env = Math.sin(atkProgress * Math.PI);
      torsoRotX = 0.18 * env;
      torsoRotY = -0.48 * flurry * env;
      headRotZ = 0.12 * flurry;
      rShX = -1.55 * env - 0.35 + flurry * 0.55;
      rShZ = 0.42 + flurry * 0.35;
      rElbX = -0.25 + Math.abs(flurry) * 0.2;
      lShX = -1.35 * env - 0.35 - flurry * 0.55;
      lShZ = -0.42 + flurry * 0.35;
      lElbX = -0.35 + Math.abs(flurry) * 0.2;
    } else if (state.action === 'kick') {
      // Springy cartoon high kick with flailing noodle counter-balance
      const snap = Math.sin(atkProgress * Math.PI);
      pelvisY = basePelvisY + snap * 0.1;
      torsoRotX = -0.38 * snap;
      torsoRotY = 0.45 * snap;
      headRotX = 0.18 * snap;
      rHipX = -1.72 * snap;
      rKneeX = 0.08 * snap;
      lHipX = 0.22 * snap;
      lShX = -1.45 * snap - 0.4;
      lShZ = -0.68 * snap;
      rShX = 0.65 * snap;
      rShZ = 0.62 * snap;
    } else if (state.action === 'special') {
      // Swatter Smash: huge cartoon windup whipping giant neon-green flyswatter forward in a wide slap arc!
      const isWindup = atkProgress < 0.28;
      const slamT = isWindup ? 0 : Math.min(1, (atkProgress - 0.28) / 0.36);
      const followT = atkProgress > 0.68 ? (atkProgress - 0.68) / 0.32 : 0;
      const arc = slamT * (1 - followT * 0.32);

      pelvisY = basePelvisY + (isWindup ? 0.1 : -0.06 * arc);
      torsoRotX = isWindup ? -0.32 : 0.48 * arc;
      torsoRotY = isWindup ? 0.54 : -0.68 * arc;
      headRotX = isWindup ? -0.18 : 0.16 * arc;
      rShX = isWindup ? -2.95 : -2.95 + arc * 2.75;
      rShZ = isWindup ? 0.45 : 0.18 - arc * 0.35;
      rElbX = isWindup ? -0.45 : -0.08;
      lShX = -0.95;
      lShZ = -0.58;
      lElbX = -0.7;
    } else if (state.action === 'hit') {
      // Funny startled cartoon shock: arms flung up, rubbery recoil!
      pelvisY = basePelvisY + 0.08;
      torsoRotX = -0.46;
      headRotX = -0.34;
      headRotZ = 0.22 * Math.sin(elapsed * 32);
      lShX = -2.25;
      lShZ = -0.72;
      rShX = -2.25;
      rShZ = 0.72;
      lElbX = -0.25;
      rElbX = -0.25;
    } else if (state.action === 'ko') {
      // Comical flat splat onto arena floor
      pelvisY = 0.28;
      pelvisRotX = -Math.PI * 0.47;
      pelvisRotZ = -0.15;
      headRotZ = -0.28;
      lShX = -2.1;
      lShZ = -0.95;
      rShX = -1.75;
      rShZ = 0.95;
      lHipX = 0.26;
      rHipX = -0.24;
    } else if (state.action === 'victory') {
      // Goofy boingy cartoon dance victory!
      const hop = Math.sin(elapsed * 8.5);
      pelvisY = basePelvisY + Math.abs(hop) * 0.2;
      torsoRotY = Math.sin(elapsed * 4.25) * 0.26;
      headRotZ = Math.sin(elapsed * 8.5) * 0.14;
      lShX = -2.45 + hop * 0.42;
      rShX = -2.45 - hop * 0.42;
      lShZ = -0.48;
      rShZ = 0.48;
      lElbX = -0.45;
      rElbX = -0.45;
    }

    // Energetic curved sky-blue cat tail wag!
    if (rig.tailPivot) {
      const tailSpeed =
        state.action === 'victory' || state.action === 'special'
          ? 12.5
          : state.action === 'walk' || state.action === 'punch'
            ? 10.0
            : 5.8;
      const tailAmp = state.action === 'ko' ? 0.05 : state.action === 'hit' ? 0.65 : 0.46;
      rig.tailPivot.rotation.y = Math.sin(elapsed * tailSpeed + state.slot) * tailAmp;
      rig.tailPivot.rotation.z = Math.cos(elapsed * tailSpeed * 0.5) * (state.action === 'ko' ? 0.05 : 0.18);
      rig.tailPivot.rotation.x = state.action === 'ko' ? -0.55 : -0.12 + Math.sin(elapsed * tailSpeed * 0.5) * 0.12;
    }

    // Comedic 3D Vertical Eye Bulge & Pinpoint/Dizzy Pupils on Hit & KO!
    if (rig.billaEyesGroup) {
      const targetEx = state.action === 'hit' ? 1.24 : state.action === 'ko' ? 1.12 : 1.0;
      const targetEy = state.action === 'hit' ? 1.28 : state.action === 'ko' ? 0.92 : 1.0;
      const targetEz = state.action === 'hit' ? 1.45 : 1.0;
      rig.billaEyesGroup.scale.x = lerpAngle(rig.billaEyesGroup.scale.x, targetEx, alpha);
      rig.billaEyesGroup.scale.y = lerpAngle(rig.billaEyesGroup.scale.y, targetEy, alpha);
      rig.billaEyesGroup.scale.z = lerpAngle(rig.billaEyesGroup.scale.z, targetEz, alpha);
    }
    if (rig.billaPupils.length === 2) {
      const [leftPupil, rightPupil] = rig.billaPupils;
      const isAttacking =
        state.action === 'punch' ||
        state.action === 'kick' ||
        state.action === 'special' ||
        state.action === 'super';
      const pScale = state.action === 'hit' ? 0.52 : isAttacking ? 1.12 : 1.0;
      leftPupil.scale.set(pScale, pScale, 1);
      rightPupil.scale.set(pScale, pScale, 1);
      if (state.action === 'ko') {
        // Cross-eyed wobbling dizzy pupils!
        leftPupil.position.y = Math.sin(elapsed * 14) * 0.04;
        rightPupil.position.y = -Math.sin(elapsed * 14) * 0.04;
      } else {
        leftPupil.position.y = 0;
        rightPupil.position.y = 0;
      }
    }
  } else if (state.id === 'neta') {
    // Garib Sena Neta (Jhola-Chaap Aam Aadmi): humble slightly hunched stance, occasional jhola-strap grip, brisk walk, scrappy slap/kick & cross-legged Dharna sit!
    const sway = Math.sin(elapsed * 3.8 + state.slot);
    // Smooth periodic gesture where his right hand reaches up to grip his diagonal jhola strap!
    const strapGripCycle = Math.max(0, Math.sin(elapsed * 0.95 + 0.4));
    const strapGrip = strapGripCycle > 0.35 ? Math.min(1, (strapGripCycle - 0.35) / 0.35) : 0;

    if (state.action === 'idle') {
      pelvisY = basePelvisY - 0.03 + breathe * 0.028;
      torsoRotX = 0.14 + breathe * 0.025; // Humble, slightly hunched grassroots posture
      torsoRotY = sway * 0.09;
      headRotX = -0.07 + breathe * 0.02;
      headRotZ = sway * 0.035;
      // Left hand relaxed near jhola bag
      lShX = -0.42 + breathe * 0.06;
      lShZ = -0.22;
      lElbX = -1.15;
      // Right hand smoothly alternates between humble guard and gripping the diagonal jhola strap on right chest!
      rShX = -0.68 * (1 - strapGrip) - 0.95 * strapGrip - breathe * 0.05;
      rShZ = 0.24 * (1 - strapGrip) - 0.32 * strapGrip;
      rElbX = -1.25 * (1 - strapGrip) - 1.85 * strapGrip;
      lHipX = 0.14;
      lKneeX = 0.16;
      rHipX = -0.16;
      rKneeX = 0.18;
    } else if (state.action === 'walk') {
      // Brisk grassroots rally march
      const cyc = state.walkCycle * 1.18;
      const stride = Math.sin(cyc);
      pelvisY = basePelvisY - 0.02 + Math.abs(Math.cos(cyc)) * 0.065;
      torsoRotX = 0.2;
      torsoRotY = stride * 0.18;
      headRotX = -0.08;
      lHipX = stride * 0.66;
      rHipX = -stride * 0.66;
      lKneeX = Math.max(0, -stride) * 0.74;
      rKneeX = Math.max(0, stride) * 0.74;
      lShX = -0.45 - stride * 0.52;
      rShX = -0.52 + stride * 0.56;
      lElbX = -1.1;
      rElbX = -1.18;
    } else if (state.action === 'punch') {
      // Quick palm-slap / pamphlet-swat forward jab!
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = 0.18 * snap + 0.08;
      torsoRotY = -0.5 * snap;
      rShX = -1.58 * snap - 0.32;
      rShZ = 0.34 * snap;
      rElbX = -0.15 * snap - 0.65 * (1 - snap);
      lShX = -0.58;
      lElbX = -1.45;
    } else if (state.action === 'kick') {
      // Scrappy chappal snap-kick!
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = -0.24 * snap;
      torsoRotY = 0.36 * snap;
      rHipX = -1.52 * snap;
      rKneeX = 0.14 * snap;
      lHipX = 0.2 * snap;
      lShX = -0.95;
      lShZ = -0.38 * snap;
      rShX = 0.42 * snap;
      rShZ = 0.35 * snap;
    } else if (state.action === 'grab') {
      // Determined two-hand activist grab
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = 0.3 * snap;
      lShX = -1.52 * snap - 0.28;
      rShX = -1.52 * snap - 0.28;
      lShZ = 0.28 * snap;
      rShZ = -0.28 * snap;
      lElbX = -0.35;
      rElbX = -0.35;
    } else if (state.action === 'special') {
      // Dharna Shield: grounded cross-legged protest sit on arena floor with hands raised in firm namaste/protest!
      pelvisY = 0.44;
      torsoRotX = 0.06;
      headRotX = -0.04;
      lHipX = -1.28;
      lKneeX = 1.68;
      rHipX = -1.28;
      rKneeX = 1.68;
      lShX = -0.92;
      lShZ = 0.52;
      rShX = -0.92;
      rShZ = -0.52;
      lElbX = -1.45;
      rElbX = -1.45;
    } else if (state.action === 'victory') {
      // Grassroots rally wave / namaste victory!
      const wave = Math.sin(elapsed * 6.5);
      pelvisY = basePelvisY + Math.abs(wave) * 0.08;
      torsoRotX = 0.05;
      rShX = -2.35 + wave * 0.22;
      rShZ = 0.26;
      rElbX = -0.35;
      lShX = -0.55;
      lShZ = -0.25;
      lElbX = -1.25;
    }

    // Stuffed Jhola Bag sway & bobbing colorful pamphlets/notebooks!
    const motionEnergy =
      state.action === 'walk' || state.action === 'punch' || state.action === 'kick'
        ? 1.0
        : state.action === 'ko'
          ? 0.0
          : 0.35;
    if (rig.jholaPivot) {
      rig.jholaPivot.rotation.z = Math.sin(elapsed * 6.2 + state.slot) * (0.04 + 0.08 * motionEnergy);
      rig.jholaPivot.rotation.x =
        state.action === 'special'
          ? -0.22
          : Math.cos(elapsed * 5.2) * (0.03 + 0.07 * motionEnergy);
    }
    if (rig.jholaPapersGroup) {
      const bob = Math.abs(Math.sin(elapsed * 7.8 + state.slot));
      rig.jholaPapersGroup.position.y = bob * (0.014 + 0.024 * motionEnergy);
      rig.jholaPapersGroup.rotation.z = Math.sin(elapsed * 6.5) * (0.03 + 0.04 * motionEnergy);
    }
  } else if (state.id === 'anda') {
    // Anda Bhai (Dapper Humpty Dumpty): wobbly top-heavy egg bounce, funny waddle,
    // quick striped-arm slaps, high teal-boot kicks, clumsy belly-bump grab & cannonball Deewar Drop!
    const wobble = Math.sin(elapsed * 3.8 + state.slot * 1.9);
    const bounce = Math.abs(Math.sin(elapsed * 4.4 + state.slot));

    if (state.action === 'idle') {
      pelvisY = basePelvisY + bounce * 0.055;
      pelvisRotZ = wobble * 0.095; // Classic top-heavy Humpty wobble!
      torsoRotX = 0.04 + bounce * 0.045;
      torsoRotY = Math.sin(elapsed * 2.1 + state.slot) * 0.1;
      lShX = -0.35 + wobble * 0.16;
      lShZ = -0.38 - bounce * 0.08;
      lElbX = -0.85;
      rShX = -0.52 - wobble * 0.16;
      rShZ = 0.38 + bounce * 0.08;
      rElbX = -1.0;
      lHipX = 0.06;
      lKneeX = 0.08;
      rHipX = -0.08;
      rKneeX = 0.1;
    } else if (state.action === 'walk') {
      // Funny waddling egg run cycle!
      const cyc = state.walkCycle * 1.25;
      const stride = Math.sin(cyc);
      pelvisY = basePelvisY + Math.abs(Math.cos(cyc)) * 0.095;
      pelvisRotZ = stride * 0.16; // Exaggerated side-to-side waddle
      torsoRotX = 0.16;
      torsoRotY = stride * 0.24;
      lHipX = stride * 0.72;
      rHipX = -stride * 0.72;
      lKneeX = Math.max(0, -stride) * 0.82;
      rKneeX = Math.max(0, stride) * 0.82;
      lShX = -0.45 - stride * 0.58;
      rShX = -0.45 + stride * 0.58;
      lShZ = -0.52;
      rShZ = 0.52;
      lElbX = -0.95;
      rElbX = -0.95;
    } else if (state.action === 'punch') {
      // Quick goofy slap-punch with striped arms!
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotY = -0.52 * snap;
      torsoRotX = 0.16 * snap;
      pelvisRotZ = -0.1 * snap;
      rShX = -1.62 * snap - 0.32;
      rShZ = 0.45 * (1 - snap) + 0.12;
      rElbX = -0.12 * snap - 0.75 * (1 - snap);
      lShX = -0.45;
      lShZ = -0.48;
      lElbX = -1.1;
    } else if (state.action === 'kick') {
      // High chunky teal-boot kick!
      const snap = Math.sin(atkProgress * Math.PI);
      torsoRotX = -0.34 * snap;
      torsoRotY = 0.32 * snap;
      pelvisRotZ = -0.12 * snap;
      rHipX = -1.65 * snap;
      rKneeX = 0.08 * snap;
      lHipX = 0.16 * snap;
      lShX = -0.65;
      lShZ = -0.68 * snap - 0.35;
      rShX = 0.48 * snap;
      rShZ = 0.58 * snap + 0.3;
    } else if (state.action === 'grab') {
      // Clumsy forward belly-bump grab!
      const snap = Math.sin(atkProgress * Math.PI);
      pelvisY = basePelvisY + snap * 0.08;
      torsoRotX = -0.22 * snap; // Pushes plump red-vest belly forward!
      pelvisRotX = 0.24 * snap;
      lShX = -1.25 * snap - 0.25;
      rShX = -1.25 * snap - 0.25;
      lShZ = -0.55 * (1 - snap) + 0.32 * snap;
      rShZ = 0.55 * (1 - snap) - 0.32 * snap;
      lElbX = -0.45;
      rElbX = -0.45;
    } else if (state.action === 'special') {
      // Deewar Drop: hops high, tucks striped arms & teal boots tightly into a cannonball egg, then slams forward!
      const isAir = state.y > 0.14 || atkProgress < 0.68;
      const tuck = isAir ? Math.sin(Math.min(1, atkProgress / 0.72) * Math.PI) : 0;
      const slam = atkProgress >= 0.68 ? 1 - (atkProgress - 0.68) / 0.32 : 0;
      pelvisY = isAir ? basePelvisY + 0.08 : basePelvisY - 0.16 * slam;
      pelvisRotX = isAir ? 0.58 * tuck : 0.22 * slam;
      torsoRotX = isAir ? 0.42 * tuck : 0.28 * slam;
      lShX = isAir ? -0.95 : -0.35;
      rShX = isAir ? -0.95 : -0.35;
      lShZ = isAir ? 0.55 : -0.65;
      rShZ = isAir ? -0.55 : 0.65;
      lElbX = isAir ? -1.65 : -0.6;
      rElbX = isAir ? -1.65 : -0.6;
      lHipX = isAir ? -1.35 : -0.35;
      rHipX = isAir ? -1.35 : -0.35;
      lKneeX = isAir ? 1.75 : 0.65;
      rKneeX = isAir ? 1.75 : 0.65;
    } else if (state.action === 'hit') {
      torsoRotX = -0.38;
      pelvisRotZ = 0.22;
      lShX = -1.35;
      rShX = -1.35;
      lShZ = -0.78;
      rShZ = 0.78;
    } else if (state.action === 'ko') {
      // Humpty falls off the wall and rolls onto his back!
      pelvisY = 0.48;
      pelvisRotX = -Math.PI * 0.48;
      pelvisRotZ = 0.28;
      lShX = -1.7;
      rShX = -1.5;
      lShZ = -0.82;
      rShZ = 0.82;
      lHipX = -0.5;
      rHipX = -0.35;
      lKneeX = 0.9;
      rKneeX = 0.75;
    } else if (state.action === 'victory') {
      // Cheerful Humpty top-hat bounce celebration!
      const hop = Math.abs(Math.sin(elapsed * 6.8));
      pelvisY = basePelvisY + hop * 0.16;
      pelvisRotZ = Math.sin(elapsed * 6.8) * 0.14;
      lShX = -2.45 + Math.sin(elapsed * 6.8) * 0.24;
      rShX = -2.45 - Math.sin(elapsed * 6.8) * 0.24;
      lShZ = -0.38;
      rShZ = 0.38;
      lElbX = -0.35;
      rElbX = -0.35;
    }

    // Playful Tilted Top Hat springy bob & tip!
    if (rig.hatPivot) {
      const hatBob =
        state.action === 'hit' || state.action === 'ko'
          ? 0.26
          : state.action === 'special'
            ? 0.16 * Math.sin(atkProgress * Math.PI)
            : Math.sin(elapsed * 4.4 + state.slot - 0.5) * 0.065;
      const hatLift =
        state.action === 'hit'
          ? 0.09
          : state.action === 'special' && state.y > 0.15
            ? 0.075
            : Math.max(0, Math.sin(elapsed * 4.4 + state.slot - 0.6)) * 0.028;
      rig.hatPivot.position.y = 1.215 + hatLift;
      rig.hatPivot.rotation.x = -0.24 - hatBob * 0.85;
      rig.hatPivot.rotation.z = 0.26 + Math.sin(elapsed * 3.8 + state.slot - 0.4) * 0.06 + (state.action === 'hit' ? 0.18 : 0);
    }
  } else if (state.id === 'mausi') {
    // Laddoo Mausi (Heavyweight Sweet-Shop Boss): grounded sturdy bounce, determined brisk march,
    // heavy overhead belan whack, stomping kick, powerhouse bear-hug shove, & snappy Belan Throw!
    const bounce = Math.sin(elapsed * 4.2 + state.slot * 1.7);

    if (state.action === 'idle') {
      pelvisY = basePelvisY + bounce * 0.038;
      pelvisRotZ = Math.sin(elapsed * 2.1 + state.slot) * 0.035;
      torsoRotX = 0.03 + bounce * 0.025;
      torsoRotY = Math.sin(elapsed * 2.1 + state.slot) * 0.09;
      headRotX = -0.02 + bounce * 0.025;
      // Confident grounded heavyweight stance: arms slightly out, belan poised in right hand
      lShX = -0.34 + bounce * 0.06;
      lShZ = -0.38 - Math.abs(bounce) * 0.04;
      lElbX = -1.02;
      rShX = -0.58 - bounce * 0.07;
      rShZ = 0.36 + Math.abs(bounce) * 0.04;
      rElbX = -1.2;
      lHipX = 0.06;
      lKneeX = 0.1;
      rHipX = -0.08;
      rKneeX = 0.12;
    } else if (state.action === 'walk') {
      // Determined brisk heavyweight march!
      const cyc = state.walkCycle * 1.12;
      const stride = Math.sin(cyc);
      pelvisY = basePelvisY + Math.abs(Math.cos(cyc)) * 0.055;
      pelvisRotZ = stride * 0.065;
      torsoRotX = 0.11;
      torsoRotY = stride * 0.18;
      lHipX = stride * 0.48;
      rHipX = -stride * 0.48;
      lKneeX = Math.max(0, -stride) * 0.56;
      rKneeX = Math.max(0, stride) * 0.56;
      lShX = -0.38 - stride * 0.48;
      rShX = -0.55 + stride * 0.44;
      lShZ = -0.36;
      rShZ = 0.36;
      lElbX = -1.05;
      rElbX = -1.15;
    } else if (state.action === 'punch') {
      // Heavy overhead-diagonal wooden belan whack!
      const windup = atkProgress < 0.28 ? atkProgress / 0.28 : 0;
      const swing = atkProgress >= 0.28 ? Math.sin(((atkProgress - 0.28) / 0.72) * Math.PI) : 0;
      pelvisY = basePelvisY - 0.04 * swing;
      torsoRotY = 0.32 * windup - 0.62 * swing;
      torsoRotX = -0.1 * windup + 0.22 * swing;
      rShX = -1.95 * windup - 1.55 * swing - 0.35;
      rShZ = 0.55 * windup + 0.18 * (1 - swing);
      rElbX = -1.35 * windup - 0.22 * swing - 0.45 * (1 - swing);
      lShX = -0.35;
      lShZ = -0.44;
      lElbX = -1.15;
    } else if (state.action === 'kick') {
      // Sturdy stomping heavyweight kick (chappal driving forward!)
      const snap = Math.sin(atkProgress * Math.PI);
      pelvisY = basePelvisY - 0.03 * snap;
      torsoRotX = -0.2 * snap;
      torsoRotY = 0.28 * snap;
      rHipX = -1.28 * snap;
      rKneeX = 0.14 * snap;
      lHipX = 0.14 * snap;
      lKneeX = 0.16 * snap;
      lShX = -0.48;
      lShZ = -0.56 * snap - 0.34;
      rShX = 0.36 * snap - 0.3;
      rShZ = 0.52 * snap + 0.32;
    } else if (state.action === 'grab') {
      // Powerhouse bear-hug / shoulder-shove!
      const snap = Math.sin(atkProgress * Math.PI);
      const wrap = atkProgress > 0.35 ? Math.sin(((atkProgress - 0.35) / 0.65) * Math.PI) : 0;
      pelvisY = basePelvisY - 0.05 * snap;
      torsoRotX = 0.24 * snap;
      lShX = -1.32 * snap - 0.25;
      rShX = -1.32 * snap - 0.25;
      lShZ = -0.68 * snap + 0.85 * wrap;
      rShZ = 0.68 * snap - 0.85 * wrap;
      lElbX = -0.5 - 0.7 * wrap;
      rElbX = -0.5 - 0.7 * wrap;
    } else if (state.action === 'special') {
      // Expressive Belan Throw: big confident windup then snappy whip-throw launch!
      const isWindup = atkProgress < 0.34;
      const wind = isWindup ? atkProgress / 0.34 : 0;
      const release = !isWindup ? Math.min(1, (atkProgress - 0.34) / 0.42) : 0;
      const recover = atkProgress > 0.76 ? (atkProgress - 0.76) / 0.24 : 0;
      const throwArc = release * (1 - recover * 0.45);
      pelvisY = basePelvisY - 0.04 * wind + 0.03 * throwArc;
      torsoRotY = 0.55 * wind - 0.72 * throwArc;
      torsoRotX = -0.14 * wind + 0.2 * throwArc;
      rShX = isWindup ? -0.55 - 1.75 * wind : -2.1 + 1.48 * throwArc;
      rShZ = isWindup ? 0.42 + 0.34 * wind : 0.62 - 0.48 * throwArc;
      rElbX = isWindup ? -1.45 : -0.18;
      lShX = isWindup ? -0.95 * wind - 0.3 : -0.25 + 0.35 * throwArc;
      lShZ = -0.46;
      lElbX = -0.85;
    } else if (state.action === 'hit') {
      torsoRotX = -0.3;
      pelvisRotZ = 0.14;
      headRotX = -0.24;
      lShX = -1.15;
      rShX = -1.15;
      lShZ = -0.68;
      rShZ = 0.68;
    } else if (state.action === 'ko') {
      pelvisY = 0.46;
      pelvisRotX = -Math.PI * 0.46;
      pelvisRotZ = 0.18;
      lShX = -1.5;
      rShX = -1.4;
      lShZ = -0.74;
      rShZ = 0.74;
      lHipX = -0.38;
      rHipX = -0.26;
      lKneeX = 0.72;
      rKneeX = 0.62;
    } else if (state.action === 'victory') {
      // Triumphant Belan Queen celebration: raises belan proudly overhead, left hand on hip!
      const hop = Math.abs(Math.sin(elapsed * 5.8));
      pelvisY = basePelvisY + hop * 0.11;
      pelvisRotZ = Math.sin(elapsed * 5.8) * 0.07;
      torsoRotY = Math.sin(elapsed * 2.9) * 0.12;
      rShX = -2.65 + Math.sin(elapsed * 6.4) * 0.18;
      rShZ = 0.28;
      rElbX = -0.25;
      lShX = -0.22;
      lShZ = -0.58;
      lElbX = -1.45;
    }
  }

  rig.pelvis.position.y = lerpAngle(rig.pelvis.position.y, pelvisY, jointAlpha);
  rig.pelvis.rotation.x = lerpAngle(rig.pelvis.rotation.x, pelvisRotX, jointAlpha);
  rig.pelvis.rotation.z = lerpAngle(rig.pelvis.rotation.z, pelvisRotZ, jointAlpha);
  rig.torso.rotation.x = lerpAngle(rig.torso.rotation.x, torsoRotX, jointAlpha);
  rig.torso.rotation.y = lerpAngle(rig.torso.rotation.y, torsoRotY, jointAlpha);
  rig.head.rotation.x = lerpAngle(rig.head.rotation.x, headRotX, jointAlpha);
  rig.head.rotation.z = lerpAngle(rig.head.rotation.z, headRotZ, jointAlpha);

  rig.leftShoulder.rotation.x = lerpAngle(rig.leftShoulder.rotation.x, lShX, jointAlpha);
  rig.leftShoulder.rotation.z = lerpAngle(rig.leftShoulder.rotation.z, lShZ, jointAlpha);
  rig.leftElbow.rotation.x = lerpAngle(rig.leftElbow.rotation.x, lElbX, jointAlpha);

  rig.rightShoulder.rotation.x = lerpAngle(rig.rightShoulder.rotation.x, rShX, jointAlpha);
  rig.rightShoulder.rotation.z = lerpAngle(rig.rightShoulder.rotation.z, rShZ, jointAlpha);
  rig.rightElbow.rotation.x = lerpAngle(rig.rightElbow.rotation.x, rElbX, jointAlpha);

  rig.leftHip.rotation.x = lerpAngle(rig.leftHip.rotation.x, lHipX, jointAlpha);
  rig.leftKnee.rotation.x = lerpAngle(rig.leftKnee.rotation.x, lKneeX, jointAlpha);
  rig.rightHip.rotation.x = lerpAngle(rig.rightHip.rotation.x, rHipX, jointAlpha);
  rig.rightKnee.rotation.x = lerpAngle(rig.rightKnee.rotation.x, rKneeX, jointAlpha);
}
