import * as THREE from 'three';
import type { FighterId, FighterState } from '../types';
import type { DynamicFace } from './faceCanvas';
import { computeCombatPose } from './kinematics';

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

  // Hit flash & subtle wake-up invincibility shimmer
  const isWakeupShimmer =
    state.hitFlashTimer <= 0 &&
    state.action !== 'super' &&
    (state.action === 'getup' || (state.invulnTimer > 0 && state.action !== 'knockdown'));
  const flashVal =
    state.hitFlashTimer > 0
      ? 0.65
      : isWakeupShimmer
        ? 0.14 + Math.abs(Math.sin(elapsed * 26)) * 0.22
        : 0;
  for (const mat of rig.flashMaterials) {
    mat.emissiveIntensity = flashVal;
  }

  // Dharna Shield & Super / Paisa Flex golden aura visibility
  rig.shieldAura.visible = state.dharnaShieldTimer > 0;
  if (rig.shieldAura.visible) {
    const wavePulse =
      state.action === 'special' && state.dharnaWaveFired
        ? 1.24 + Math.sin(elapsed * 26) * 0.06
        : 1.0 + Math.sin(elapsed * 14) * 0.05;
    rig.shieldAura.scale.set(wavePulse, wavePulse, wavePulse);
    if (rig.dharnaRing) {
      rig.dharnaRing.rotation.y = elapsed * (state.dharnaWaveFired ? 3.2 : 1.65);
    }
  }
  const isSheruPaisaFlex = state.id === 'sheru' && state.action === 'special';
  rig.superAura.visible =
    (state.action === 'super' && state.id !== 'sheru') ||
    state.shakti >= 100 ||
    isSheruPaisaFlex;
  if (rig.superAura.visible) {
    rig.superAura.rotation.z = elapsed * (isSheruPaisaFlex ? 8.5 : 5);
    const sc = isSheruPaisaFlex
      ? 1.15 + Math.sin(Math.min(1, state.actionTimer / Math.max(0.2, state.actionDuration)) * Math.PI) * 0.65
      : state.action === 'super'
        ? 1.35
        : 0.88 + Math.sin(elapsed * 6) * 0.06;
    rig.superAura.scale.set(sc, sc, sc);
    rig.superAura.position.y = isSheruPaisaFlex ? 1.15 : state.action === 'super' ? 1.05 : 0.16;
  }

  if (rig.handProp) {
    if (state.id === 'billa') {
      rig.handProp.visible = state.action === 'special' && !hideHandProp;
    } else if (state.id === 'mausi') {
      rig.handProp.visible = !hideHandProp;
    } else if (state.id === 'sheru') {
      rig.handProp.visible = state.action === 'special' || state.action === 'victory';
    }
  }

  // Compute full-body procedural martial-arts kinematics for core combat states
  // (athletic guard stance, stepping footwork, 3-hit punches, snap/sweep/jump kicks,
  // clinch/throw/whiff grabs, sharp hit stagger, airborne knockdown flip, 2-stage get-up)
  const basePelvisY =
    state.id === 'billa' ? 0.68 : state.id === 'mausi' ? 0.88 : rig.isEggBody ? 0.68 : 0.92;
  const pose = computeCombatPose(state, elapsed, basePelvisY, rig.isEggBody);

  let pelvisX = pose.pelvisX;
  let pelvisY = pose.pelvisY;
  let pelvisRotX = pose.pelvisRotX;
  let pelvisRotY = pose.pelvisRotY;
  let pelvisRotZ = pose.pelvisRotZ;
  let torsoRotX = pose.torsoRotX;
  let torsoRotY = pose.torsoRotY;
  let torsoRotZ = pose.torsoRotZ;
  let headRotX = pose.headRotX;
  let headRotY = pose.headRotY;
  let headRotZ = pose.headRotZ;
  let lShX = pose.lShX;
  let lShY = pose.lShY;
  let lShZ = pose.lShZ;
  let lElbX = pose.lElbX;
  let rShX = pose.rShX;
  let rShY = pose.rShY;
  let rShZ = pose.rShZ;
  let rElbX = pose.rElbX;
  let lHipX = pose.lHipX;
  let lHipZ = pose.lHipZ;
  let lKneeX = pose.lKneeX;
  let rHipX = pose.rHipX;
  let rHipZ = pose.rHipZ;
  let rKneeX = pose.rKneeX;

  let jointAlpha = 1 - Math.exp(-pose.snapRate * Math.max(dt, 0.008));
  const atkProgress =
    state.actionDuration > 0 ? Math.min(1, state.actionTimer / state.actionDuration) : 0;

  // Preserve each fighter's iconic Special Move, Sheru's 7.5s Super, Victory pose,
  // and living secondary props (tail, shades, eyes, jhola, top hat)
  if (state.id === 'sheru') {
    if (state.action === 'special') {
      // PAISA FLEX: cocky chest-puff double-flex pose -> explosive forward golden aura burst!
      const isWindup = atkProgress < 0.28;
      const burst = isWindup ? 0 : Math.min(1, (atkProgress - 0.28) / 0.3);
      const settle = atkProgress > 0.7 ? (atkProgress - 0.7) / 0.3 : 0;
      const flexPeak = burst * (1 - settle * 0.45);
      pelvisX = 0.22 * flexPeak;
      pelvisY = basePelvisY + (isWindup ? -0.05 : 0.06 * flexPeak);
      pelvisRotY = -0.18 * state.facing;
      torsoRotX = isWindup ? 0.14 : -0.32 * flexPeak;
      torsoRotY = -0.24 * state.facing * (1 - flexPeak);
      headRotX = isWindup ? 0.06 : -0.16 * flexPeak;
      headRotY = 0.24 * state.facing;
      // Wide cocky double-bicep chest-puff flex!
      lShX = -0.82 - 0.55 * flexPeak;
      lShZ = -0.95 - 0.25 * flexPeak;
      lElbX = -1.72 + 0.25 * flexPeak;
      rShX = -0.82 - 0.55 * flexPeak;
      rShZ = 0.95 + 0.25 * flexPeak;
      rElbX = -1.72 + 0.25 * flexPeak;
      lHipX = -0.42;
      lKneeX = 0.48;
      rHipX = 0.42;
      rKneeX = 0.36;
    } else if (state.action === 'super') {
      // Choreographed 7.5s "TRILLION DOLLAR BEATDOWN" 4-phase animation (unchanged!)
      const t = state.actionTimer;
      pelvisX = 0;
      pelvisRotY = 0;
      torsoRotZ = 0;
      headRotY = 0;
      lShY = 0;
      rShY = 0;
      lHipZ = 0;
      rHipZ = 0;
      if (t < 1.0) {
        const tiltWave = Math.sin(Math.min(1, t / 0.85) * Math.PI);
        pelvisY = basePelvisY + 0.04;
        torsoRotX = -0.18;
        torsoRotY = -0.14;
        headRotX = 0.08;
        headRotZ = -0.09 * tiltWave;
        rShX = -0.75 - 1.05 * tiltWave;
        rShZ = 0.28 - 0.52 * tiltWave;
        rElbX = -0.95 - 0.82 * tiltWave;
        lShX = -0.15;
        lShZ = -0.52;
        lElbX = -1.35;
      } else if (t < 3.0) {
        jointAlpha = 1 - Math.exp(-32 * Math.max(dt, 0.008));
        const flurryOsc = Math.sin((t - 1.0) * 38);
        pelvisY = basePelvisY - 0.07;
        torsoRotX = 0.24;
        torsoRotY = flurryOsc * 0.52;
        headRotX = -0.06;
        const rightForward = Math.max(0, flurryOsc);
        const leftForward = Math.max(0, -flurryOsc);
        rShX = -1.25 - rightForward * 0.72;
        rShZ = 0.14 + (1 - rightForward) * 0.24;
        rElbX = -1.48 + rightForward * 1.38;
        lShX = -1.25 - leftForward * 0.72;
        lShZ = -0.14 - (1 - leftForward) * 0.24;
        lElbX = -1.48 + leftForward * 1.38;
        lHipX = -0.26;
        rHipX = 0.32;
        lKneeX = 0.34;
        rKneeX = 0.26;
      } else if (t < 4.05) {
        jointAlpha = 1 - Math.exp(-24 * Math.max(dt, 0.008));
        const isWindup = t < 3.42;
        const wind = isWindup ? (t - 3.0) / 0.42 : 1;
        const swing = isWindup ? 0 : Math.min(1, (t - 3.42) / 0.26);
        pelvisY = basePelvisY + (isWindup ? -0.04 * wind : 0.08 * swing);
        torsoRotX = isWindup ? 0.12 * wind : -0.22 * swing;
        torsoRotY = isWindup ? 0.68 * wind : -0.82 * swing;
        headRotX = isWindup ? 0.06 : -0.12;
        rShX = isWindup ? -0.45 - 0.25 * wind : -2.35 * swing - 0.3 * (1 - swing);
        rShZ = isWindup ? 0.88 * wind + 0.15 : -0.22 * swing + 0.4 * (1 - swing);
        rElbX = isWindup ? -0.48 : -0.12;
        lShX = -0.25;
        lShZ = -0.48;
        lElbX = -1.15;
      } else if (t < 5.5) {
        jointAlpha = 1 - Math.exp(-18 * Math.max(dt, 0.008));
        pelvisY = 0.38;
        pelvisRotX = -Math.PI * 0.43;
        pelvisRotZ = 0.22;
        torsoRotX = 0.26;
        headRotX = 0.42;
        headRotZ = -0.16;

        if (t < 4.78) {
          const kickSnap = Math.sin(Math.min(1, Math.max(0, (t - 4.28) / 0.36)) * Math.PI);
          rHipX = -0.35 - 1.25 * kickSnap;
          rKneeX = 0.45 * (1 - kickSnap) + 0.08;
          lHipX = -0.25;
          lKneeX = 0.72;
          lShX = -0.55;
          lShZ = -0.52;
          lElbX = -1.25;
          rShX = -0.42;
          rShZ = 0.42;
          rElbX = -0.95;
        } else {
          const slapSnap = Math.sin(Math.min(1, Math.max(0, (t - 4.82) / 0.42)) * Math.PI);
          rHipX = -0.22;
          rKneeX = 0.55;
          lHipX = -0.18;
          lKneeX = 0.65;
          rShX = -0.65 - 1.55 * slapSnap;
          rShZ = 0.55 * (1 - slapSnap) - 0.15 * slapSnap;
          rElbX = -0.18;
          lShX = -0.65;
          lShZ = -0.48;
          lElbX = -1.25;
        }
      } else {
        jointAlpha = 1 - Math.exp(-20 * Math.max(dt, 0.008));
        const snapped = t >= 6.15;
        const snapBounce = snapped ? Math.exp(-(t - 6.15) * 6.5) : 0;
        pelvisY = basePelvisY + 0.04 + snapBounce * 0.08;
        torsoRotX = -0.16;
        torsoRotY = snapped ? -0.24 : 0.14;
        headRotX = 0.08;
        headRotZ = snapped ? -0.12 : 0.04;
        rShX = snapped ? -2.2 + snapBounce * 0.35 : -2.48;
        rShZ = snapped ? 0.44 : 0.22;
        rElbX = snapped ? -0.58 : -0.22;
        lShX = -0.15;
        lShZ = -0.54;
        lElbX = -1.35;
      }
    } else if (state.action === 'victory') {
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
      const tailAmp = state.action === 'ko' || state.action === 'knockdown' ? 0.08 : state.action === 'walk' ? 0.38 : 0.22;
      rig.tailPivot.rotation.y = Math.sin(elapsed * tailSpeed + state.slot) * tailAmp;
      rig.tailPivot.rotation.x =
        state.action === 'ko' || state.action === 'knockdown'
          ? -0.45
          : -0.25 + Math.cos(elapsed * tailSpeed * 0.5) * 0.1;
    }

    // Mane subtle bounce
    if (rig.maneGroup) {
      const maneScale = 1 + Math.sin(elapsed * 4.5 + state.slot) * 0.015;
      rig.maneGroup.scale.set(maneScale, 1, maneScale);
    }

    // Aviator Sunglasses tilt & flash on heavy hits / KO / Super beat drop & snap
    if (rig.shadesPivot) {
      const superTilt =
        state.action === 'super' && state.actionTimer < 1.0
          ? -0.16 * Math.sin(Math.min(1, state.actionTimer / 0.85) * Math.PI)
          : state.action === 'super' && state.actionTimer >= 6.15 && state.actionTimer < 6.75
            ? 0.12 * Math.exp(-(state.actionTimer - 6.15) * 5)
            : 0;
      const targetTiltZ =
        state.action === 'ko' || state.action === 'knockdown'
          ? 0.34
          : state.action === 'hit'
            ? 0.22 * Math.sin(elapsed * 28)
            : superTilt;
      const targetDropY =
        state.action === 'ko' || state.action === 'knockdown'
          ? -0.04
          : state.action === 'hit'
            ? -0.015
            : 0;
      rig.shadesPivot.rotation.z = lerpAngle(rig.shadesPivot.rotation.z, targetTiltZ, alpha);
      rig.shadesPivot.position.y = lerpAngle(rig.shadesPivot.position.y, targetDropY, alpha);
    }
    if (rig.shadesLensMat) {
      const superGlint =
        state.action === 'super' &&
        (state.actionTimer < 1.0 || (state.actionTimer >= 6.0 && state.actionTimer <= 6.8))
          ? 0.95 + Math.abs(Math.sin(elapsed * 16)) * 0.75
          : 0;
      const glint =
        superGlint > 0
          ? superGlint
          : state.hitFlashTimer > 0
            ? 1.15
            : state.action === 'special' || state.action === 'victory'
              ? 0.28 + Math.max(0, Math.sin(elapsed * 10)) * 0.35
              : 0.04;
      rig.shadesLensMat.emissiveIntensity = glint;
    }
  } else if (state.id === 'billa') {
    if (state.action === 'special') {
      // SWATTER THROW: big cartoon side-arm windup -> snappy whip-throw launching spinning 3D fly-swatter!
      const isWindup = atkProgress < 0.28;
      const wind = isWindup ? atkProgress / 0.28 : 1;
      const throwT = isWindup ? 0 : Math.min(1, (atkProgress - 0.28) / 0.36);
      const followT = atkProgress > 0.68 ? (atkProgress - 0.68) / 0.32 : 0;
      const arc = throwT * (1 - followT * 0.4);

      pelvisX = 0.18 * arc;
      pelvisRotY = 0;
      headRotY = 0;
      pelvisY = basePelvisY + (isWindup ? 0.06 * wind : -0.05 * arc);
      torsoRotX = isWindup ? -0.18 * wind : 0.34 * arc;
      torsoRotY = isWindup ? 0.65 * wind : -0.82 * arc;
      headRotX = isWindup ? -0.08 : 0.12 * arc;
      rShX = isWindup ? -1.1 - 1.45 * wind : -2.45 + arc * 1.55;
      rShZ = isWindup ? 0.55 + 0.35 * wind : 0.55 - arc * 0.72;
      rElbX = isWindup ? -1.25 : -0.1;
      lShX = -0.85;
      lShZ = -0.58;
      lElbX = -0.95;
    } else if (state.action === 'victory') {
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
      const tailAmp = state.action === 'ko' || state.action === 'knockdown' ? 0.05 : state.action === 'hit' ? 0.65 : 0.46;
      rig.tailPivot.rotation.y = Math.sin(elapsed * tailSpeed + state.slot) * tailAmp;
      rig.tailPivot.rotation.z =
        Math.cos(elapsed * tailSpeed * 0.5) *
        (state.action === 'ko' || state.action === 'knockdown' ? 0.05 : 0.18);
      rig.tailPivot.rotation.x =
        state.action === 'ko' || state.action === 'knockdown'
          ? -0.55
          : -0.12 + Math.sin(elapsed * tailSpeed * 0.5) * 0.12;
    }

    // Comedic 3D Vertical Eye Bulge & Pinpoint/Dizzy Pupils on Hit & KO!
    if (rig.billaEyesGroup) {
      const shocked = state.action === 'hit' || state.action === 'grabbed';
      const down = state.action === 'ko' || state.action === 'knockdown';
      const targetEx = shocked ? 1.24 : down ? 1.12 : 1.0;
      const targetEy = shocked ? 1.28 : down ? 0.92 : 1.0;
      const targetEz = shocked ? 1.45 : 1.0;
      rig.billaEyesGroup.scale.x = lerpAngle(rig.billaEyesGroup.scale.x, targetEx, alpha);
      rig.billaEyesGroup.scale.y = lerpAngle(rig.billaEyesGroup.scale.y, targetEy, alpha);
      rig.billaEyesGroup.scale.z = lerpAngle(rig.billaEyesGroup.scale.z, targetEz, alpha);
    }
    if (rig.billaPupils.length === 2) {
      const [leftPupil, rightPupil] = rig.billaPupils;
      const isAttacking =
        state.action === 'punch' ||
        state.action === 'kick' ||
        state.action === 'sweep' ||
        state.action === 'special' ||
        state.action === 'super';
      const pScale = state.action === 'hit' || state.action === 'grabbed' ? 0.52 : isAttacking ? 1.12 : 1.0;
      leftPupil.scale.set(pScale, pScale, 1);
      rightPupil.scale.set(pScale, pScale, 1);
      if (state.action === 'ko' || state.action === 'knockdown') {
        leftPupil.position.y = Math.sin(elapsed * 14) * 0.04;
        rightPupil.position.y = -Math.sin(elapsed * 14) * 0.04;
      } else {
        leftPupil.position.y = 0;
        rightPupil.position.y = 0;
      }
    }
  } else if (state.id === 'neta') {
    if (state.action === 'special') {
      // Dharna Shield: grounded cross-legged protest sit on arena floor with hands in firm namaste!
      pelvisX = 0;
      pelvisY = 0.44;
      pelvisRotY = 0;
      torsoRotX = 0.06;
      torsoRotY = 0;
      headRotX = -0.04;
      headRotY = 0;
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
      state.action === 'walk' ||
      state.action === 'punch' ||
      state.action === 'kick' ||
      state.action === 'sweep'
        ? 1.0
        : state.action === 'ko' || state.action === 'knockdown'
          ? 0.0
          : 0.35;
    if (rig.jholaPivot) {
      rig.jholaPivot.rotation.z =
        Math.sin(elapsed * 6.2 + state.slot) * (0.04 + 0.08 * motionEnergy);
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
    if (state.action === 'special') {
      // ANDA SQUASH: hops forward in belly-flop arc -> lies COMPLETELY FLAT on top of opponent -> bounces back up!
      const isAir = state.y > 0.12 && state.squashHoldTimer <= 0;
      const isFloppedFlat = state.squashHoldTimer > 0;
      pelvisX = 0;
      pelvisRotY = 0;
      torsoRotY = 0;
      headRotY = 0;
      if (isAir) {
        // Diving belly-flop launch arc toward opponent!
        const dive = Math.min(1, atkProgress / 0.45);
        pelvisY = basePelvisY + 0.08;
        pelvisRotX = 0.45 + 0.92 * dive;
        torsoRotX = 0.22;
        lShX = -0.65;
        rShX = -0.65;
        lShZ = -0.92;
        rShZ = 0.92;
        lElbX = -0.35;
        rElbX = -0.35;
        lHipX = 0.52;
        rHipX = 0.52;
        lKneeX = 0.48;
        rKneeX = 0.48;
      } else if (isFloppedFlat) {
        // Completely horizontal belly-flop lying flat on top of squashed opponent!
        pelvisY = 0.58;
        pelvisRotX = Math.PI * 0.48;
        pelvisRotZ = 0.06 * Math.sin(elapsed * 22);
        torsoRotX = 0.04;
        headRotX = -0.18;
        lShX = -0.25;
        rShX = -0.25;
        lShZ = -1.28;
        rShZ = 1.28;
        lElbX = -0.15;
        rElbX = -0.15;
        lHipX = 0.12;
        rHipX = 0.12;
        lHipZ = -0.36;
        rHipZ = 0.36;
        lKneeX = 0.12;
        rKneeX = 0.12;
      } else {
        // Cheerful bounce back up into athletic fighting guard!
        const bounceT = Math.min(1, Math.max(0, (atkProgress - 0.72) / 0.28));
        const pop = Math.sin(bounceT * Math.PI) * 0.22;
        pelvisY = basePelvisY + pop;
        pelvisRotX = (1 - bounceT) * 0.65;
        torsoRotX = (1 - bounceT) * 0.25;
        lShZ = -0.38 - (1 - bounceT) * 0.5;
        rShZ = 0.38 + (1 - bounceT) * 0.5;
        lHipX = -0.34;
        rHipX = 0.32;
        lKneeX = 0.42;
        rKneeX = 0.38;
      }
    } else if (state.action === 'victory') {
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
        state.action === 'hit' ||
        state.action === 'ko' ||
        state.action === 'knockdown' ||
        state.action === 'grabbed'
          ? 0.26
          : state.action === 'special'
            ? 0.16 * Math.sin(atkProgress * Math.PI)
            : Math.sin(elapsed * 4.4 + state.slot - 0.5) * 0.065;
      const hatLift =
        state.action === 'hit' || state.action === 'knockdown'
          ? 0.09
          : state.action === 'special' && state.y > 0.15
            ? 0.075
            : Math.max(0, Math.sin(elapsed * 4.4 + state.slot - 0.6)) * 0.028;
      rig.hatPivot.position.y = 1.215 + hatLift;
      rig.hatPivot.rotation.x = -0.24 - hatBob * 0.85;
      rig.hatPivot.rotation.z =
        0.26 +
        Math.sin(elapsed * 3.8 + state.slot - 0.4) * 0.06 +
        (state.action === 'hit' || state.action === 'knockdown' ? 0.18 : 0);
    }
  } else if (state.id === 'mausi') {
    if (state.action === 'special') {
      // Expressive Belan Throw: big confident windup then snappy whip-throw launch!
      const isWindup = atkProgress < 0.34;
      const wind = isWindup ? atkProgress / 0.34 : 0;
      const release = !isWindup ? Math.min(1, (atkProgress - 0.34) / 0.42) : 0;
      const recover = atkProgress > 0.76 ? (atkProgress - 0.76) / 0.24 : 0;
      const throwArc = release * (1 - recover * 0.45);
      pelvisRotY = 0;
      headRotY = 0;
      pelvisY = basePelvisY - 0.04 * wind + 0.03 * throwArc;
      torsoRotY = 0.55 * wind - 0.72 * throwArc;
      torsoRotX = -0.14 * wind + 0.2 * throwArc;
      rShX = isWindup ? -0.55 - 1.75 * wind : -2.1 + 1.48 * throwArc;
      rShZ = isWindup ? 0.42 + 0.34 * wind : 0.62 - 0.48 * throwArc;
      rElbX = isWindup ? -1.45 : -0.18;
      lShX = isWindup ? -0.95 * wind - 0.3 : -0.25 + 0.35 * throwArc;
      lShZ = -0.46;
      lElbX = -0.85;
    } else if (state.action === 'victory') {
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

  // Opponent flattened horizontally on the arena floor underneath Anda Bhai's ANDA SQUASH!
  if (state.squashedTimer > 0 && state.hp > 0) {
    pelvisX = 0;
    pelvisY = 0.22;
    pelvisRotX = -Math.PI * 0.48;
    pelvisRotY = 0;
    pelvisRotZ = 0;
    torsoRotX = 0;
    torsoRotY = 0;
    headRotX = 0.1;
    headRotY = 0;
    lShX = -1.6;
    lShZ = -0.95;
    lElbX = -0.2;
    rShX = -1.6;
    rShZ = 0.95;
    rElbX = -0.2;
    lHipX = 0.1;
    rHipX = -0.1;
    lKneeX = 0.12;
    rKneeX = 0.12;
    jointAlpha = 1 - Math.exp(-32 * Math.max(dt, 0.008));
  }

  rig.pelvis.position.z = lerpAngle(rig.pelvis.position.z, pelvisX, jointAlpha);
  rig.pelvis.position.y = lerpAngle(rig.pelvis.position.y, pelvisY, jointAlpha);
  rig.pelvis.rotation.x = lerpAngle(rig.pelvis.rotation.x, pelvisRotX, jointAlpha);
  rig.pelvis.rotation.y = lerpAngle(rig.pelvis.rotation.y, pelvisRotY, jointAlpha);
  rig.pelvis.rotation.z = lerpAngle(rig.pelvis.rotation.z, pelvisRotZ, jointAlpha);

  rig.torso.rotation.x = lerpAngle(rig.torso.rotation.x, torsoRotX, jointAlpha);
  rig.torso.rotation.y = lerpAngle(rig.torso.rotation.y, torsoRotY, jointAlpha);
  rig.torso.rotation.z = lerpAngle(rig.torso.rotation.z, torsoRotZ, jointAlpha);

  rig.head.rotation.x = lerpAngle(rig.head.rotation.x, headRotX, jointAlpha);
  rig.head.rotation.y = lerpAngle(rig.head.rotation.y, headRotY, jointAlpha);
  rig.head.rotation.z = lerpAngle(rig.head.rotation.z, headRotZ, jointAlpha);

  rig.leftShoulder.rotation.x = lerpAngle(rig.leftShoulder.rotation.x, lShX, jointAlpha);
  rig.leftShoulder.rotation.y = lerpAngle(rig.leftShoulder.rotation.y, lShY, jointAlpha);
  rig.leftShoulder.rotation.z = lerpAngle(rig.leftShoulder.rotation.z, lShZ, jointAlpha);
  rig.leftElbow.rotation.x = lerpAngle(rig.leftElbow.rotation.x, lElbX, jointAlpha);

  rig.rightShoulder.rotation.x = lerpAngle(rig.rightShoulder.rotation.x, rShX, jointAlpha);
  rig.rightShoulder.rotation.y = lerpAngle(rig.rightShoulder.rotation.y, rShY, jointAlpha);
  rig.rightShoulder.rotation.z = lerpAngle(rig.rightShoulder.rotation.z, rShZ, jointAlpha);
  rig.rightElbow.rotation.x = lerpAngle(rig.rightElbow.rotation.x, rElbX, jointAlpha);

  rig.leftHip.rotation.x = lerpAngle(rig.leftHip.rotation.x, lHipX, jointAlpha);
  rig.leftHip.rotation.z = lerpAngle(rig.leftHip.rotation.z, lHipZ, jointAlpha);
  rig.leftKnee.rotation.x = lerpAngle(rig.leftKnee.rotation.x, lKneeX, jointAlpha);

  rig.rightHip.rotation.x = lerpAngle(rig.rightHip.rotation.x, rHipX, jointAlpha);
  rig.rightHip.rotation.z = lerpAngle(rig.rightHip.rotation.z, rHipZ, jointAlpha);
  rig.rightKnee.rotation.x = lerpAngle(rig.rightKnee.rotation.x, rKneeX, jointAlpha);
}
