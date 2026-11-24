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
  leftFistAnchor: THREE.Object3D;
  rightFistAnchor: THREE.Object3D;
  leftFootAnchor: THREE.Object3D;
  rightFootAnchor: THREE.Object3D;
  contactShadow: THREE.Mesh;
  handProp: THREE.Object3D | null;
  tailPivot: THREE.Group | null;
  shadesPivot: THREE.Group | null;
  maneGroup: THREE.Group | null;
  shadesLensMat: THREE.MeshStandardMaterial | null;
  billaEyesGroup: THREE.Group | null;
  billaPupils: THREE.Object3D[];
  billaEyeGlowMats: THREE.MeshStandardMaterial[];
  jholaPivot: THREE.Group | null;
  jholaPapersGroup: THREE.Group | null;
  gamchaFront: THREE.Mesh | null;
  gamchaBack: THREE.Mesh | null;
  dharnaRing: THREE.Object3D | null;
  hatPivot: THREE.Group | null;
  mausiPalluGroup: THREE.Group | null;
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
  pelvis.rotation.order = 'YXZ';
  pelvis.position.set(0, isEggBody ? 0.68 : 0.92, 0);
  bodyGroup.add(pelvis);

  const torso = new THREE.Group();
  torso.rotation.order = 'YXZ';
  torso.position.set(0, isEggBody ? 0.04 : 0.14, 0);
  pelvis.add(torso);

  const head = new THREE.Group();
  head.position.set(0, isEggBody ? 0.62 : 0.86, 0);
  torso.add(head);

  const shoulderY = isEggBody ? 0.46 : 0.66;
  const shoulderX = isEggBody ? 0.53 : 0.43;

  const leftShoulder = new THREE.Group();
  leftShoulder.rotation.order = 'YXZ';
  leftShoulder.position.set(-shoulderX, shoulderY, 0);
  torso.add(leftShoulder);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, isEggBody ? -0.27 : -0.34, 0);
  leftShoulder.add(leftElbow);

  const leftFistAnchor = new THREE.Object3D();
  leftFistAnchor.position.set(0, -0.35, 0.02);
  leftElbow.add(leftFistAnchor);

  const rightShoulder = new THREE.Group();
  rightShoulder.rotation.order = 'YXZ';
  rightShoulder.position.set(shoulderX, shoulderY, 0);
  torso.add(rightShoulder);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, isEggBody ? -0.27 : -0.34, 0);
  rightShoulder.add(rightElbow);

  const rightFistAnchor = new THREE.Object3D();
  rightFistAnchor.position.set(0, -0.35, 0.02);
  rightElbow.add(rightFistAnchor);

  const hipX = isEggBody ? 0.2 : 0.19;
  const leftHip = new THREE.Group();
  leftHip.rotation.order = 'YXZ';
  leftHip.position.set(-hipX, isEggBody ? 0.04 : 0, 0);
  pelvis.add(leftHip);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, isEggBody ? -0.32 : -0.44, 0);
  leftHip.add(leftKnee);

  const leftFootAnchor = new THREE.Object3D();
  leftFootAnchor.position.set(0, -0.4, 0.08);
  leftKnee.add(leftFootAnchor);

  const rightHip = new THREE.Group();
  rightHip.rotation.order = 'YXZ';
  rightHip.position.set(hipX, isEggBody ? 0.04 : 0, 0);
  pelvis.add(rightHip);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, isEggBody ? -0.32 : -0.44, 0);
  rightHip.add(rightKnee);

  const rightFootAnchor = new THREE.Object3D();
  rightFootAnchor.position.set(0, -0.4, 0.08);
  rightKnee.add(rightFootAnchor);

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
    leftFistAnchor,
    rightFistAnchor,
    leftFootAnchor,
    rightFootAnchor,
    contactShadow,
    handProp: null,
    tailPivot: null,
    shadesPivot: null,
    maneGroup: null,
    shadesLensMat: null,
    billaEyesGroup: null,
    billaPupils: [],
    billaEyeGlowMats: [],
    jholaPivot: null,
    jholaPapersGroup: null,
    gamchaFront: null,
    gamchaBack: null,
    dharnaRing: null,
    hatPivot: null,
    mausiPalluGroup: null,
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
    (state.action === 'super' &&
      state.id !== 'sheru' &&
      state.id !== 'billa' &&
      state.id !== 'neta' &&
      state.id !== 'anda' &&
      state.id !== 'mausi') ||
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
      rig.handProp.visible = !hideHandProp && state.action !== 'super';
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
  let lElbZ = pose.lElbZ;
  let rShX = pose.rShX;
  let rShY = pose.rShY;
  let rShZ = pose.rShZ;
  let rElbX = pose.rElbX;
  let rElbZ = pose.rElbZ;
  let lHipX = pose.lHipX;
  let lHipY = pose.lHipY;
  let lHipZ = pose.lHipZ;
  let lKneeX = pose.lKneeX;
  let rHipX = pose.rHipX;
  let rHipY = pose.rHipY;
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
      lElbZ = 0;
      rElbZ = 0;
      lHipY = 0;
      rHipY = 0;
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
    } else if (state.action === 'super') {
      // CHIRKUT CHAOS (4.5s): Wide glowing eyes -> launch snap -> mischievous cackling watch!
      const t = state.actionTimer;
      pelvisX = 0;
      pelvisRotY = 0;
      torsoRotZ = 0;
      headRotY = 0;
      lShY = 0;
      rShY = 0;
      lElbZ = 0;
      rElbZ = 0;
      lHipY = 0;
      rHipY = 0;
      lHipZ = 0;
      rHipZ = 0;
      if (t < 1.2) {
        // Phase 1: Tense hunch forward toward camera/opponent while eyes enlarge & glow neon green-yellow
        const charge = Math.min(1, t / 0.9);
        const tremble = Math.sin(elapsed * 42) * 0.04 * charge;
        pelvisY = basePelvisY - 0.08 * charge;
        torsoRotX = 0.24 * charge;
        torsoRotY = -0.18 * state.facing;
        headRotX = -0.14 * charge;
        headRotY = 0.16 * state.facing;
        headRotZ = tremble;
        lShX = -1.15 - 0.35 * charge;
        lShZ = -0.65 - 0.2 * charge;
        lElbX = -1.45;
        rShX = -1.15 - 0.35 * charge;
        rShZ = 0.65 + 0.2 * charge;
        rElbX = -1.45;
        lHipX = -0.35;
        lKneeX = 0.55;
        rHipX = 0.35;
        rKneeX = 0.45;
      } else if (t < 2.1) {
        // Phase 2: Head snaps forward launching the 3 cockroaches out of his eyes!
        const snap = Math.sin(Math.min(1, (t - 1.2) / 0.35) * Math.PI);
        pelvisY = basePelvisY + 0.04 * snap;
        torsoRotX = 0.38 * snap + 0.12;
        headRotX = 0.22 * snap;
        lShX = -0.85;
        lShZ = -0.95;
        lElbX = -0.55;
        rShX = -0.85;
        rShZ = 0.95;
        rElbX = -0.55;
      } else {
        // Phase 3-4: Gleeful laughing/pointing cat stance watching the smoke-cloud beatdown!
        const laugh = Math.sin(elapsed * 14);
        pelvisY = basePelvisY + Math.abs(laugh) * 0.08;
        torsoRotX = -0.14 + laugh * 0.06;
        torsoRotY = Math.sin(elapsed * 5) * 0.14;
        headRotX = -0.08 + laugh * 0.08;
        rShX = -1.58 + laugh * 0.14;
        rShZ = 0.18;
        rElbX = -0.22;
        lShX = -0.72;
        lShZ = -0.45;
        lElbX = -1.35 + laugh * 0.18;
      }
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
        state.action === 'victory' || state.action === 'special' || state.action === 'super'
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

    // Comedic 3D Vertical Eye Bulge + CHIRKUT CHAOS Wide Neon Green-Yellow Glowing Eyes!
    const billaSuperGlowPhase = state.action === 'super' && state.actionTimer < 1.65;
    if (rig.billaEyesGroup) {
      const shocked = state.action === 'hit' || state.action === 'grabbed';
      const down = state.action === 'ko' || state.action === 'knockdown';
      let targetEx = shocked ? 1.24 : down ? 1.12 : 1.0;
      let targetEy = shocked ? 1.28 : down ? 0.92 : 1.0;
      let targetEz = shocked ? 1.45 : 1.0;
      if (billaSuperGlowPhase) {
        const popPulse =
          state.actionTimer < 1.2
            ? Math.min(1, state.actionTimer / 0.45)
            : Math.max(0, 1 - (state.actionTimer - 1.2) / 0.45);
        const throb = Math.sin(elapsed * 26) * 0.09 * popPulse;
        targetEx = 1.0 + 0.54 * popPulse + throb;
        targetEy = 1.0 + 0.58 * popPulse + throb;
        targetEz = 1.0 + 0.72 * popPulse;
      }
      rig.billaEyesGroup.scale.x = lerpAngle(rig.billaEyesGroup.scale.x, targetEx, alpha);
      rig.billaEyesGroup.scale.y = lerpAngle(rig.billaEyesGroup.scale.y, targetEy, alpha);
      rig.billaEyesGroup.scale.z = lerpAngle(rig.billaEyesGroup.scale.z, targetEz, alpha);
    }
    if (rig.billaEyeGlowMats.length > 0) {
      if (billaSuperGlowPhase) {
        const glowRamp =
          state.actionTimer < 1.2
            ? Math.min(1, state.actionTimer / 0.35)
            : Math.max(0, 1 - (state.actionTimer - 1.2) / 0.45);
        const glowIntensity = glowRamp * (1.85 + Math.sin(elapsed * 24) * 0.65);
        rig.billaEyeGlowMats[0].emissive.setHex(0xbef264);
        rig.billaEyeGlowMats[0].emissiveIntensity = glowIntensity * 0.85;
        if (rig.billaEyeGlowMats[1]) {
          rig.billaEyeGlowMats[1].emissive.setHex(0x84cc16);
          rig.billaEyeGlowMats[1].emissiveIntensity = glowIntensity * 1.45;
        }
      } else {
        for (const mat of rig.billaEyeGlowMats) {
          mat.emissiveIntensity = 0;
        }
      }
    }
    if (rig.billaPupils.length === 2) {
      const [leftPupil, rightPupil] = rig.billaPupils;
      const isAttacking =
        state.action === 'punch' ||
        state.action === 'kick' ||
        state.action === 'sweep' ||
        state.action === 'special' ||
        state.action === 'super';
      const pScale = billaSuperGlowPhase
        ? 1.32 + Math.sin(elapsed * 24) * 0.14
        : state.action === 'hit' || state.action === 'grabbed'
          ? 0.52
          : isAttacking
            ? 1.12
            : 1.0;
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
    } else if (state.action === 'super') {
      // VANS, ATTACK! (4.8s): Heroic mystical levitation -> dramatic forward arm point -> smooth touchdown!
      const t = state.actionTimer;
      const isPointing = t >= 0.85 && t < 4.25;
      const pointBlend = isPointing ? Math.min(1, (t - 0.85) / 0.25) : 0;
      const touchDownT = t > 4.15 ? Math.min(1, (t - 4.15) / 0.65) : 0;
      const airBlend = 1 - touchDownT;

      pelvisX = 0;
      pelvisY = basePelvisY + 0.06 * airBlend;
      pelvisRotX = -0.06 * airBlend;
      pelvisRotY = 0;
      torsoRotX = -0.14 * airBlend + 0.1 * pointBlend;
      torsoRotY = -0.22 * pointBlend;
      headRotX = 0.06 * airBlend;
      headRotY = 0.14 * pointBlend;

      // Legs suspended heroically in levitation pose while airborne, smoothly returning to guard on touchdown
      lHipX = (-0.55 + Math.sin(elapsed * 4.2) * 0.08) * airBlend + pose.lHipX * touchDownT;
      lKneeX = 0.82 * airBlend + pose.lKneeX * touchDownT;
      rHipX = (-0.18 - Math.sin(elapsed * 4.2) * 0.06) * airBlend + pose.rHipX * touchDownT;
      rKneeX = 0.42 * airBlend + pose.rKneeX * touchDownT;

      // Right arm rises while ascending, then snaps out straight forward pointing dramatically at opponent!
      rShX =
        (-1.15 * (1 - pointBlend) + -1.62 * pointBlend) * airBlend +
        pose.rShX * touchDownT;
      rShZ = (0.45 * (1 - pointBlend) + 0.08 * pointBlend) * airBlend + pose.rShZ * touchDownT;
      rElbX = (-0.75 * (1 - pointBlend) + -0.04 * pointBlend) * airBlend + pose.rElbX * touchDownT;

      // Left arm braced heroically low at hip/jhola strap so the pointing right arm silhouette pops clearly
      lShX = (0.28 * pointBlend - 0.35 * (1 - pointBlend)) * airBlend + pose.lShX * touchDownT;
      lShZ = -0.34 * airBlend + pose.lShZ * touchDownT;
      lElbX = -0.82 * airBlend + pose.lElbX * touchDownT;
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

    // Gamcha dramatic wind flutter while levitating during VANS, ATTACK! Super (restored cleanly otherwise)
    if (rig.gamchaFront && rig.gamchaBack) {
      if (state.action === 'super' && state.y > 0.05) {
        const windAmp = Math.min(1, state.y / 1.4);
        rig.gamchaFront.rotation.x = Math.sin(elapsed * 18) * 0.24 * windAmp - 0.18 * windAmp;
        rig.gamchaFront.rotation.z = -0.1 + Math.cos(elapsed * 15) * 0.16 * windAmp;
        rig.gamchaBack.rotation.x = Math.cos(elapsed * 19) * 0.28 * windAmp + 0.26 * windAmp;
        rig.gamchaBack.rotation.z = -0.08 + Math.sin(elapsed * 16) * 0.18 * windAmp;
      } else {
        rig.gamchaFront.rotation.x = 0;
        rig.gamchaFront.rotation.z = -0.1;
        rig.gamchaBack.rotation.x = 0;
        rig.gamchaBack.rotation.z = -0.08;
      }
    }

    // Stuffed Jhola Bag sway & bobbing colorful pamphlets/notebooks!
    const motionEnergy =
      state.action === 'walk' ||
      state.action === 'punch' ||
      state.action === 'kick' ||
      state.action === 'sweep' ||
      state.action === 'super'
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
    } else if (state.action === 'super') {
      // THE GREAT WALL DROP! (4.5s):
      // 0.00-0.38s: Reach up with right striped arm to grasp tilted blue top hat
      // 0.38-1.40s: Sweep blue top hat gracefully outward & bow politely forward (~35° / 0.62 rad)
      // 1.40-3.54s: Theatrical conductor pose holding hat out while lightning & giant brick wall crush opponent
      // 3.54-4.50s: Lift hat smoothly back onto head & settle into kung-fu guard stance
      const t = state.actionTimer;
      pelvisX = 0;
      pelvisRotY = 0;
      torsoRotZ = 0;
      headRotY = 0;
      lShY = 0;
      rShY = 0;
      lElbZ = 0;
      rElbZ = 0;
      lHipY = 0;
      rHipY = 0;
      lHipZ = 0;
      rHipZ = 0;

      if (t < 0.38) {
        const reach = Math.min(1, t / 0.36);
        pelvisY = basePelvisY + 0.02 * reach;
        torsoRotX = -0.06 * reach;
        torsoRotY = -0.1 * reach;
        rShX = -0.65 - 2.15 * reach;
        rShZ = 0.25 + 0.1 * reach;
        rElbX = -0.75 - 0.95 * reach;
        lShX = -0.35;
        lShZ = -0.45;
        lElbX = -1.1;
      } else if (t < 1.45) {
        const bowT = Math.min(1, (t - 0.38) / 0.48);
        const smoothBow = bowT * bowT * (3 - 2 * bowT);
        pelvisY = basePelvisY - 0.04 * smoothBow;
        pelvisRotX = 0.08 * smoothBow;
        torsoRotX = 0.58 * smoothBow; // Polite ~33-35° forward bow!
        torsoRotY = 0.22 * smoothBow;
        headRotX = -0.16 * smoothBow; // Cheeky grin angled up toward opponent/camera
        // Graceful outward & elevated sweep holding blue top hat proudly in camera view!
        rShX = -2.45 + 0.92 * smoothBow;
        rShZ = 0.35 + 1.18 * smoothBow;
        rElbX = -1.55 + 1.28 * smoothBow;
        // Left arm tucked politely behind waist/hip
        lShX = 0.42 * smoothBow - 0.35 * (1 - smoothBow);
        lShZ = -0.45;
        lElbX = -1.35;
        lHipX = -0.22;
        lKneeX = 0.28;
        rHipX = 0.26;
        rKneeX = 0.22;
      } else if (t < 3.54) {
        const standT = Math.min(1, (t - 1.45) / 0.35);
        const snapGesture = t >= 2.45 && t < 2.95 ? Math.sin(Math.min(1, (t - 2.45) / 0.35) * Math.PI) : 0;
        pelvisY = basePelvisY + 0.03 * standT;
        pelvisRotX = 0.12 * (1 - standT);
        torsoRotX = 0.62 * (1 - standT) - 0.08 * standT;
        torsoRotY = 0.12 - 0.24 * snapGesture;
        headRotX = -0.06;
        // Right arm proudly holds the hat out to his side
        rShX = -0.82;
        rShZ = 1.25;
        rElbX = -0.32;
        // Left arm gestures skyward for the lightning & wall drop!
        lShX = -1.65 - 0.65 * snapGesture;
        lShZ = -0.62;
        lElbX = -0.42 + 0.25 * snapGesture;
        lHipX = -0.24;
        lKneeX = 0.3;
        rHipX = 0.28;
        rKneeX = 0.24;
      } else if (t < 3.92) {
        // Lift blue top hat smoothly back up to place on top of his head
        const liftT = Math.min(1, (t - 3.54) / 0.3);
        const smoothLift = liftT * liftT * (3 - 2 * liftT);
        pelvisY = basePelvisY + 0.04 * smoothLift;
        torsoRotX = -0.05;
        torsoRotY = -0.08 * smoothLift;
        rShX = -0.82 - 1.98 * smoothLift;
        rShZ = 1.25 - 0.92 * smoothLift;
        rElbX = -0.32 - 1.38 * smoothLift;
        lShX = -0.55;
        lShZ = -0.45;
        lElbX = -1.15;
      } else {
        // Smooth settle back into kung-fu guard stance
        const settleT = Math.min(1, (t - 3.92) / 0.52);
        pelvisY = basePelvisY + (pose.pelvisY - basePelvisY) * settleT;
        torsoRotX = pose.torsoRotX * settleT;
        torsoRotY = pose.torsoRotY * settleT;
        rShX = -2.4 * (1 - settleT) + pose.rShX * settleT;
        rShZ = 0.34 * (1 - settleT) + pose.rShZ * settleT;
        rElbX = -1.4 * (1 - settleT) + pose.rElbX * settleT;
        lShX = -0.55 * (1 - settleT) + pose.lShX * settleT;
        lShZ = -0.45 * (1 - settleT) + pose.lShZ * settleT;
        lElbX = -1.15 * (1 - settleT) + pose.lElbX * settleT;
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

    // Playful Tilted Top Hat: temporarily re-parent to right hand during THE GREAT WALL DROP! bow,
    // and ALWAYS guarantee clean restoration to rig.torso outside that window.
    if (rig.hatPivot) {
      const holdingHatInHand =
        state.action === 'super' && state.actionTimer >= 0.38 && state.actionTimer < 3.78;
      if (holdingHatInHand) {
        if (rig.hatPivot.parent !== rig.rightElbow) {
          rig.rightElbow.add(rig.hatPivot);
        }
        rig.hatPivot.position.set(0.02, -0.36, 0.16);
        rig.hatPivot.rotation.set(0.55, 0.18, -0.25);
      } else {
        if (rig.hatPivot.parent !== rig.torso) {
          rig.torso.add(rig.hatPivot);
        }
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
        rig.hatPivot.position.set(-0.065, 1.215 + hatLift, -0.045);
        rig.hatPivot.rotation.x = -0.24 - hatBob * 0.85;
        rig.hatPivot.rotation.y = 0;
        rig.hatPivot.rotation.z =
          0.26 +
          Math.sin(elapsed * 3.8 + state.slot - 0.4) * 0.06 +
          (state.action === 'hit' || state.action === 'knockdown' ? 0.18 : 0);
      }
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
    } else if (state.action === 'super') {
      // GOL-GOL LADDOO BARRAGE! (5.0s):
      // 0.00-0.72s: Proudly hold up glowing golden Power Laddoo in right hand
      // 0.72-1.60s: Pop laddoo into mouth -> joyful chew bob -> fiery power-up flex!
      // 1.60-2.50s: Smooth heroic levitation upward to y=2.0 with golden aura rings & fluttering saree pallu
      // 2.50-4.35s: Rapid alternating two-hand palm thrusts firing 14 laddoos -> double-palm Mega Laddoo thrust!
      // 4.35-5.00s: Smooth float down into heavyweight kung-fu stance
      const t = state.actionTimer;
      pelvisX = 0;
      pelvisRotY = 0;
      torsoRotZ = 0;
      headRotY = 0;
      lShY = 0;
      rShY = 0;
      lElbZ = 0;
      rElbZ = 0;
      lHipY = 0;
      rHipY = 0;
      lHipZ = 0;
      rHipZ = 0;

      if (t < 0.72) {
        // Hold glowing Power Laddoo proudly upward in right palm
        const raise = Math.min(1, t / 0.28);
        pelvisY = basePelvisY + 0.02 * raise;
        torsoRotX = -0.08 * raise;
        torsoRotY = -0.16 * raise;
        headRotX = -0.12 * raise;
        rShX = -0.85 - 1.25 * raise;
        rShZ = 0.45 + 0.15 * raise;
        rElbX = -0.78;
        lShX = -0.35;
        lShZ = -0.58;
        lElbX = -1.35;
      } else if (t < 1.15) {
        // Bring Power Laddoo straight to mouth and tilt head back to gulp!
        const gulp = Math.min(1, (t - 0.72) / 0.34);
        pelvisY = basePelvisY + 0.03;
        torsoRotX = -0.16 * gulp;
        headRotX = -0.28 * gulp;
        rShX = -1.65;
        rShZ = 0.25 - 0.18 * gulp;
        rElbX = -1.1 - 0.92 * gulp;
        lShX = -0.3;
        lShZ = -0.58;
        lElbX = -1.35;
      } else if (t < 1.6) {
        // Chew with fierce power-up grin & ignite fiery golden-orange aura!
        const chew = Math.sin((t - 1.15) * 32);
        const flex = Math.min(1, (t - 1.2) / 0.3);
        pelvisY = basePelvisY - 0.05 * flex;
        torsoRotX = -0.18 * flex;
        headRotX = chew * 0.1 - 0.08 * flex;
        lShX = -0.75 - 0.52 * flex;
        lShZ = -0.82 - 0.22 * flex;
        lElbX = -1.52;
        rShX = -0.75 - 0.52 * flex;
        rShZ = 0.82 + 0.22 * flex;
        rElbX = -1.52;
        lHipX = -0.32;
        lKneeX = 0.42;
        rHipX = 0.34;
        rKneeX = 0.36;
      } else if (t < 2.5) {
        // Heroic levitation rise to y=2.0 with arms charging golden laddoo energy!
        const rise = Math.min(1, (t - 1.6) / 0.75);
        pelvisY = basePelvisY + 0.05;
        pelvisRotX = -0.06;
        torsoRotX = -0.14 + 0.1 * rise;
        headRotX = 0.06;
        lShX = -1.05 - 0.35 * rise;
        lShZ = -0.68;
        lElbX = -1.05;
        rShX = -1.05 - 0.35 * rise;
        rShZ = 0.68;
        rElbX = -1.05;
        lHipX = -0.48 + Math.sin(elapsed * 4.5) * 0.07;
        lKneeX = 0.72;
        rHipX = -0.16 - Math.sin(elapsed * 4.5) * 0.06;
        rKneeX = 0.42;
      } else if (t < 4.35) {
        // Rapid alternating two-hand forward thrusts firing 14 golden laddoos -> double-palm Mega Laddoo launch!
        jointAlpha = 1 - Math.exp(-30 * Math.max(dt, 0.008));
        const isMegaPush = t >= 3.98;
        const volleyOsc = Math.sin((t - 2.5) * 28);
        const rightThrust = isMegaPush ? 1 : Math.max(0, volleyOsc);
        const leftThrust = isMegaPush ? 1 : Math.max(0, -volleyOsc);
        pelvisY = basePelvisY + 0.04;
        pelvisRotX = 0.08;
        torsoRotX = isMegaPush ? 0.28 : 0.18;
        torsoRotY = isMegaPush ? 0 : volleyOsc * 0.28;
        headRotX = -0.06;
        rShX = -1.25 - rightThrust * 0.55;
        rShZ = isMegaPush ? 0.12 : 0.24 * (1 - rightThrust) + 0.08;
        rElbX = -1.35 + rightThrust * 1.28;
        lShX = -1.25 - leftThrust * 0.55;
        lShZ = isMegaPush ? -0.12 : -0.24 * (1 - leftThrust) - 0.08;
        lElbX = -1.35 + leftThrust * 1.28;
        lHipX = -0.42 + Math.sin(elapsed * 5.2) * 0.06;
        lKneeX = 0.68;
        rHipX = -0.18 - Math.sin(elapsed * 5.2) * 0.06;
        rKneeX = 0.44;
      } else {
        // Smooth touchdown back into heavyweight kung-fu guard stance
        const landT = Math.min(1, (t - 4.35) / 0.6);
        const air = 1 - landT;
        pelvisY = (basePelvisY + 0.04) * air + pose.pelvisY * landT;
        pelvisRotX = 0.04 * air + pose.pelvisRotX * landT;
        torsoRotX = 0.12 * air + pose.torsoRotX * landT;
        torsoRotY = pose.torsoRotY * landT;
        rShX = -1.45 * air + pose.rShX * landT;
        rShZ = 0.22 * air + pose.rShZ * landT;
        rElbX = -0.45 * air + pose.rElbX * landT;
        lShX = -1.45 * air + pose.lShX * landT;
        lShZ = -0.22 * air + pose.lShZ * landT;
        lElbX = -0.45 * air + pose.lElbX * landT;
        lHipX = -0.38 * air + pose.lHipX * landT;
        lKneeX = 0.62 * air + pose.lKneeX * landT;
        rHipX = -0.16 * air + pose.rHipX * landT;
        rKneeX = 0.42 * air + pose.rKneeX * landT;
      }
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

    // Dramatic saree pallu wind flutter while Mausi levitates during GOL-GOL LADDOO BARRAGE!
    if (rig.mausiPalluGroup) {
      if (state.action === 'super' && state.y > 0.05) {
        const windAmp = Math.min(1, state.y / 1.4);
        rig.mausiPalluGroup.rotation.x = Math.sin(elapsed * 18) * 0.18 * windAmp - 0.12 * windAmp;
        rig.mausiPalluGroup.rotation.z = Math.cos(elapsed * 15) * 0.16 * windAmp + 0.08 * windAmp;
      } else {
        rig.mausiPalluGroup.rotation.x = 0;
        rig.mausiPalluGroup.rotation.z = 0;
      }
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
    lElbZ = 0;
    rShX = -1.6;
    rShZ = 0.95;
    rElbX = -0.2;
    rElbZ = 0;
    lHipX = 0.1;
    lHipY = 0;
    rHipX = -0.1;
    rHipY = 0;
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
  rig.leftElbow.rotation.z = lerpAngle(rig.leftElbow.rotation.z, lElbZ, jointAlpha);

  rig.rightShoulder.rotation.x = lerpAngle(rig.rightShoulder.rotation.x, rShX, jointAlpha);
  rig.rightShoulder.rotation.y = lerpAngle(rig.rightShoulder.rotation.y, rShY, jointAlpha);
  rig.rightShoulder.rotation.z = lerpAngle(rig.rightShoulder.rotation.z, rShZ, jointAlpha);
  rig.rightElbow.rotation.x = lerpAngle(rig.rightElbow.rotation.x, rElbX, jointAlpha);
  rig.rightElbow.rotation.z = lerpAngle(rig.rightElbow.rotation.z, rElbZ, jointAlpha);

  rig.leftHip.rotation.x = lerpAngle(rig.leftHip.rotation.x, lHipX, jointAlpha);
  rig.leftHip.rotation.y = lerpAngle(rig.leftHip.rotation.y, lHipY, jointAlpha);
  rig.leftHip.rotation.z = lerpAngle(rig.leftHip.rotation.z, lHipZ, jointAlpha);
  rig.leftKnee.rotation.x = lerpAngle(rig.leftKnee.rotation.x, lKneeX, jointAlpha);

  rig.rightHip.rotation.x = lerpAngle(rig.rightHip.rotation.x, rHipX, jointAlpha);
  rig.rightHip.rotation.y = lerpAngle(rig.rightHip.rotation.y, rHipY, jointAlpha);
  rig.rightHip.rotation.z = lerpAngle(rig.rightHip.rotation.z, rHipZ, jointAlpha);
  rig.rightKnee.rotation.x = lerpAngle(rig.rightKnee.rotation.x, rKneeX, jointAlpha);
}
