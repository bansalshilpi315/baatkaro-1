export const FIGHT_CAMERA_Z = 9.2;
// Slightly elevated 2.5D arcade fighting angle so floor depth, shadows, sweeps & knockdowns read clearly
export const FIGHT_CAMERA_Y = 2.82;
export const FIGHT_LOOK_Y = 1.32;
export const CAMERA_PAN_MIN_X = -6.5;
export const CAMERA_PAN_MAX_X = 6.5;

export interface FixedZoomCameraTarget {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

export function clampCameraPanX(x: number): number {
  return Math.max(CAMERA_PAN_MIN_X, Math.min(CAMERA_PAN_MAX_X, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Pure 2.5D fixed-zoom horizontal panning camera solver for active combat.
 * Tracks ONLY the horizontal midpoint between P1 and CPU, clamped to
 * [CAMERA_PAN_MIN_X, CAMERA_PAN_MAX_X]. Camera depth (z) and height (y)
 * remain strictly constant so fighter screen scale never zooms in or out.
 */
export function computeFixedZoomCameraTarget(
  p1X: number,
  p2X: number,
): FixedZoomCameraTarget {
  const clampedX = clampCameraPanX((p1X + p2X) * 0.5);
  return {
    x: clampedX,
    y: FIGHT_CAMERA_Y,
    z: FIGHT_CAMERA_Z,
    lookX: clampedX,
    lookY: FIGHT_LOOK_Y,
    lookZ: 0,
  };
}

/**
 * Pre-Fight Round 1 Intro Sweep (8.85s: 4.0s P1 + 4.0s CPU + 0.85s ROUND 1):
 * - 0.00s..4.00s: 3/4 over-the-shoulder view near P1 looking across at CPU
 * - 4.00s..8.00s: Smooth swing to 3/4 over-the-shoulder view near CPU looking back at P1
 * - 8.00s..8.85s: Smooth glide back to standard elevated 2.5D fighting angle as "ROUND 1" slams in
 * For Round 2 / Final Round, smoothly holds the standard fighting angle with a crisp intro glide.
 */
export function computeIntroCameraTarget(
  roundNumber: number,
  introElapsed: number,
  introDuration: number,
  p1X: number,
  p2X: number,
): FixedZoomCameraTarget {
  const fightTarget = computeFixedZoomCameraTarget(p1X, p2X);

  if (roundNumber > 1) {
    const glide = smoothstep(introElapsed / Math.max(0.4, introDuration * 0.6));
    return {
      x: lerp(fightTarget.x, fightTarget.x, glide),
      y: lerp(FIGHT_CAMERA_Y + 0.55, FIGHT_CAMERA_Y, glide),
      z: lerp(FIGHT_CAMERA_Z + 0.85, FIGHT_CAMERA_Z, glide),
      lookX: fightTarget.lookX,
      lookY: FIGHT_LOOK_Y,
      lookZ: 0,
    };
  }

  const p1End = introDuration >= 4.0 ? 2.0 : 0.95;
  const p2End = introDuration >= 4.0 ? 4.0 : 1.85;
  const panDuration = introDuration >= 4.0 ? 0.42 : 0.42;

  // Phase 1 (0.0s - 2.0s): 3/4 over-the-shoulder behind/beside P1 looking across at CPU
  const p1Shoulder: FixedZoomCameraTarget = {
    x: p1X - 1.85,
    y: 2.02,
    z: 4.35,
    lookX: p2X - 0.65,
    lookY: 1.44,
    lookZ: -0.25,
  };

  // Phase 2 (2.0s - 4.0s): 3/4 over-the-shoulder behind/beside CPU looking across at P1
  const p2Shoulder: FixedZoomCameraTarget = {
    x: p2X + 1.85,
    y: 2.02,
    z: 4.35,
    lookX: p1X + 0.65,
    lookY: 1.44,
    lookZ: -0.25,
  };

  if (introElapsed < p1End) {
    // Subtle push-in drift during P1 2.0s taunt
    const drift = smoothstep(introElapsed / p1End);
    return {
      x: p1Shoulder.x + drift * 0.22,
      y: p1Shoulder.y,
      z: p1Shoulder.z - drift * 0.25,
      lookX: p1Shoulder.lookX,
      lookY: p1Shoulder.lookY,
      lookZ: p1Shoulder.lookZ,
    };
  }

  if (introElapsed < p2End) {
    const t = smoothstep((introElapsed - p1End) / panDuration);
    return {
      x: lerp(p1Shoulder.x + 0.22, p2Shoulder.x, t),
      y: lerp(p1Shoulder.y, p2Shoulder.y, t),
      z: lerp(p1Shoulder.z - 0.25, p2Shoulder.z, t) + Math.sin(t * Math.PI) * 1.15,
      lookX: lerp(p1Shoulder.lookX, p2Shoulder.lookX, t),
      lookY: lerp(p1Shoulder.lookY, p2Shoulder.lookY, t),
      lookZ: lerp(p1Shoulder.lookZ, p2Shoulder.lookZ, t),
    };
  }

  const returnT = smoothstep((introElapsed - p2End) / Math.max(0.35, introDuration - p2End));
  return {
    x: lerp(p2Shoulder.x, fightTarget.x, returnT),
    y: lerp(p2Shoulder.y, fightTarget.y, returnT),
    z: lerp(p2Shoulder.z, fightTarget.z, returnT),
    lookX: lerp(p2Shoulder.lookX, fightTarget.lookX, returnT),
    lookY: lerp(p2Shoulder.lookY, fightTarget.lookY, returnT),
    lookZ: lerp(p2Shoulder.lookZ, fightTarget.lookZ, returnT),
  };
}

export type SuperCameraKind =
  | 'sheru'
  | 'billa'
  | 'neta'
  | 'anda'
  | 'mausi'
  | 'father'
  | 'samyak'
  | 'generic';

/**
 * Super Power Cutscene Camera:
 * - Startup phase: Dramatic low-angle close-up on the attacker
 * - Main attack & finisher phase: Smooth high-angle 3D perspective orbit around the action
 * - Ending glide: Smoothly returns to the standard 2.5D fixed-zoom fighting camera
 */
export function computeSuperCameraTarget(
  elapsed: number,
  duration: number,
  attackerX: number,
  attackerFacing: 1 | -1,
  defenderX: number,
  isSheruSuper: boolean,
  superKind?: SuperCameraKind,
  attackerY = 0,
): FixedZoomCameraTarget {
  const kind: SuperCameraKind = superKind ?? (isSheruSuper ? 'sheru' : 'generic');
  const fightTarget = computeFixedZoomCameraTarget(attackerX, defenderX);

  // BLUE BILLA ("CHIRKUT CHAOS", 4.5s):
  // 0.0-1.2s: Dramatic low-angle close-up on Blue Billa's glowing enlarging eyes
  // 1.2-2.1s: Smooth tracking pan following the 3 cockroaches across the arena
  // 2.1-4.1s: Dynamic 3D orbit framing the churning smoke-cloud beatdown around defender
  // 4.1-4.5s: Smooth restore to 2.5D fighting camera
  if (kind === 'billa') {
    const eyeCloseUp: FixedZoomCameraTarget = {
      x: clampCameraPanX(attackerX + attackerFacing * 0.72),
      y: 1.42,
      z: 3.4,
      lookX: attackerX + attackerFacing * 0.08,
      lookY: 1.78,
      lookZ: 0.1,
    };

    if (elapsed < 1.2) {
      const push = smoothstep(elapsed / 1.2);
      return {
        x: eyeCloseUp.x - attackerFacing * 0.16 * push,
        y: eyeCloseUp.y + 0.08 * push,
        z: eyeCloseUp.z - 0.35 * push,
        lookX: eyeCloseUp.lookX,
        lookY: eyeCloseUp.lookY,
        lookZ: eyeCloseUp.lookZ,
      };
    }

    if (elapsed < 2.1) {
      const trackT = smoothstep((elapsed - 1.2) / 0.9);
      const midX = clampCameraPanX(lerp(attackerX, defenderX, trackT));
      return {
        x: lerp(eyeCloseUp.x - attackerFacing * 0.16, clampCameraPanX(defenderX - attackerFacing * 1.15), trackT),
        y: lerp(1.5, 2.95, trackT),
        z: lerp(3.05, 6.2, trackT),
        lookX: midX,
        lookY: lerp(1.78, 1.32, trackT),
        lookZ: 0,
      };
    }

    const cloudCenterX = clampCameraPanX(defenderX);
    const orbitNorm = Math.max(0, Math.min(1, (elapsed - 2.1) / 2.0));
    const orbitAngle = lerp(-0.5, 0.55, orbitNorm) * attackerFacing;
    const cloudOrbit: FixedZoomCameraTarget = {
      x: clampCameraPanX(cloudCenterX + Math.sin(orbitAngle) * 2.55),
      y: 3.35,
      z: Math.cos(orbitAngle * 0.6) * 6.05,
      lookX: cloudCenterX,
      lookY: 1.22,
      lookZ: 0,
    };

    if (elapsed < 4.1) {
      return cloudOrbit;
    }

    const returnT = smoothstep((elapsed - 4.1) / Math.max(0.15, duration - 4.1));
    return {
      x: lerp(cloudOrbit.x, fightTarget.x, returnT),
      y: lerp(cloudOrbit.y, fightTarget.y, returnT),
      z: lerp(cloudOrbit.z, fightTarget.z, returnT),
      lookX: lerp(cloudOrbit.lookX, fightTarget.lookX, returnT),
      lookY: lerp(cloudOrbit.lookY, fightTarget.lookY, returnT),
      lookZ: 0,
    };
  }

  // GARIB SENA NETA ("VANS, ATTACK!", 4.8s):
  // 0.0-1.5s: Dramatic low-angle upward close-up tracking Neta levitating to y=2.2
  // 1.5-4.15s: Dynamic wide-arena 3D orbit showcasing the full mini-van convoy on the floor
  // 4.15-4.8s: Smooth restore to 2.5D fighting camera as Neta touches down
  if (kind === 'neta') {
    const levCloseUp: FixedZoomCameraTarget = {
      x: clampCameraPanX(attackerX + attackerFacing * 1.1),
      y: 1.18 + attackerY * 0.25,
      z: 4.35,
      lookX: attackerX,
      lookY: 1.48 + attackerY * 0.88,
      lookZ: 0,
    };

    if (elapsed < 1.5) {
      const push = smoothstep(elapsed / 1.5);
      return {
        x: levCloseUp.x - attackerFacing * 0.22 * push,
        y: levCloseUp.y + 0.14 * push,
        z: levCloseUp.z + 0.35 * push,
        lookX: levCloseUp.lookX,
        lookY: levCloseUp.lookY,
        lookZ: 0,
      };
    }

    const midX = clampCameraPanX((attackerX + defenderX) * 0.5);
    const orbitNorm = Math.max(0, Math.min(1, (elapsed - 1.5) / 2.65));
    const orbitAngle = lerp(-0.38, 0.44, orbitNorm) * attackerFacing;
    const wideConvoy: FixedZoomCameraTarget = {
      x: clampCameraPanX(midX + Math.sin(orbitAngle) * 2.4),
      y: 3.65,
      z: 8.65,
      lookX: clampCameraPanX(lerp(midX, defenderX, 0.28)),
      lookY: 1.42,
      lookZ: 0,
    };

    if (elapsed < 4.15) {
      const blendFromLev = smoothstep((elapsed - 1.5) / 0.45);
      return {
        x: lerp(levCloseUp.x, wideConvoy.x, blendFromLev),
        y: lerp(levCloseUp.y, wideConvoy.y, blendFromLev),
        z: lerp(levCloseUp.z, wideConvoy.z, blendFromLev),
        lookX: lerp(levCloseUp.lookX, wideConvoy.lookX, blendFromLev),
        lookY: lerp(levCloseUp.lookY, wideConvoy.lookY, blendFromLev),
        lookZ: 0,
      };
    }

    const returnT = smoothstep((elapsed - 4.15) / Math.max(0.15, duration - 4.15));
    return {
      x: lerp(wideConvoy.x, fightTarget.x, returnT),
      y: lerp(wideConvoy.y, fightTarget.y, returnT),
      z: lerp(wideConvoy.z, fightTarget.z, returnT),
      lookX: lerp(wideConvoy.lookX, fightTarget.lookX, returnT),
      lookY: lerp(wideConvoy.lookY, fightTarget.lookY, returnT),
      lookZ: 0,
    };
  }

  // ANDA BHAI ("THE GREAT WALL DROP!", 4.5s):
  // 0.0-1.4s: Low-angle close-up on Anda Bhai taking off his blue top hat & bowing politely
  // 1.4-3.9s: Wide dramatic 3D orbit framing both fighters, sky lightning bolts, and giant red-brick wall crash
  // 3.9-4.5s: Smooth restore to 2.5D fighting camera as Anda puts his hat back on
  if (kind === 'anda') {
    const bowCloseUp: FixedZoomCameraTarget = {
      x: clampCameraPanX(attackerX + attackerFacing * 0.96),
      y: 1.48,
      z: 4.35,
      lookX: attackerX + attackerFacing * 0.12,
      lookY: 1.24,
      lookZ: 0.05,
    };

    if (elapsed < 1.4) {
      const push = smoothstep(elapsed / 1.4);
      return {
        x: bowCloseUp.x - attackerFacing * 0.18 * push,
        y: bowCloseUp.y + 0.04 * push,
        z: bowCloseUp.z - 0.25 * push,
        lookX: bowCloseUp.lookX,
        lookY: bowCloseUp.lookY - 0.05 * push,
        lookZ: bowCloseUp.lookZ,
      };
    }

    const midX = clampCameraPanX((attackerX + defenderX) * 0.5);
    const orbitNorm = Math.max(0, Math.min(1, (elapsed - 1.4) / 2.5));
    const orbitAngle = lerp(-0.36, 0.44, orbitNorm) * attackerFacing;
    const isWallDrop = elapsed >= 2.45;
    const wideWallTarget: FixedZoomCameraTarget = {
      x: clampCameraPanX(midX + Math.sin(orbitAngle) * 2.5),
      y: isWallDrop ? 3.55 : 3.25,
      z: isWallDrop ? 9.1 : 8.4,
      lookX: clampCameraPanX(lerp(midX, defenderX, 0.34)),
      lookY: isWallDrop ? 1.85 : 1.7,
      lookZ: 0,
    };

    if (elapsed < 3.9) {
      const blendFromBow = smoothstep((elapsed - 1.4) / 0.45);
      return {
        x: lerp(bowCloseUp.x - attackerFacing * 0.18, wideWallTarget.x, blendFromBow),
        y: lerp(bowCloseUp.y + 0.04, wideWallTarget.y, blendFromBow),
        z: lerp(bowCloseUp.z - 0.25, wideWallTarget.z, blendFromBow),
        lookX: lerp(bowCloseUp.lookX, wideWallTarget.lookX, blendFromBow),
        lookY: lerp(bowCloseUp.lookY - 0.05, wideWallTarget.lookY, blendFromBow),
        lookZ: 0,
      };
    }

    const returnT = smoothstep((elapsed - 3.9) / Math.max(0.15, duration - 3.9));
    return {
      x: lerp(wideWallTarget.x, fightTarget.x, returnT),
      y: lerp(wideWallTarget.y, fightTarget.y, returnT),
      z: lerp(wideWallTarget.z, fightTarget.z, returnT),
      lookX: lerp(wideWallTarget.lookX, fightTarget.lookX, returnT),
      lookY: lerp(wideWallTarget.lookY, fightTarget.lookY, returnT),
      lookZ: 0,
    };
  }

  // LADDOO MAUSI ("GOL-GOL LADDOO BARRAGE!", 5.0s):
  // 0.0-1.6s: Low-angle festive close-up on Mausi holding up & gulping her glowing golden Power Laddoo
  // 1.6-2.45s: Dramatic upward tracking sweep as Mausi levitates to y=2.0 with golden aura rings
  // 2.45-4.45s: Wide dynamic 3D orbit framing levitating Mausi + 14-laddoo storm + Mega Laddoo finisher
  // 4.45-5.0s: Smooth restore to 2.5D fighting camera as Mausi touches down
  if (kind === 'mausi') {
    const gulpCloseUp: FixedZoomCameraTarget = {
      x: clampCameraPanX(attackerX + attackerFacing * 0.96),
      y: 1.46,
      z: 3.95,
      lookX: attackerX + attackerFacing * 0.08,
      lookY: 1.68,
      lookZ: 0.05,
    };

    if (elapsed < 1.6) {
      const push = smoothstep(elapsed / 1.6);
      return {
        x: gulpCloseUp.x - attackerFacing * 0.16 * push,
        y: gulpCloseUp.y + 0.08 * push,
        z: gulpCloseUp.z - 0.22 * push,
        lookX: gulpCloseUp.lookX,
        lookY: gulpCloseUp.lookY + 0.04 * push,
        lookZ: gulpCloseUp.lookZ,
      };
    }

    const midX = clampCameraPanX((attackerX + defenderX) * 0.5);
    const orbitNorm = Math.max(0, Math.min(1, (elapsed - 2.45) / 2.0));
    const orbitAngle = lerp(-0.32, 0.4, orbitNorm) * attackerFacing;
    const wideBarrageTarget: FixedZoomCameraTarget = {
      x: clampCameraPanX(midX + Math.sin(orbitAngle) * 2.3),
      y: 3.75,
      z: 9.5,
      lookX: clampCameraPanX(lerp(midX, defenderX, 0.2)),
      lookY: 2.05,
      lookZ: 0,
    };

    if (elapsed < 2.45) {
      const liftT = smoothstep((elapsed - 1.6) / 0.85);
      const liftCamX = clampCameraPanX(lerp(attackerX + attackerFacing * 1.1, wideBarrageTarget.x, 0.65));
      return {
        x: lerp(gulpCloseUp.x - attackerFacing * 0.16, liftCamX, liftT),
        y: lerp(gulpCloseUp.y + 0.08, 2.55 + attackerY * 0.45, liftT),
        z: lerp(gulpCloseUp.z - 0.22, 8.6, liftT),
        lookX: lerp(gulpCloseUp.lookX, lerp(attackerX, wideBarrageTarget.lookX, 0.55), liftT),
        lookY: lerp(gulpCloseUp.lookY + 0.04, 1.55 + attackerY * 0.45, liftT),
        lookZ: 0,
      };
    }

    if (elapsed < 4.45) {
      const blendT = smoothstep((elapsed - 2.45) / 0.35);
      const prevX = clampCameraPanX(lerp(attackerX + attackerFacing * 1.1, wideBarrageTarget.x, 0.65));
      return {
        x: lerp(prevX, wideBarrageTarget.x, blendT),
        y: lerp(2.55 + attackerY * 0.45, wideBarrageTarget.y, blendT),
        z: lerp(8.6, wideBarrageTarget.z, blendT),
        lookX: lerp(lerp(attackerX, wideBarrageTarget.lookX, 0.55), wideBarrageTarget.lookX, blendT),
        lookY: lerp(1.55 + attackerY * 0.45, wideBarrageTarget.lookY, blendT),
        lookZ: 0,
      };
    }

    const returnT = smoothstep((elapsed - 4.45) / Math.max(0.15, duration - 4.45));
    return {
      x: lerp(wideBarrageTarget.x, fightTarget.x, returnT),
      y: lerp(wideBarrageTarget.y, fightTarget.y, returnT),
      z: lerp(wideBarrageTarget.z, fightTarget.z, returnT),
      lookX: lerp(wideBarrageTarget.lookX, fightTarget.lookX, returnT),
      lookY: lerp(wideBarrageTarget.lookY, fightTarget.lookY, returnT),
      lookZ: 0,
    };
  }

  // PRINCIPAL MAN ("RUSTICATION ORDER!", 5.2s):
  // 0.0-1.5s: Smooth cinematic low-angle orbit/sweep upward around levitating Principal Man (y -> 2.4)
  // 1.5-2.8s: Framed dramatic mid-orbit showcasing the 14 swirling glowing red "RUSTICATE" papers
  // 2.8-4.65s: Dynamic wide 3D perspective framing hovering Principal Man + opponent below during barrage & Master Notice slam
  // 4.65-5.2s: Smooth restore to standard 2.5D fighting camera as Principal Man descends to floor
  if (kind === 'father') {
    const midX = clampCameraPanX((attackerX + defenderX) * 0.5);

    if (elapsed < 1.5) {
      const liftT = smoothstep(elapsed / 1.5);
      const sweepAngle = lerp(-0.42, 0.36, liftT) * attackerFacing;
      return {
        x: clampCameraPanX(attackerX + Math.sin(sweepAngle) * 2.45 + attackerFacing * 0.65),
        y: lerp(1.15, 2.35, liftT),
        z: lerp(4.15, 5.2, liftT),
        lookX: attackerX,
        lookY: 1.38 + attackerY * 0.78,
        lookZ: 0,
      };
    }

    const orbitStartX = clampCameraPanX(attackerX + Math.sin(0.36 * attackerFacing) * 2.45 + attackerFacing * 0.65);

    if (elapsed < 2.8) {
      const vortexT = smoothstep((elapsed - 1.5) / 1.3);
      const orbitAngle = lerp(0.36, -0.28, vortexT) * attackerFacing;
      return {
        x: clampCameraPanX(lerp(orbitStartX, attackerX + Math.sin(orbitAngle) * 2.8, vortexT)),
        y: lerp(2.35, 3.25, vortexT),
        z: lerp(5.2, 6.75, vortexT),
        lookX: lerp(attackerX, clampCameraPanX(lerp(attackerX, midX, 0.25)), vortexT),
        lookY: lerp(1.38 + attackerY * 0.78, 3.15, vortexT),
        lookZ: 0,
      };
    }

    const barrageNorm = Math.max(0, Math.min(1, (elapsed - 2.8) / 1.85));
    const barrageAngle = lerp(-0.28, 0.34, barrageNorm) * attackerFacing;
    const isSlamBeat = elapsed >= 4.28;
    const wideBarrageTarget: FixedZoomCameraTarget = {
      x: clampCameraPanX(midX + Math.sin(barrageAngle) * 2.35),
      y: isSlamBeat ? 3.55 : 3.9,
      z: isSlamBeat ? 8.85 : 9.65,
      lookX: clampCameraPanX(lerp(midX, defenderX, isSlamBeat ? 0.38 : 0.22)),
      lookY: isSlamBeat ? 1.65 : 2.15,
      lookZ: 0,
    };

    if (elapsed < 4.65) {
      const blendT = smoothstep((elapsed - 2.8) / 0.42);
      const prevX = clampCameraPanX(attackerX + Math.sin(-0.28 * attackerFacing) * 2.8);
      return {
        x: lerp(prevX, wideBarrageTarget.x, blendT),
        y: lerp(3.25, wideBarrageTarget.y, blendT),
        z: lerp(6.75, wideBarrageTarget.z, blendT),
        lookX: lerp(clampCameraPanX(lerp(attackerX, midX, 0.25)), wideBarrageTarget.lookX, blendT),
        lookY: lerp(3.15, wideBarrageTarget.lookY, blendT),
        lookZ: 0,
      };
    }

    const returnT = smoothstep((elapsed - 4.65) / Math.max(0.15, duration - 4.65));
    return {
      x: lerp(wideBarrageTarget.x, fightTarget.x, returnT),
      y: lerp(wideBarrageTarget.y, fightTarget.y, returnT),
      z: lerp(wideBarrageTarget.z, fightTarget.z, returnT),
      lookX: lerp(wideBarrageTarget.lookX, fightTarget.lookX, returnT),
      lookY: lerp(wideBarrageTarget.lookY, fightTarget.lookY, returnT),
      lookZ: 0,
    };
  }

  // SAMYAK ("MISSION IAS: BEAST MODE!", 4.8s):
  // 0.0-1.8s: Dramatic low-angle close-up sweeping across Samyak's double-bicep flex & sunglasses lens glint
  // 1.8-3.5s: Dynamic 3D angle framing both fighters during UPSC books + iron gym dumbbells barrage
  // 3.5-4.45s: Tracks superhero leap & ground-slam summoning golden "IAS · AIR 1" floor seal
  // 4.45-4.8s: Smooth restore to 2.5D fight camera as Samyak rises & adjusts black sunglasses
  if (kind === 'samyak') {
    const midX = clampCameraPanX((attackerX + defenderX) * 0.5);

    if (elapsed < 1.8) {
      const flexT = smoothstep(elapsed / 1.8);
      const sweepAngle = lerp(-0.38, 0.32, flexT) * attackerFacing;
      return {
        x: clampCameraPanX(attackerX + Math.sin(sweepAngle) * 2.15 + attackerFacing * 0.55),
        y: lerp(1.08, 1.62, flexT),
        z: lerp(3.65, 4.35, flexT),
        lookX: attackerX,
        lookY: lerp(1.48, 1.72, flexT),
        lookZ: 0,
      };
    }

    const phase1EndX = clampCameraPanX(
      attackerX + Math.sin(0.32 * attackerFacing) * 2.15 + attackerFacing * 0.55,
    );

    if (elapsed < 3.5) {
      const barrageT = smoothstep((elapsed - 1.8) / 0.42);
      const orbitNorm = (elapsed - 1.8) / 1.7;
      const orbitAngle = lerp(0.3, -0.26, orbitNorm) * attackerFacing;
      const targetX = clampCameraPanX(midX + Math.sin(orbitAngle) * 2.1);
      return {
        x: lerp(phase1EndX, targetX, barrageT),
        y: lerp(1.62, 3.25 + orbitNorm * 0.2, barrageT),
        z: lerp(4.35, 8.95 + orbitNorm * 0.35, barrageT),
        lookX: lerp(attackerX, clampCameraPanX(lerp(midX, defenderX, 0.2)), barrageT),
        lookY: lerp(1.72, 1.75, barrageT),
        lookZ: 0,
      };
    }

    const isPostSlam = elapsed >= 4.1;
    const slamTarget: FixedZoomCameraTarget = {
      x: clampCameraPanX(lerp(midX, defenderX, isPostSlam ? 0.35 : 0.22)),
      y: isPostSlam ? 2.85 : 3.45 + attackerY * 0.24,
      z: isPostSlam ? 7.8 : 9.15,
      lookX: clampCameraPanX(lerp(midX, defenderX, isPostSlam ? 0.4 : 0.28)),
      lookY: isPostSlam ? 1.25 : 1.75 + attackerY * 0.32,
      lookZ: 0,
    };

    if (elapsed < 4.45) {
      const blendT = smoothstep((elapsed - 3.5) / 0.3);
      const prevX = clampCameraPanX(midX + Math.sin(-0.26 * attackerFacing) * 2.1);
      return {
        x: lerp(prevX, slamTarget.x, blendT),
        y: lerp(3.45, slamTarget.y, blendT),
        z: lerp(9.3, slamTarget.z, blendT),
        lookX: lerp(clampCameraPanX(lerp(midX, defenderX, 0.2)), slamTarget.lookX, blendT),
        lookY: lerp(1.75, slamTarget.lookY, blendT),
        lookZ: 0,
      };
    }

    const returnT = smoothstep((elapsed - 4.45) / Math.max(0.12, duration - 4.45));
    return {
      x: lerp(slamTarget.x, fightTarget.x, returnT),
      y: lerp(slamTarget.y, fightTarget.y, returnT),
      z: lerp(slamTarget.z, fightTarget.z, returnT),
      lookX: lerp(slamTarget.lookX, fightTarget.lookX, returnT),
      lookY: lerp(slamTarget.lookY, fightTarget.lookY, returnT),
      lookZ: 0,
    };
  }

  const startupEnd = isSheruSuper ? 1.0 : Math.min(0.56, duration * 0.36);
  const returnStart = isSheruSuper ? Math.max(startupEnd + 0.5, duration - 0.75) : Math.max(startupEnd + 0.4, duration - 0.32);

  // Dramatic low-angle close-up on attacker during startup
  const lowAngleTarget: FixedZoomCameraTarget = {
    x: clampCameraPanX(attackerX + attackerFacing * 0.85),
    y: 1.24,
    z: 3.75,
    lookX: attackerX,
    lookY: 1.62,
    lookZ: 0,
  };

  if (elapsed < startupEnd) {
    const push = smoothstep(elapsed / Math.max(0.2, startupEnd));
    return {
      x: lowAngleTarget.x - attackerFacing * 0.25 * push,
      y: lowAngleTarget.y - 0.08 * push,
      z: lowAngleTarget.z - 0.35 * push,
      lookX: lowAngleTarget.lookX,
      lookY: lowAngleTarget.lookY,
      lookZ: 0,
    };
  }

  // Dynamic high-angle 3D orbit framing attacker + defender during main attack & finisher
  const midX = clampCameraPanX((attackerX + defenderX) * 0.5);
  const orbitSpan = Math.max(0.2, returnStart - startupEnd);
  const orbitNorm = Math.max(0, Math.min(1, (elapsed - startupEnd) / orbitSpan));
  const orbitAngle = lerp(-0.55, 0.62, orbitNorm) * attackerFacing;
  const orbitRadius = isSheruSuper && elapsed >= 5.45 ? 6.15 : 6.75;

  const highOrbitTarget: FixedZoomCameraTarget = {
    x: clampCameraPanX(midX + Math.sin(orbitAngle) * 2.85),
    y: isSheruSuper && elapsed >= 5.45 ? 3.85 : 4.25,
    z: Math.cos(orbitAngle * 0.65) * orbitRadius,
    lookX: midX,
    lookY: 1.22,
    lookZ: 0,
  };

  if (elapsed < returnStart) {
    const blendFromLow = smoothstep((elapsed - startupEnd) / 0.42);
    return {
      x: lerp(lowAngleTarget.x, highOrbitTarget.x, blendFromLow),
      y: lerp(lowAngleTarget.y, highOrbitTarget.y, blendFromLow),
      z: lerp(lowAngleTarget.z, highOrbitTarget.z, blendFromLow),
      lookX: lerp(lowAngleTarget.lookX, highOrbitTarget.lookX, blendFromLow),
      lookY: lerp(lowAngleTarget.lookY, highOrbitTarget.lookY, blendFromLow),
      lookZ: 0,
    };
  }

  const returnT = smoothstep((elapsed - returnStart) / Math.max(0.15, duration - returnStart));
  return {
    x: lerp(highOrbitTarget.x, fightTarget.x, returnT),
    y: lerp(highOrbitTarget.y, fightTarget.y, returnT),
    z: lerp(highOrbitTarget.z, fightTarget.z, returnT),
    lookX: lerp(highOrbitTarget.lookX, fightTarget.lookX, returnT),
    lookY: lerp(highOrbitTarget.lookY, fightTarget.lookY, returnT),
    lookZ: 0,
  };
}

/**
 * KO Winner Celebration Camera:
 * Gentle zoom-in framing the winning fighter in their raised-arms celebration pose.
 */
export function computeKoWinnerCameraTarget(
  winnerX: number,
  winnerFacing: 1 | -1,
): FixedZoomCameraTarget {
  const clampedX = clampCameraPanX(winnerX);
  return {
    x: clampCameraPanX(clampedX + winnerFacing * 0.55),
    y: 2.02,
    z: 5.15,
    lookX: clampedX,
    lookY: 1.45,
    lookZ: 0,
  };
}
