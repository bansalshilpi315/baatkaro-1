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
 * Pre-Fight Round 1 Intro Sweep (~2.65s):
 * - 0.00s..0.95s: 3/4 over-the-shoulder view near P1 looking across at CPU
 * - 0.95s..1.85s: Smooth swing to 3/4 over-the-shoulder view near CPU looking back at P1
 * - 1.85s..2.65s: Smooth glide back to standard elevated 2.5D fighting angle as "ROUND 1" slams in
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

  // Phase 1 (0.0s - 0.95s): 3/4 over-the-shoulder behind/beside P1 looking across at CPU
  const p1Shoulder: FixedZoomCameraTarget = {
    x: p1X - 1.85,
    y: 2.02,
    z: 4.35,
    lookX: p2X - 0.65,
    lookY: 1.44,
    lookZ: -0.25,
  };

  // Phase 2 (0.95s - 1.85s): 3/4 over-the-shoulder behind/beside CPU looking across at P1
  const p2Shoulder: FixedZoomCameraTarget = {
    x: p2X + 1.85,
    y: 2.02,
    z: 4.35,
    lookX: p1X + 0.65,
    lookY: 1.44,
    lookZ: -0.25,
  };

  if (introElapsed < 0.95) {
    // Subtle push-in drift during P1 taunt
    const drift = smoothstep(introElapsed / 0.95);
    return {
      x: p1Shoulder.x + drift * 0.22,
      y: p1Shoulder.y,
      z: p1Shoulder.z - drift * 0.25,
      lookX: p1Shoulder.lookX,
      lookY: p1Shoulder.lookY,
      lookZ: p1Shoulder.lookZ,
    };
  }

  if (introElapsed < 1.85) {
    const t = smoothstep((introElapsed - 0.95) / 0.42);
    return {
      x: lerp(p1Shoulder.x + 0.22, p2Shoulder.x, t),
      y: lerp(p1Shoulder.y, p2Shoulder.y, t),
      z: lerp(p1Shoulder.z - 0.25, p2Shoulder.z, t) + Math.sin(t * Math.PI) * 1.15,
      lookX: lerp(p1Shoulder.lookX, p2Shoulder.lookX, t),
      lookY: lerp(p1Shoulder.lookY, p2Shoulder.lookY, t),
      lookZ: lerp(p1Shoulder.lookZ, p2Shoulder.lookZ, t),
    };
  }

  const returnT = smoothstep((introElapsed - 1.85) / Math.max(0.35, introDuration - 1.85));
  return {
    x: lerp(p2Shoulder.x, fightTarget.x, returnT),
    y: lerp(p2Shoulder.y, fightTarget.y, returnT),
    z: lerp(p2Shoulder.z, fightTarget.z, returnT),
    lookX: lerp(p2Shoulder.lookX, fightTarget.lookX, returnT),
    lookY: lerp(p2Shoulder.lookY, fightTarget.lookY, returnT),
    lookZ: lerp(p2Shoulder.lookZ, fightTarget.lookZ, returnT),
  };
}

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
): FixedZoomCameraTarget {
  const fightTarget = computeFixedZoomCameraTarget(attackerX, defenderX);
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
