import * as THREE from 'three';
import type { FighterId, FighterState } from '../types';
import type { DynamicFace } from './faceCanvas';
import { computeCombatPose } from './kinematics';
import { computePhotoHeadLocalYaw, isPhotoFaceFighter } from './photoFaceLoader';

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
  cassockPanels: {
    frontLeft: THREE.Group;
    frontRight: THREE.Group;
    back: THREE.Group;
    leftSide: THREE.Group;
    rightSide: THREE.Group;
  } | null;
  shieldAura: THREE.Mesh;
  superAura: THREE.Mesh;
  face: DynamicFace;
  flashMaterials: THREE.MeshStandardMaterial[];
  isEggBody: boolean;
  isDisposed: boolean;
  dispose: () => void;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;

export function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedShadowTex) return sharedShadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.76)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.44)');
  grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.14)');
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

  // Soft grounded dark contact shadow disc directly beneath fighter feet
  const shadowGeo = new THREE.CircleGeometry(0.76, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.84,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
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
    cassockPanels: null,
    shieldAura,
    superAura,
    face,
    flashMaterials: [],
    isEggBody,
    isDisposed: false,
    dispose() {
      rig.isDisposed = true;
      face.dispose();
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (!m.userData.sharedGeometry) {
            m.geometry.dispose();
          }
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
  const baseShadowScale = state.id === 'mausi' ? 1.24 : 1.0;
  const heightScale = Math.max(0.42, 1 - state.y * 0.16);
  const shadowScale = baseShadowScale * heightScale;
  rig.contactShadow.scale.set(shadowScale, shadowScale, 1);
  (rig.contactShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
    0.16,
    0.84 - state.y * 0.16,
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
    const baseEmissive =
      typeof mat.userData.baseEmissiveIntensity === 'number'
        ? mat.userData.baseEmissiveIntensity
        : 0;
    mat.emissiveIntensity = flashVal > 0 ? Math.max(flashVal, baseEmissive) : baseEmissive;
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
      state.id !== 'mausi' &&
      state.id !== 'father' &&
      state.id !== 'samyak' &&
      state.id !== 'adi') ||
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
    state.id === 'billa'
      ? 0.68
      : state.id === 'mausi'
        ? 0.88
        : state.id === 'father'
          ? 1.06
          : state.id === 'samyak'
            ? 1.07
            : state.id === 'adi'
              ? 1.04
              : rig.isEggBody
                ? 0.68
                : 0.92;
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
  } else if (state.id === 'father') {
    if (state.action === 'special') {
      // DIARY NOTE: Stern upright windup -> authoritative forward pointing snap launching spinning warning slip!
      const isWindup = atkProgress < 0.25;
      const wind = isWindup ? atkProgress / 0.25 : 1;
      const snap = isWindup ? 0 : Math.min(1, (atkProgress - 0.25) / 0.3);
      const settle = atkProgress > 0.68 ? (atkProgress - 0.68) / 0.32 : 0;
      const thrust = snap * (1 - settle * 0.35);

      pelvisX = 0.14 * thrust;
      pelvisY = basePelvisY - 0.02 * thrust;
      pelvisRotY = 0;
      torsoRotX = isWindup ? -0.06 * wind : 0.14 * thrust;
      torsoRotY = isWindup ? 0.35 * wind : -0.42 * thrust;
      headRotX = isWindup ? 0.04 : 0.02;
      headRotY = isWindup ? -0.22 * wind : 0.32 * thrust;
      // Right arm snaps cleanly straight forward in stern Principal pointing-flick pose
      rShX = isWindup ? -0.95 - 0.45 * wind : -1.56 * thrust - 0.55 * (1 - thrust);
      rShZ = isWindup ? 0.35 : 0.06;
      rElbX = isWindup ? -1.35 : -0.08;
      // Left arm poised firmly across chest/waist holding composure
      lShX = -0.35;
      lShZ = -0.25;
      lElbX = -1.15;
    } else if (state.action === 'super') {
      // RUSTICATION ORDER! (5.2s):
      // 0.0–1.5s: Dignified hovering levitation (calm raised forearms, composed upright posture)
      // 1.5–2.8s: Commanding arms-out summon as 14 "RUSTICATE" papers orbit around him
      // 2.8–4.65s: Both palms thrust forward & downward launching the homing paper barrage + Master Notice slam
      // 4.65–5.2s: Smooth dignified descent back to fighting stance
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

      if (t < 1.5) {
        const rise = Math.min(1, t / 1.25);
        pelvisY = basePelvisY + 0.02;
        pelvisRotX = -0.04 * rise;
        torsoRotX = -0.08 * rise;
        headRotX = 0.06;
        // Dignified calm levitation — arms smoothly raising slightly outward
        lShX = -0.45 - 0.35 * rise;
        lShZ = -0.28 - 0.32 * rise;
        lElbX = -0.95 + 0.25 * rise;
        rShX = -0.45 - 0.35 * rise;
        rShZ = 0.28 + 0.32 * rise;
        rElbX = -0.95 + 0.25 * rise;
        lHipX = -0.14 + Math.sin(elapsed * 3.2) * 0.04;
        lKneeX = 0.22;
        rHipX = -0.06 - Math.sin(elapsed * 3.2) * 0.04;
        rKneeX = 0.14;
      } else if (t < 2.8) {
        // Orbiting red "RUSTICATE" papers vortex — commanding open-palm summon
        const pulse = Math.sin((t - 1.5) * 4.5);
        pelvisY = basePelvisY + 0.02;
        pelvisRotX = -0.05;
        torsoRotX = -0.12;
        headRotX = 0.04;
        lShX = -1.15 + pulse * 0.08;
        lShZ = -0.78;
        lElbX = -0.42;
        rShX = -1.15 - pulse * 0.08;
        rShZ = 0.78;
        rElbX = -0.42;
        lHipX = -0.18 + Math.sin(elapsed * 3.6) * 0.04;
        lKneeX = 0.26;
        rHipX = -0.08 - Math.sin(elapsed * 3.6) * 0.04;
        rKneeX = 0.16;
      } else if (t < 4.65) {
        // Dual-palm forward/downward thrust launching barrage -> authoritative downward Master Stamp slam at 4.35s!
        jointAlpha = 1 - Math.exp(-24 * Math.max(dt, 0.008));
        const isMasterSlam = t >= 4.25;
        const volley = Math.sin((t - 2.8) * 16) * 0.12;
        pelvisY = basePelvisY + 0.02;
        pelvisRotX = 0.06;
        torsoRotX = isMasterSlam ? 0.22 : 0.14;
        headRotX = 0.12;
        if (isMasterSlam) {
          const slamDrop = Math.min(1, (t - 4.25) / 0.25);
          lShX = -1.85 + slamDrop * 0.85;
          lShZ = -0.18;
          lElbX = -0.18;
          rShX = -1.85 + slamDrop * 0.85;
          rShZ = 0.18;
          rElbX = -0.18;
        } else {
          lShX = -1.32 + volley;
          lShZ = -0.22;
          lElbX = -0.22;
          rShX = -1.32 - volley;
          rShZ = 0.22;
          rElbX = -0.22;
        }
        lHipX = -0.22;
        lKneeX = 0.3;
        rHipX = -0.1;
        rKneeX = 0.18;
      } else {
        // Smooth descent back to composed fighting guard
        const landT = Math.min(1, (t - 4.65) / 0.55);
        const air = 1 - landT;
        pelvisY = (basePelvisY + 0.02) * air + pose.pelvisY * landT;
        pelvisRotX = 0.02 * air + pose.pelvisRotX * landT;
        torsoRotX = 0.06 * air + pose.torsoRotX * landT;
        lShX = -0.65 * air + pose.lShX * landT;
        lShZ = -0.24 * air + pose.lShZ * landT;
        lElbX = -0.85 * air + pose.lElbX * landT;
        rShX = -0.65 * air + pose.rShX * landT;
        rShZ = 0.24 * air + pose.rShZ * landT;
        rElbX = -0.85 * air + pose.rElbX * landT;
        lHipX = -0.14 * air + pose.lHipX * landT;
        lKneeX = 0.2 * air + pose.lKneeX * landT;
        rHipX = -0.06 * air + pose.rHipX * landT;
        rKneeX = 0.12 * air + pose.rKneeX * landT;
      }
    } else if (state.action === 'victory') {
      // Dignified, composed Principal victory stance (hands calmly clasped / stern upright nod)
      pelvisY = basePelvisY + Math.sin(elapsed * 2.2) * 0.012;
      torsoRotX = -0.05;
      torsoRotY = 0;
      headRotX = 0.04 + Math.sin(elapsed * 2.2) * 0.03;
      lShX = -0.45;
      lShZ = -0.18;
      lElbX = -1.05;
      rShX = -0.95;
      rShZ = 0.24;
      rElbX = -0.65;
    }
  } else if (state.id === 'samyak') {
    if (state.action === 'special') {
      // LAXMIKANT SLAM: Muscular arm windup -> explosive torso-twisting hurl of thick red Indian Polity book!
      const isWindup = atkProgress < 0.27;
      const wind = isWindup ? atkProgress / 0.27 : 1;
      const snap = isWindup ? 0 : Math.min(1, (atkProgress - 0.27) / 0.28);
      const settle = atkProgress > 0.68 ? (atkProgress - 0.68) / 0.32 : 0;
      const hurl = snap * (1 - settle * 0.35);

      pelvisX = 0.18 * hurl;
      pelvisY = basePelvisY - 0.04 * hurl;
      pelvisRotY = 0;
      torsoRotX = isWindup ? -0.12 * wind : 0.18 * hurl;
      torsoRotY = isWindup ? 0.56 * wind : -0.52 * hurl;
      headRotX = 0.02;
      headRotY = isWindup ? -0.34 * wind : 0.38 * hurl;
      rShX = isWindup ? -1.45 * wind - 0.4 : -1.62 * hurl - 0.45 * (1 - hurl);
      rShZ = isWindup ? 0.62 * wind : 0.14;
      rElbX = isWindup ? -1.35 * wind : -0.1;
      lShX = -0.45;
      lShZ = -0.42;
      lElbX = -1.2;
    } else if (state.action === 'super') {
      // MISSION IAS: BEAST MODE! (4.8s):
      // 0.0-1.8s: Fierce Double-Bicep Bodybuilder Flex (arms out, elbows curled tight, chest puffed!)
      // 1.8-3.5s: Wide power stance launching orbital UPSC books + heavy iron gym dumbbells
      // 3.5-4.10s: Explosive superhero leap -> meteoric fist-first ground-slam dive ("IAS · AIR 1")
      // 4.10-4.8s: Smooth rise from superhero crouch -> casual one-hand black sunglasses adjust -> guard!
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

      if (t < 1.8) {
        // Phase 1: Iconic Front Double-Bicep Bodybuilder Flex angled heroically 3/4 toward camera!
        const flexIn = Math.min(1, t / 0.28);
        const pump = Math.sin(t * 7.5) * 0.06;
        pelvisY = basePelvisY - 0.03 * flexIn;
        pelvisRotX = -0.04 * flexIn;
        pelvisRotY = -0.58 * state.facing * flexIn;
        torsoRotX = -0.14 * flexIn;
        torsoRotY = -0.18 * state.facing * flexIn;
        headRotX = -0.04;
        headRotY = 0.08 * state.facing * flexIn;

        // Abduct upper arms wide horizontally & curl elbows UPWARD toward head (Arnold double-bicep!)
        lShX = -0.12 * flexIn;
        lShY = 0;
        lShZ = (-1.62 + pump) * flexIn;
        lElbX = -0.18 * flexIn;
        lElbZ = (-1.88 - pump) * flexIn;

        rShX = -0.12 * flexIn;
        rShY = 0;
        rShZ = (1.62 - pump) * flexIn;
        rElbX = -0.18 * flexIn;
        rElbZ = (1.88 + pump) * flexIn;

        lHipX = -0.14 * flexIn;
        lHipZ = -0.18 * flexIn;
        lKneeX = 0.24 * flexIn;
        rHipX = 0.08 * flexIn;
        rHipZ = 0.18 * flexIn;
        rKneeX = 0.18 * flexIn;
      } else if (t < 3.5) {
        // Phase 2: Summon orbital UPSC books & dumbbells (1.8-2.22s) -> explosive homing volley (2.22-3.5s)
        jointAlpha = 1 - Math.exp(-24 * Math.max(dt, 0.008));
        const isVolley = t >= 2.22;
        const volleyWave = Math.sin((t - 2.22) * 18) * 0.16;
        pelvisY = basePelvisY - 0.04;
        pelvisRotX = 0.05;
        torsoRotX = isVolley ? 0.14 : -0.1;
        torsoRotY = isVolley ? Math.sin((t - 2.22) * 12) * 0.18 : 0;
        headRotX = 0.04;

        if (!isVolley) {
          lShX = -0.95;
          lShZ = -0.85;
          lElbX = -0.55;
          rShX = -0.95;
          rShZ = 0.85;
          rElbX = -0.55;
        } else {
          lShX = -1.36 + volleyWave;
          lShZ = -0.24;
          lElbX = -0.24;
          rShX = -1.36 - volleyWave;
          rShZ = 0.24;
          rElbX = -0.24;
        }
        lHipX = -0.2;
        lKneeX = 0.34;
        rHipX = 0.16;
        rKneeX = 0.22;
      } else if (t < 4.1) {
        // Phase 3a: Explosive superhero leap -> meteoric right-fist ground-slam dive!
        jointAlpha = 1 - Math.exp(-28 * Math.max(dt, 0.008));
        const isDive = t >= 3.86;
        pelvisY = basePelvisY - 0.02;
        pelvisRotX = isDive ? 0.32 : -0.14;
        torsoRotX = isDive ? 0.38 : -0.18;
        torsoRotY = isDive ? -0.25 : 0.22;
        headRotX = isDive ? 0.24 : -0.12;
        rShX = isDive ? -1.45 : -2.75;
        rShZ = isDive ? 0.15 : 0.35;
        rElbX = isDive ? -0.12 : -0.85;
        lShX = isDive ? 0.45 : -0.85;
        lShZ = -0.55;
        lElbX = -1.05;
        lHipX = isDive ? -0.45 : -0.62;
        lKneeX = isDive ? 0.65 : 1.05;
        rHipX = isDive ? 0.25 : -0.22;
        rKneeX = isDive ? 0.35 : 0.62;
      } else if (t < 4.35) {
        // Phase 3b: Iconic 3-point superhero ground-slam landing crouch!
        jointAlpha = 1 - Math.exp(-26 * Math.max(dt, 0.008));
        const riseT = Math.min(1, (t - 4.1) / 0.25);
        pelvisY = basePelvisY - 0.34 * (1 - riseT * 0.65);
        pelvisRotX = 0.28 * (1 - riseT * 0.6);
        torsoRotX = 0.46 * (1 - riseT * 0.65);
        headRotX = -0.22 * (1 - riseT * 0.6);
        rShX = -1.35 * (1 - riseT * 0.45);
        rShZ = 0.18;
        rElbX = -0.12 - riseT * 0.4;
        lShX = 0.45 * (1 - riseT);
        lShZ = -0.58 * (1 - riseT * 0.5);
        lElbX = -0.85;
        lHipX = -0.92 * (1 - riseT * 0.6);
        lKneeX = 1.38 * (1 - riseT * 0.6);
        rHipX = -0.58 * (1 - riseT * 0.6);
        rKneeX = 1.05 * (1 - riseT * 0.6);
      } else {
        // Phase 3c (4.35-4.8s): Cool upright rise & casual one-hand black sunglasses adjust!
        const adjT = Math.min(1, (t - 4.35) / 0.24);
        const settleT = t > 4.64 ? (t - 4.64) / 0.16 : 0;
        const hold = adjT * (1 - settleT);
        pelvisY = basePelvisY;
        pelvisRotX = 0;
        torsoRotX = -0.05 * hold;
        torsoRotY = -0.14 * hold;
        headRotX = -0.04 * hold;
        headRotY = 0.16 * hold;
        rShX = -1.28 * hold + pose.rShX * (1 - hold);
        rShZ = 0.32 * hold + pose.rShZ * (1 - hold);
        rElbX = -1.78 * hold + pose.rElbX * (1 - hold);
        lShX = -0.24 * hold + pose.lShX * (1 - hold);
        lShZ = -0.22 * hold + pose.lShZ * (1 - hold);
        lElbX = -0.58 * hold + pose.lElbX * (1 - hold);
        lHipX = pose.lHipX;
        lKneeX = pose.lKneeX;
        rHipX = pose.rHipX;
        rKneeX = pose.rKneeX;
      }
    } else if (state.action === 'victory') {
      // Proud bodybuilder front double-bicep victory flex facing 3/4 toward camera!
      const pump = Math.sin(elapsed * 3.8) * 0.05;
      pelvisY = basePelvisY - 0.02 + Math.sin(elapsed * 2.4) * 0.014;
      pelvisRotY = -0.58 * state.facing;
      torsoRotX = -0.12;
      torsoRotY = -0.16 * state.facing;
      headRotX = -0.04;
      headRotY = 0.08 * state.facing;
      lShX = -0.12;
      lShY = 0;
      lShZ = -1.6 + pump;
      lElbX = -0.18;
      lElbZ = -1.86 - pump;
      rShX = -0.12;
      rShY = 0;
      rShZ = 1.6 - pump;
      rElbX = -0.18;
      rElbZ = 1.86 + pump;
    }
  } else if (state.id === 'adi') {
    if (state.action === 'special') {
      // NOTEBOOK SMASH: Snappy back-bench collar twist -> fast frisbee-style spiral notebook hurl!
      const isWindup = atkProgress < 0.25;
      const wind = isWindup ? atkProgress / 0.25 : 1;
      const snap = isWindup ? 0 : Math.min(1, (atkProgress - 0.25) / 0.28);
      const settle = atkProgress > 0.68 ? (atkProgress - 0.68) / 0.32 : 0;
      const hurl = snap * (1 - settle * 0.35);

      pelvisX = 0.16 * hurl;
      pelvisY = basePelvisY - 0.04 * hurl;
      torsoRotX = isWindup ? -0.1 * wind : 0.16 * hurl;
      torsoRotY = isWindup ? 0.58 * wind : -0.54 * hurl;
      headRotY = isWindup ? -0.32 * wind : 0.36 * hurl;
      rShX = isWindup ? -1.35 * wind - 0.35 : -1.58 * hurl - 0.4 * (1 - hurl);
      rShZ = isWindup ? 0.58 * wind : 0.18;
      rElbX = isWindup ? -1.25 * wind : -0.12;
      lShX = -0.42;
      lShZ = -0.36;
      lElbX = -1.1;
    } else if (state.action === 'super') {
      // ADI LAST-BENCH STRIKE (4.6s):
      // 0.0-1.1s: Cool open-plaid collar pop & knuckle crack angled 3/4 toward camera
      // 1.1-3.0s: Snappy rapid martial-arts pointing/hurling barrage stance
      // 3.0-3.62s: Acrobatic leaping spinning last-bench flying kick!
      // 3.62-4.6s: Smooth hero landing & confident relaxed swag pose
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

      if (t < 1.1) {
        const p = Math.min(1, t / 0.26);
        const pulse = Math.sin(t * 9) * 0.05;
        pelvisY = basePelvisY - 0.02 * p;
        pelvisRotY = -0.42 * state.facing * p;
        torsoRotX = -0.08 * p;
        torsoRotY = -0.15 * state.facing * p;
        headRotX = -0.04;
        headRotY = 0.12 * state.facing * p;
        // Both hands pop open plaid shirt lapels outward!
        lShX = (-0.82 + pulse) * p;
        lShZ = -0.45 * p;
        lElbX = -1.45 * p;
        rShX = (-0.82 - pulse) * p;
        rShZ = 0.45 * p;
        rElbX = -1.45 * p;
        lHipX = -0.12 * p;
        lKneeX = 0.2 * p;
        rHipX = 0.1 * p;
        rKneeX = 0.16 * p;
      } else if (t < 3.0) {
        jointAlpha = 1 - Math.exp(-26 * Math.max(dt, 0.008));
        const wave = Math.sin((t - 1.1) * 19);
        pelvisY = basePelvisY - 0.05;
        pelvisRotX = 0.06;
        torsoRotX = 0.14;
        torsoRotY = wave * 0.34;
        headRotY = -wave * 0.18;
        lShX = -1.28 + wave * 0.42;
        lShZ = -0.26;
        lElbX = -0.35 - Math.max(0, -wave) * 0.65;
        rShX = -1.28 - wave * 0.42;
        rShZ = 0.26;
        rElbX = -0.35 - Math.max(0, wave) * 0.65;
        lHipX = -0.22;
        lKneeX = 0.36;
        rHipX = 0.18;
        rKneeX = 0.24;
      } else if (t < 3.62) {
        // Acrobatic airborne Last-Bench flying strike!
        jointAlpha = 1 - Math.exp(-28 * Math.max(dt, 0.008));
        const leapP = (t - 3.0) / 0.62;
        pelvisY = basePelvisY;
        pelvisRotX = -0.16 + leapP * 0.36;
        torsoRotX = 0.24;
        torsoRotY = -0.42;
        headRotY = 0.34;
        rShX = -1.55;
        rShZ = 0.38;
        rElbX = -0.25;
        lShX = 0.35;
        lShZ = -0.62;
        lElbX = -0.95;
        // Extended flying front-kick right leg + tucked left knee
        rHipX = -1.48;
        rKneeX = 0.12;
        lHipX = -0.78;
        lKneeX = 1.42;
      } else {
        // Crisp cool follow-through landing & relaxed collar brush
        const settle = Math.min(1, (t - 3.62) / 0.45);
        pelvisY = basePelvisY - 0.18 * (1 - settle);
        torsoRotX = 0.18 * (1 - settle) - 0.05 * settle;
        torsoRotY = -0.2 * settle;
        headRotY = 0.15 * settle;
        rShX = -0.95 * settle - 0.4 * (1 - settle);
        rShZ = 0.35;
        rElbX = -1.45 * settle - 0.6 * (1 - settle);
        lShX = -0.32;
        lShZ = -0.22;
        lElbX = -0.65;
        lHipX = -0.25 * (1 - settle);
        lKneeX = 0.45 * (1 - settle);
        rHipX = 0.15 * (1 - settle);
        rKneeX = 0.25 * (1 - settle);
      }
    } else if (state.action === 'victory') {
      // Confident relaxed Last-Bench victory pose — one fist raised, other hand on plaid lapel!
      const bob = Math.sin(elapsed * 3.2) * 0.025;
      pelvisY = basePelvisY + bob;
      pelvisRotY = -0.45 * state.facing;
      torsoRotX = -0.06;
      torsoRotY = -0.12 * state.facing;
      headRotY = 0.1 * state.facing;
      rShX = -2.45 + Math.sin(elapsed * 4) * 0.08;
      rShZ = 0.32;
      rElbX = -0.32;
      lShX = -0.72;
      lShZ = -0.32;
      lElbX = -1.42;
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

  // Keep 3D GLB & photo-face heads angled ~25-35 deg toward front camera (+Z) for crisp 2.5D readability
  if (
    (isPhotoFaceFighter(state.id) || state.id === 'adi') &&
    state.squashedTimer <= 0 &&
    state.action !== 'knockdown' &&
    state.action !== 'ko'
  ) {
    headRotY = computePhotoHeadLocalYaw(
      state.facing,
      targetYaw,
      pelvisRotY,
      torsoRotY,
      headRotY,
    );
  }

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

  // Articulated pleated lower cassock panels for Father Roy Dolphus:
  // smoothly follow leg kicks/sweeps with zero ugly mesh clipping, plus gentle air ripple while levitating!
  if (rig.cassockPanels) {
    const panels = rig.cassockPanels;
    const airRipple =
      state.action === 'super' && state.y > 0.05
        ? Math.min(1, state.y / 1.6) * 0.14
        : 0;
    const rippleA = Math.sin(elapsed * 11.5) * airRipple;
    const rippleB = Math.cos(elapsed * 9.8) * airRipple;

    const lFront = Math.min(0, rig.leftHip.rotation.x) * 0.9 - 0.05 + rippleA;
    const rFront = Math.min(0, rig.rightHip.rotation.x) * 0.9 - 0.05 - rippleA;
    const backFlare =
      Math.max(0, rig.leftHip.rotation.x, rig.rightHip.rotation.x) * 0.88 + 0.06 + rippleB;
    const leftSideFlare =
      Math.min(0, rig.leftHip.rotation.z) * 0.85 - 0.04 - Math.abs(rippleA) * 0.7;
    const rightSideFlare =
      Math.max(0, rig.rightHip.rotation.z) * 0.85 + 0.04 + Math.abs(rippleB) * 0.7;

    panels.frontLeft.rotation.x = lerpAngle(panels.frontLeft.rotation.x, lFront, jointAlpha);
    panels.frontRight.rotation.x = lerpAngle(panels.frontRight.rotation.x, rFront, jointAlpha);
    panels.back.rotation.x = lerpAngle(panels.back.rotation.x, backFlare, jointAlpha);
    panels.leftSide.rotation.z = lerpAngle(panels.leftSide.rotation.z, leftSideFlare, jointAlpha);
    panels.rightSide.rotation.z = lerpAngle(panels.rightSide.rotation.z, rightSideFlare, jointAlpha);
  }
}
