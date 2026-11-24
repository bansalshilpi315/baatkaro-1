import type { FighterId, FighterState } from '../types';

export interface CombatPose {
  pelvisX: number;
  pelvisY: number;
  pelvisRotX: number;
  pelvisRotY: number;
  pelvisRotZ: number;
  torsoRotX: number;
  torsoRotY: number;
  torsoRotZ: number;
  headRotX: number;
  headRotY: number;
  headRotZ: number;
  lShX: number;
  lShY: number;
  lShZ: number;
  lElbX: number;
  lElbZ: number;
  rShX: number;
  rShY: number;
  rShZ: number;
  rElbX: number;
  rElbZ: number;
  lHipX: number;
  lHipY: number;
  lHipZ: number;
  lKneeX: number;
  rHipX: number;
  rHipY: number;
  rHipZ: number;
  rKneeX: number;
  snapRate: number;
}

export type EaseKind =
  | 'linear'
  | 'smooth'
  | 'easeInQuad'
  | 'easeOutCubic'
  | 'easeOutExpo'
  | 'easeInOutCubic'
  | 'hold';

export interface PoseKeyframe {
  /** Normalized progress along the animation clip [0..1] */
  t: number;
  /** Easing applied from the previous keyframe into this keyframe */
  ease?: EaseKind;
  /** Joint overrides relative to base stance (omitted joints stay at base) */
  pose: Partial<CombatPose>;
}

export type StrikeTrailLimb = 'leftFist' | 'rightFist' | 'leftFoot' | 'rightFoot';

export interface StrikeTrailInfo {
  limb: StrikeTrailLimb | null;
  intensity: number;
}

export interface StrikePhaseWeights {
  windup: number;
  strike: number;
  recover: number;
}

const POSE_KEYS: ReadonlyArray<keyof CombatPose> = [
  'pelvisX',
  'pelvisY',
  'pelvisRotX',
  'pelvisRotY',
  'pelvisRotZ',
  'torsoRotX',
  'torsoRotY',
  'torsoRotZ',
  'headRotX',
  'headRotY',
  'headRotZ',
  'lShX',
  'lShY',
  'lShZ',
  'lElbX',
  'lElbZ',
  'rShX',
  'rShY',
  'rShZ',
  'rElbX',
  'rElbZ',
  'lHipX',
  'lHipY',
  'lHipZ',
  'lKneeX',
  'rHipX',
  'rHipY',
  'rHipZ',
  'rKneeX',
  'snapRate',
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function applyEase(t: number, ease: EaseKind = 'smooth'): number {
  const c = clamp01(t);
  switch (ease) {
    case 'linear':
      return c;
    case 'smooth':
      return c * c * (3 - 2 * c);
    case 'easeInQuad':
      return c * c;
    case 'easeOutCubic':
      return 1 - (1 - c) * (1 - c) * (1 - c);
    case 'easeOutExpo':
      return c >= 1 ? 1 : 1 - Math.pow(2, -10 * c);
    case 'easeInOutCubic':
      return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
    case 'hold':
      return c >= 1 ? 1 : 0;
  }
}

/**
 * Multi-keyframe procedural pose interpolator with non-linear easing and crisp impact holds.
 * Interpolates every skeletal joint smoothly across an ordered array of PoseKeyframes.
 */
export function sampleKeyframeTrack(
  base: CombatPose,
  keyframes: readonly PoseKeyframe[],
  progress: number,
): CombatPose {
  if (keyframes.length === 0) return { ...base };
  const p = clamp01(progress);

  if (p <= keyframes[0].t) {
    return { ...base, ...keyframes[0].pose };
  }
  const last = keyframes[keyframes.length - 1];
  if (p >= last.t) {
    return { ...base, ...last.pose };
  }

  let segIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (p >= keyframes[i].t && p <= keyframes[i + 1].t) {
      segIdx = i;
      break;
    }
  }

  const kfA = keyframes[segIdx];
  const kfB = keyframes[segIdx + 1];
  const span = Math.max(1e-5, kfB.t - kfA.t);
  const localT = clamp01((p - kfA.t) / span);
  const alpha = applyEase(localT, kfB.ease ?? 'smooth');

  const out: CombatPose = { ...base };
  for (let i = 0; i < POSE_KEYS.length; i++) {
    const k = POSE_KEYS[i];
    const a = kfA.pose[k] ?? base[k];
    const b = kfB.pose[k] ?? base[k];
    out[k] = a + (b - a) * alpha;
  }
  return out;
}

/**
 * Evaluates a crisp 3-stage martial-arts curve:
 * Wind-Up (0..windupEnd) -> Explosive Strike + Hold (windupEnd..strikeEnd) -> Recovery (strikeEnd..1).
 */
export function evalStrikeCurve(
  progress: number,
  windupEnd = 0.22,
  strikeEnd = 0.56,
): StrikePhaseWeights {
  const p = clamp01(progress);
  if (p < windupEnd) {
    const w = applyEase(p / Math.max(0.01, windupEnd), 'easeInQuad');
    return { windup: w, strike: 0, recover: 0 };
  }
  if (p < strikeEnd) {
    const s = applyEase((p - windupEnd) / Math.max(0.01, strikeEnd - windupEnd), 'easeOutExpo');
    return { windup: 1 - s, strike: s, recover: 0 };
  }
  const r = applyEase((p - strikeEnd) / Math.max(0.01, 1 - strikeEnd), 'smooth');
  return { windup: 0, strike: 1 - r, recover: r };
}

/**
 * Proportion scale factors so 2-bone martial-arts kinematics read athletically across
 * all 5 fighters (including Anda Bhai's egg silhouette and Laddoo Mausi's heavyweight frame).
 */
export function getFighterKinematicScale(id: FighterId, isEggBody: boolean): {
  limbReach: number;
  twistScale: number;
  kneeBendScale: number;
  guardSpread: number;
  flatPelvisY: number;
} {
  if (isEggBody || id === 'anda') {
    return {
      limbReach: 0.9,
      twistScale: 0.84,
      kneeBendScale: 0.86,
      guardSpread: 0.16,
      flatPelvisY: 0.46,
    };
  }
  if (id === 'mausi') {
    return {
      limbReach: 0.94,
      twistScale: 0.88,
      kneeBendScale: 0.88,
      guardSpread: 0.12,
      flatPelvisY: 0.44,
    };
  }
  if (id === 'billa') {
    return {
      limbReach: 1.06,
      twistScale: 1.06,
      kneeBendScale: 1.04,
      guardSpread: 0.05,
      flatPelvisY: 0.30,
    };
  }
  return {
    limbReach: 1.0,
    twistScale: 1.0,
    kneeBendScale: 1.0,
    guardSpread: 0.0,
    flatPelvisY: 0.32,
  };
}

/**
 * Active Kung-Fu Stance (Idle):
 * - pelvisGroup slightly lowered with rhythmic martial-arts bounce
 * - Both knees bent ~25 deg (~0.44 rad), front foot forward, rear foot angled
 * - torsoGroup angled ~35 deg (~0.61 rad) sideways open to camera
 * - Both elbows bent ~95 deg (~-1.66 rad) holding fists up near chin/chest guard
 */
export function computeGuardPose(
  id: FighterId,
  slot: 0 | 1,
  elapsed: number,
  basePelvisY: number,
  isEggBody: boolean,
  facing: 1 | -1 = slot === 0 ? 1 : -1,
): CombatPose {
  const scale = getFighterKinematicScale(id, isEggBody);
  // Rhythmic martial-arts bounce using eased triangle pulse (crisp weight shift, not floaty sine)
  const rawPhase = ((elapsed * 1.65 + slot * 0.37) % 1 + 1) % 1;
  const bouncePulse =
    rawPhase < 0.5
      ? applyEase(rawPhase * 2, 'easeInOutCubic')
      : 1 - applyEase((rawPhase - 0.5) * 2, 'easeInOutCubic');
  const bounce = bouncePulse * 2 - 1; // -1..+1

  const crouchDrop = 0.08 * scale.kneeBendScale;
  // Torso angled ~35 deg (0.61 rad) sideways for authentic martial-arts silhouette
  const torsoAngle = -0.60 * scale.twistScale * facing;

  return {
    pelvisX: 0,
    pelvisY: basePelvisY - crouchDrop + bounce * 0.028,
    pelvisRotX: 0.04,
    pelvisRotY: -0.22 * scale.twistScale * facing,
    pelvisRotZ: bounce * (id === 'anda' ? 0.055 : 0.02),
    torsoRotX: (id === 'sheru' ? -0.02 : 0.08) + bounce * 0.024,
    torsoRotY: torsoAngle + bounce * 0.035,
    torsoRotZ: 0,
    headRotX: (id === 'sheru' ? 0.02 : -0.04) - bounce * 0.02,
    headRotY: 0.56 * scale.twistScale * facing, // Eyes locked straight onto opponent across angled torso
    headRotZ: 0,
    // Front (left) kung-fu guard arm: elbow bent ~95 deg (-1.65 rad) holding fist at chin/chest
    lShX: -1.16 + bounce * 0.05,
    lShY: 0.22,
    lShZ: -0.22 - scale.guardSpread,
    lElbX: -1.64 - bounce * 0.04,
    lElbZ: 0.16,
    // Rear (right) kung-fu guard arm: elbow bent ~98 deg (-1.71 rad) tucked tight at chin
    rShX: -0.98 - bounce * 0.05,
    rShY: -0.22,
    rShZ: 0.24 + scale.guardSpread,
    rElbX: -1.70 + bounce * 0.04,
    rElbZ: -0.18,
    // Front leg planted forward, knee bent ~25 deg (0.44 rad)
    lHipX: -0.36 * scale.kneeBendScale,
    lHipY: -0.12,
    lHipZ: -0.08,
    lKneeX: 0.45 * scale.kneeBendScale - bounce * 0.05,
    // Rear leg planted back & angled outward, knee bent ~25 deg (0.43 rad)
    rHipX: 0.34 * scale.kneeBendScale,
    rHipY: 0.30,
    rHipZ: 0.12,
    rKneeX: 0.43 * scale.kneeBendScale + bounce * 0.05,
    snapRate: 20,
  };
}

/**
 * Returns which striking limb should emit the white-to-gold arcade motion trail ribbon
 * and its intensity (0..1) for the current frame.
 */
export function getActiveStrikeTrailInfo(state: FighterState): StrikeTrailInfo {
  if (state.actionDuration <= 0) return { limb: null, intensity: 0 };
  const p = clamp01(state.actionTimer / state.actionDuration);

  if (state.action === 'punch') {
    const limb: StrikeTrailLimb = state.comboStep === 0 ? 'leftFist' : 'rightFist';
    const start = state.comboStep === 2 ? 0.16 : 0.14;
    const peak = state.comboStep === 2 ? 0.44 : 0.36;
    const end = state.comboStep === 2 ? 0.72 : 0.66;
    if (p < start || p > end) return { limb: null, intensity: 0 };
    const intensity =
      p < peak
        ? applyEase((p - start) / Math.max(0.01, peak - start), 'easeOutCubic')
        : 1 - applyEase((p - peak) / Math.max(0.01, end - peak), 'smooth');
    return { limb, intensity };
  }

  if (state.action === 'kick') {
    const limb: StrikeTrailLimb =
      state.comboStep >= 1 && state.facing === -1 ? 'leftFoot' : 'rightFoot';
    const start = 0.16;
    const peak = state.comboStep === 2 ? 0.44 : 0.38;
    const end = state.comboStep === 2 ? 0.74 : 0.68;
    if (p < start || p > end) return { limb: null, intensity: 0 };
    const intensity =
      p < peak
        ? applyEase((p - start) / Math.max(0.01, peak - start), 'easeOutCubic')
        : 1 - applyEase((p - peak) / Math.max(0.01, end - peak), 'smooth');
    return { limb, intensity };
  }

  if (state.action === 'sweep') {
    const limb: StrikeTrailLimb = state.facing === -1 ? 'leftFoot' : 'rightFoot';
    const start = 0.16;
    const peak = 0.40;
    const end = 0.70;
    if (p < start || p > end) return { limb: null, intensity: 0 };
    const intensity =
      p < peak
        ? applyEase((p - start) / Math.max(0.01, peak - start), 'easeOutCubic')
        : 1 - applyEase((p - peak) / Math.max(0.01, end - peak), 'smooth');
    return { limb, intensity };
  }

  return { limb: null, intensity: 0 };
}

/**
 * Multi-keyframe procedural martial-arts solver for all core combat states:
 * idle (kung-fu stance), walk (stepping footwork), jump, crouch, block,
 * punch (Lead Jab -> Twisting Power Cross -> Rising Uppercut),
 * kick (Chambered Front Snap Kick -> Side/Roundhouse Kick -> Jumping Spinning Kick),
 * sweep (Low Kung-Fu Sweep), grab & grab_hold (Clinch -> 180° Hip-Throw Slam),
 * grabbed, hit stagger, knockdown (mid-air flip -> flat on back), 2-stage getup, ko, victory.
 */
export function computeCombatPose(
  state: FighterState,
  elapsed: number,
  basePelvisY: number,
  isEggBody: boolean,
): CombatPose {
  const scale = getFighterKinematicScale(state.id, isEggBody);
  const f = state.facing;
  const guard = computeGuardPose(state.id, state.slot, elapsed, basePelvisY, isEggBody, f);
  const atkProgress =
    state.actionDuration > 0 ? clamp01(state.actionTimer / state.actionDuration) : 0;

  switch (state.action) {
    case 'idle': {
      return guard;
    }

    case 'walk': {
      // Crisp kung-fu stepping footwork using eased keyframe cycle while fists stay up in guard
      const movingForward = state.vx * f >= 0;
      const cyc = ((state.walkCycle * (movingForward ? 0.19 : -0.17)) % 1 + 1) % 1;
      const strideAmp = 0.56 * scale.kneeBendScale;
      const walkFrames: PoseKeyframe[] = [
        {
          t: 0.0,
          pose: {
            pelvisX: movingForward ? 0.06 : -0.05,
            pelvisY: basePelvisY - 0.05 * scale.kneeBendScale,
            pelvisRotY: -0.18 * scale.twistScale * f + 0.12,
            torsoRotX: movingForward ? 0.12 : -0.02,
            torsoRotY: -0.44 * scale.twistScale * f + 0.14,
            headRotY: 0.42 * scale.twistScale * f - 0.1,
            lHipX: -0.16 + strideAmp,
            lKneeX: 0.28,
            rHipX: 0.16 - strideAmp,
            rKneeX: 0.34 + 0.62 * scale.kneeBendScale,
            lShX: -1.12,
            rShX: -0.94,
            snapRate: 22,
          },
        },
        {
          t: 0.25,
          ease: 'easeInOutCubic',
          pose: {
            pelvisX: movingForward ? 0.07 : -0.06,
            pelvisY: basePelvisY - 0.09 * scale.kneeBendScale,
            pelvisRotY: -0.18 * scale.twistScale * f,
            torsoRotX: movingForward ? 0.14 : -0.03,
            torsoRotY: -0.44 * scale.twistScale * f,
            headRotY: 0.42 * scale.twistScale * f,
            lHipX: -0.12,
            lKneeX: 0.58 * scale.kneeBendScale,
            rHipX: 0.12,
            rKneeX: 0.58 * scale.kneeBendScale,
            lShX: -1.04,
            rShX: -1.02,
            snapRate: 22,
          },
        },
        {
          t: 0.5,
          ease: 'easeInOutCubic',
          pose: {
            pelvisX: movingForward ? 0.06 : -0.05,
            pelvisY: basePelvisY - 0.05 * scale.kneeBendScale,
            pelvisRotY: -0.18 * scale.twistScale * f - 0.12,
            torsoRotX: movingForward ? 0.12 : -0.02,
            torsoRotY: -0.44 * scale.twistScale * f - 0.14,
            headRotY: 0.42 * scale.twistScale * f + 0.1,
            lHipX: -0.16 - strideAmp,
            lKneeX: 0.34 + 0.62 * scale.kneeBendScale,
            rHipX: 0.16 + strideAmp,
            rKneeX: 0.28,
            lShX: -0.96,
            rShX: -1.10,
            snapRate: 22,
          },
        },
        {
          t: 0.75,
          ease: 'easeInOutCubic',
          pose: {
            pelvisX: movingForward ? 0.07 : -0.06,
            pelvisY: basePelvisY - 0.09 * scale.kneeBendScale,
            pelvisRotY: -0.18 * scale.twistScale * f,
            torsoRotX: movingForward ? 0.14 : -0.03,
            torsoRotY: -0.44 * scale.twistScale * f,
            headRotY: 0.42 * scale.twistScale * f,
            lHipX: -0.12,
            lKneeX: 0.58 * scale.kneeBendScale,
            rHipX: 0.12,
            rKneeX: 0.58 * scale.kneeBendScale,
            lShX: -1.04,
            rShX: -1.02,
            snapRate: 22,
          },
        },
        {
          t: 1.0,
          ease: 'easeInOutCubic',
          pose: {
            pelvisX: movingForward ? 0.06 : -0.05,
            pelvisY: basePelvisY - 0.05 * scale.kneeBendScale,
            pelvisRotY: -0.18 * scale.twistScale * f + 0.12,
            torsoRotX: movingForward ? 0.12 : -0.02,
            torsoRotY: -0.44 * scale.twistScale * f + 0.14,
            headRotY: 0.42 * scale.twistScale * f - 0.1,
            lHipX: -0.16 + strideAmp,
            lKneeX: 0.28,
            rHipX: 0.16 - strideAmp,
            rKneeX: 0.34 + 0.62 * scale.kneeBendScale,
            lShX: -1.12,
            rShX: -0.94,
            snapRate: 22,
          },
        },
      ];
      return sampleKeyframeTrack(guard, walkFrames, cyc);
    }

    case 'jump': {
      const rising = state.vy > 0;
      return {
        ...guard,
        pelvisY: basePelvisY + 0.04,
        torsoRotX: rising ? 0.16 : 0.06,
        torsoRotY: -0.28 * scale.twistScale * f,
        lShX: -1.35,
        lShZ: -0.34 - scale.guardSpread,
        lElbX: -1.45,
        rShX: -1.25,
        rShZ: 0.34 + scale.guardSpread,
        rElbX: -1.52,
        lHipX: rising ? -0.88 : -0.45,
        lKneeX: rising ? 1.42 : 0.85,
        rHipX: rising ? -0.38 : -0.15,
        rKneeX: rising ? 0.96 : 0.65,
        snapRate: 20,
      };
    }

    case 'crouch': {
      return {
        ...guard,
        pelvisY: basePelvisY - 0.36 * scale.kneeBendScale,
        pelvisRotX: 0.08,
        torsoRotX: 0.30,
        torsoRotY: -0.32 * scale.twistScale * f,
        lShX: -1.10,
        lElbX: -1.68,
        rShX: -1.04,
        rElbX: -1.76,
        lHipX: -1.04 * scale.kneeBendScale,
        lKneeX: 1.58 * scale.kneeBendScale,
        rHipX: -0.90 * scale.kneeBendScale,
        rKneeX: 1.46 * scale.kneeBendScale,
        snapRate: 24,
      };
    }

    case 'block': {
      return {
        ...guard,
        pelvisX: -0.08,
        pelvisY: basePelvisY - 0.12 * scale.kneeBendScale,
        torsoRotX: -0.10,
        torsoRotY: -0.20 * scale.twistScale * f,
        headRotX: 0.08,
        lShX: -1.46,
        lShY: 0.30,
        lShZ: 0.34 - scale.guardSpread * 0.5,
        lElbX: -1.72,
        lElbZ: 0.36,
        rShX: -1.50,
        rShY: -0.30,
        rShZ: -0.34 + scale.guardSpread * 0.5,
        rElbX: -1.76,
        rElbZ: -0.36,
        lHipX: -0.40 * scale.kneeBendScale,
        lKneeX: 0.56 * scale.kneeBendScale,
        rHipX: 0.40 * scale.kneeBendScale,
        rKneeX: 0.50 * scale.kneeBendScale,
        snapRate: 28,
      };
    }

    case 'punch': {
      if (state.comboStep === 0) {
        // HIT 1 — SNAPPY LEAD JAB:
        // Fast anticipation coil -> explosive ease-out snap (lead elbow 95° -> 5° straight out,
        // sharp torso twist, rear hand stays tight at chin, forward step) -> 50ms impact hold -> recovery
        const impactPose: Partial<CombatPose> = {
          pelvisX: 0.16 * scale.limbReach,
          pelvisY: guard.pelvisY - 0.03,
          pelvisRotY: 0.24 * scale.twistScale,
          torsoRotX: 0.14,
          torsoRotY: 0.54 * scale.twistScale,
          headRotY: -0.44 * scale.twistScale,
          // Front (left) elbow snaps from ~95° (-1.64) to ~5° (-0.08) straight out!
          lShX: -1.64 * scale.limbReach,
          lShY: -0.18,
          lShZ: 0.08,
          lElbX: -0.08,
          lElbZ: 0.02,
          // Rear (right) fist stays tight at chin guard!
          rShX: -1.08,
          rShY: -0.24,
          rShZ: 0.20 + scale.guardSpread,
          rElbX: -1.84,
          rElbZ: -0.24,
          // Crisp forward step into jab
          lHipX: -0.48 * scale.kneeBendScale,
          lKneeX: 0.56 * scale.kneeBendScale,
          rHipX: 0.38 * scale.kneeBendScale,
          rKneeX: 0.36 * scale.kneeBendScale,
          snapRate: 36,
        };
        const frames: PoseKeyframe[] = [
          { t: 0.0, pose: {} },
          {
            t: 0.18,
            ease: 'easeInQuad',
            pose: {
              pelvisX: -0.05,
              pelvisRotY: -0.28 * scale.twistScale,
              torsoRotY: -0.32 * scale.twistScale,
              lShX: -0.88,
              lElbX: -1.86,
              rShX: -1.06,
              rElbX: -1.82,
              snapRate: 34,
            },
          },
          { t: 0.34, ease: 'easeOutExpo', pose: impactPose },
          { t: 0.52, ease: 'hold', pose: impactPose },
          { t: 1.0, ease: 'smooth', pose: { snapRate: 24 } },
        ];
        return sampleKeyframeTrack(guard, frames, atkProgress);
      }

      if (state.comboStep === 1) {
        // HIT 2 — TWISTING POWER CROSS:
        // pelvisGroup + torsoGroup rotate ~55° into strike, rear elbow snaps straight across (~5°),
        // front knee bends into deep lunge -> 50ms impact hold -> recovery
        const impactPose: Partial<CombatPose> = {
          pelvisX: 0.26 * scale.limbReach,
          pelvisY: guard.pelvisY - 0.07 * scale.kneeBendScale,
          pelvisRotY: -0.48 * scale.twistScale,
          torsoRotX: 0.22,
          torsoRotY: -0.96 * scale.twistScale, // ~55° power cross torso torque!
          headRotY: 0.84 * scale.twistScale,
          // Rear (right) arm fires straight across (~5° elbow extension)
          rShX: -1.70 * scale.limbReach,
          rShY: 0.20,
          rShZ: -0.08,
          rElbX: -0.07,
          rElbZ: 0.0,
          // Lead (left) arm tucks tight at cheek guard
          lShX: -1.06,
          lShY: 0.26,
          lShZ: -0.16 - scale.guardSpread,
          lElbX: -1.84,
          lElbZ: 0.24,
          // Deep forward lunge on bent front knee
          lHipX: -0.68 * scale.kneeBendScale,
          lKneeX: 0.82 * scale.kneeBendScale,
          rHipX: 0.62 * scale.kneeBendScale,
          rKneeX: 0.26 * scale.kneeBendScale,
          snapRate: 36,
        };
        const frames: PoseKeyframe[] = [
          { t: 0.0, pose: {} },
          {
            t: 0.20,
            ease: 'easeInQuad',
            pose: {
              pelvisX: -0.06,
              pelvisRotY: 0.34 * scale.twistScale,
              torsoRotX: -0.06,
              torsoRotY: 0.44 * scale.twistScale,
              rShX: -0.62,
              rShZ: 0.48 + scale.guardSpread,
              rElbX: -1.92,
              lHipX: -0.42 * scale.kneeBendScale,
              lKneeX: 0.56 * scale.kneeBendScale,
              snapRate: 34,
            },
          },
          { t: 0.38, ease: 'easeOutExpo', pose: impactPose },
          { t: 0.56, ease: 'hold', pose: impactPose },
          { t: 1.0, ease: 'smooth', pose: { snapRate: 24 } },
        ];
        return sampleKeyframeTrack(guard, frames, atkProgress);
      }

      // HIT 3 — RISING UPPERCUT FINISHER:
      // pelvisGroup dips low then explodes upward with full upper-body twist and curved 90° elbow uppercut!
      const impactPose: Partial<CombatPose> = {
        pelvisX: 0.28 * scale.limbReach,
        pelvisY: guard.pelvisY + 0.16 * scale.limbReach,
        pelvisRotY: -0.58 * scale.twistScale,
        torsoRotX: -0.34,
        torsoRotY: -0.92 * scale.twistScale,
        torsoRotZ: -0.16,
        headRotX: -0.16,
        headRotY: 0.82 * scale.twistScale,
        // Curved ~90° elbow (-1.54 rad) driving skyward in an explosive rising uppercut!
        rShX: -2.56 * scale.limbReach,
        rShY: 0.22,
        rShZ: 0.14,
        rElbX: -1.54,
        rElbZ: -0.22,
        // Left arm rips back for explosive upper-body torque
        lShX: 0.42,
        lShZ: -0.42 - scale.guardSpread,
        lElbX: -1.52,
        lElbZ: 0.14,
        // Explosive upward leg drive out of deep dip
        lHipX: -0.30,
        lKneeX: 0.16,
        rHipX: 0.42,
        rKneeX: 0.16,
        snapRate: 36,
      };
      const frames: PoseKeyframe[] = [
        { t: 0.0, pose: {} },
        {
          t: 0.22,
          ease: 'easeInQuad',
          pose: {
            pelvisX: -0.06,
            pelvisY: guard.pelvisY - 0.24 * scale.kneeBendScale,
            pelvisRotY: 0.40 * scale.twistScale,
            torsoRotX: 0.36,
            torsoRotY: 0.56 * scale.twistScale,
            torsoRotZ: 0.14,
            headRotX: 0.12,
            rShX: 0.36,
            rShZ: 0.44 + scale.guardSpread,
            rElbX: -1.42,
            lShX: -1.12,
            lElbX: -1.76,
            lHipX: -0.84 * scale.kneeBendScale,
            lKneeX: 1.24 * scale.kneeBendScale,
            rHipX: -0.42 * scale.kneeBendScale,
            rKneeX: 1.18 * scale.kneeBendScale,
            snapRate: 34,
          },
        },
        { t: 0.44, ease: 'easeOutExpo', pose: impactPose },
        { t: 0.62, ease: 'hold', pose: impactPose },
        { t: 1.0, ease: 'smooth', pose: { snapRate: 22 } },
      ];
      return sampleKeyframeTrack(guard, frames, atkProgress);
    }

    case 'kick': {
      if (state.comboStep === 1) {
        // HIT 2 — SIDE / ROUNDHOUSE KICK (Camera-open martial-arts silhouette for both P1 and CPU):
        // pelvisGroup pivots ~80° (-1.38 * f) sideways OPEN toward camera on bent standing knee,
        // torso leans away ~35° (+0.61 * f) for counterbalance, kicking leg whips straight toward opponent!
        const isP1 = f === 1;
        const chamberPose: Partial<CombatPose> = {
          pelvisX: 0.06,
          pelvisY: guard.pelvisY - 0.04 * scale.kneeBendScale,
          pelvisRotY: -1.04 * f * scale.twistScale,
          pelvisRotZ: 0.14 * f,
          torsoRotX: -0.06,
          torsoRotY: 0.20 * f * scale.twistScale,
          torsoRotZ: 0.36 * f,
          headRotY: 0.92 * f * scale.twistScale,
          // Standing leg bent firmly; kicking leg chambered tightly sideways
          ...(isP1
            ? {
                lHipX: -0.22 * scale.kneeBendScale,
                lHipY: 0.35,
                lKneeX: 0.50 * scale.kneeBendScale,
                rHipX: -0.34,
                rHipY: -0.22,
                rHipZ: 1.24 * scale.limbReach,
                rKneeX: 1.84,
              }
            : {
                rHipX: -0.22 * scale.kneeBendScale,
                rHipY: -0.35,
                rKneeX: 0.50 * scale.kneeBendScale,
                lHipX: -0.34,
                lHipY: 0.22,
                lHipZ: -1.24 * scale.limbReach,
                lKneeX: 1.84,
              }),
          // Guard arms tucked tight for rotational balance
          lShX: -1.22,
          lShZ: -0.34 - scale.guardSpread,
          lElbX: -1.72,
          rShX: -0.96,
          rShZ: 0.36 + scale.guardSpread,
          rElbX: -1.66,
          snapRate: 34,
        };
        const impactPose: Partial<CombatPose> = {
          pelvisX: 0.20 * scale.limbReach,
          pelvisY: guard.pelvisY + 0.03,
          pelvisRotY: -1.38 * f * scale.twistScale, // ~80° sideways hip pivot open to camera!
          pelvisRotZ: 0.22 * f,
          torsoRotX: -0.08,
          torsoRotY: 0.26 * f * scale.twistScale,
          torsoRotZ: 0.61 * f, // ~35° counter-lean away from kicking leg!
          headRotX: 0.06,
          headRotY: 1.12 * f * scale.twistScale,
          ...(isP1
            ? {
                lHipX: -0.18 * scale.kneeBendScale,
                lHipY: 0.48,
                lKneeX: 0.42 * scale.kneeBendScale,
                // Kicking leg whips straight out horizontally at chest/head height toward opponent!
                rHipX: -0.14,
                rHipY: -0.18,
                rHipZ: 1.62 * scale.limbReach,
                rKneeX: 0.04,
              }
            : {
                rHipX: -0.18 * scale.kneeBendScale,
                rHipY: -0.48,
                rKneeX: 0.42 * scale.kneeBendScale,
                lHipX: -0.14,
                lHipY: 0.18,
                lHipZ: -1.62 * scale.limbReach,
                lKneeX: 0.04,
              }),
          lShX: -1.26,
          lShZ: -0.40 - scale.guardSpread,
          lElbX: -1.74,
          rShX: -0.82,
          rShZ: 0.44 + scale.guardSpread,
          rElbX: -1.58,
          snapRate: 38,
        };
        const rechamberPose: Partial<CombatPose> = {
          ...chamberPose,
          pelvisRotY: -0.86 * f * scale.twistScale,
          ...(isP1
            ? { rHipZ: 1.05 * scale.limbReach, rKneeX: 1.56 }
            : { lHipZ: -1.05 * scale.limbReach, lKneeX: 1.56 }),
          snapRate: 28,
        };
        const frames: PoseKeyframe[] = [
          { t: 0.0, pose: {} },
          { t: 0.20, ease: 'easeInQuad', pose: chamberPose },
          { t: 0.38, ease: 'easeOutExpo', pose: impactPose },
          { t: 0.56, ease: 'hold', pose: impactPose },
          { t: 0.76, ease: 'smooth', pose: rechamberPose },
          { t: 1.0, ease: 'smooth', pose: { snapRate: 22 } },
        ];
        return sampleKeyframeTrack(guard, frames, atkProgress);
      }

      if (state.comboStep >= 2) {
        // HIT 3 — JUMPING SPINNING KICK FINISHER:
        // Airborne hop-kick with mid-air spin opening heroically toward camera, extended launching leg, tucked support knee!
        const isP1 = f === 1;
        const impactPose: Partial<CombatPose> = {
          pelvisX: 0.32 * scale.limbReach,
          pelvisY: guard.pelvisY + 0.34 * scale.limbReach,
          pelvisRotY: -1.48 * f * scale.twistScale, // Explosive mid-air spin open toward camera!
          pelvisRotZ: 0.26 * f,
          torsoRotX: -0.14,
          torsoRotY: 0.30 * f * scale.twistScale,
          torsoRotZ: 0.42 * f,
          headRotY: 1.06 * f * scale.twistScale,
          lShX: -1.24,
          lShZ: -0.38 - scale.guardSpread,
          lElbX: -1.68,
          rShX: -0.78,
          rShZ: 0.46 + scale.guardSpread,
          rElbX: -1.54,
          ...(isP1
            ? {
                rHipX: -0.26,
                rHipY: -0.22,
                rHipZ: 1.58 * scale.limbReach,
                rKneeX: 0.04,
                lHipX: -0.84 * scale.kneeBendScale,
                lKneeX: 1.54 * scale.kneeBendScale,
              }
            : {
                lHipX: -0.26,
                lHipY: 0.22,
                lHipZ: -1.58 * scale.limbReach,
                lKneeX: 0.04,
                rHipX: -0.84 * scale.kneeBendScale,
                rKneeX: 1.54 * scale.kneeBendScale,
              }),
          snapRate: 38,
        };
        const frames: PoseKeyframe[] = [
          { t: 0.0, pose: {} },
          {
            t: 0.18,
            ease: 'easeInQuad',
            pose: {
              pelvisX: -0.06,
              pelvisY: guard.pelvisY - 0.16 * scale.kneeBendScale,
              pelvisRotY: 0.56 * f * scale.twistScale,
              torsoRotX: 0.24,
              torsoRotY: 0.44 * f * scale.twistScale,
              lHipX: -0.68 * scale.kneeBendScale,
              lKneeX: 1.08 * scale.kneeBendScale,
              rHipX: -0.52 * scale.kneeBendScale,
              rKneeX: 1.24 * scale.kneeBendScale,
              snapRate: 34,
            },
          },
          { t: 0.42, ease: 'easeOutExpo', pose: impactPose },
          { t: 0.62, ease: 'hold', pose: impactPose },
          {
            t: 0.80,
            ease: 'smooth',
            pose: {
              pelvisX: 0.14,
              pelvisY: guard.pelvisY + 0.08,
              pelvisRotY: -0.65 * f * scale.twistScale,
              torsoRotX: -0.08,
              rHipX: -0.88,
              rKneeX: 1.38,
              lHipX: -0.48,
              lKneeX: 0.88,
              snapRate: 26,
            },
          },
          { t: 1.0, ease: 'smooth', pose: { snapRate: 22 } },
        ];
        return sampleKeyframeTrack(guard, frames, atkProgress);
      }

      // HIT 1 — CHAMBERED FRONT SNAP KICK (3 distinct martial-arts phases):
      // Phase 1: Chamber thigh high (knee bent ~110° = 1.92 rad) while torso leans back ~25° (-0.44 rad)
      // Phase 2: Snap knee straight (0° -> 0.04 rad) into opponent's chest + 50ms impact hold
      // Phase 3: Rechamber knee tightly before setting foot down cleanly into guard!
      const chamberPose: Partial<CombatPose> = {
        pelvisX: 0.06,
        pelvisY: guard.pelvisY + 0.02,
        pelvisRotY: -0.24 * f * scale.twistScale, // Stays open toward camera!
        pelvisRotZ: 0.10 * f,
        torsoRotX: -0.44, // ~25° backward lean for authentic counter-balance!
        torsoRotY: -0.18 * f * scale.twistScale,
        headRotX: 0.16,
        headRotY: 0.36 * f * scale.twistScale,
        lShX: -1.24,
        lShZ: -0.32 - scale.guardSpread,
        lElbX: -1.72,
        rShX: -0.94,
        rShZ: 0.36 + scale.guardSpread,
        rElbX: -1.64,
        // Thigh raised high, knee tightly chambered ~110° (1.92 rad)!
        rHipX: -1.52 * scale.limbReach,
        rHipY: 0.08,
        rHipZ: 0.10,
        rKneeX: 1.92,
        // Standing leg planted slightly bent
        lHipX: 0.14,
        lKneeX: 0.24 * scale.kneeBendScale,
        snapRate: 34,
      };
      const impactPose: Partial<CombatPose> = {
        ...chamberPose,
        pelvisX: 0.20 * scale.limbReach,
        pelvisY: guard.pelvisY + 0.05,
        pelvisRotY: -0.32 * f * scale.twistScale,
        pelvisRotZ: 0.14 * f,
        torsoRotX: -0.44,
        // Knee snaps straight (0° / 0.04 rad) straight into opponent's chest!
        rHipX: -1.84 * scale.limbReach,
        rHipZ: 0.14,
        rKneeX: 0.04,
        lHipX: 0.18,
        lKneeX: 0.20 * scale.kneeBendScale,
        snapRate: 38,
      };
      const rechamberPose: Partial<CombatPose> = {
        ...chamberPose,
        pelvisX: 0.08,
        torsoRotX: -0.26,
        rHipX: -1.32 * scale.limbReach,
        rKneeX: 1.62,
        snapRate: 28,
      };
      const frames: PoseKeyframe[] = [
        { t: 0.0, pose: {} },
        { t: 0.22, ease: 'easeInQuad', pose: chamberPose },
        { t: 0.38, ease: 'easeOutExpo', pose: impactPose },
        { t: 0.54, ease: 'hold', pose: impactPose },
        { t: 0.74, ease: 'smooth', pose: rechamberPose },
        { t: 1.0, ease: 'smooth', pose: { snapRate: 22 } },
      ];
      return sampleKeyframeTrack(guard, frames, atkProgress);
    }

    case 'sweep': {
      // CLASSIC LOW KUNG-FU SWEEP (Camera-open martial-arts floor sweep):
      // pelvisGroup drops near floor, one knee tucks deep, torso leans over balancing hand,
      // and the sweeping leg whips straight along the ground directly at the opponent's ankles!
      const isP1 = f === 1;
      const dropPose: Partial<CombatPose> = {
        pelvisX: 0.08,
        pelvisY: guard.pelvisY - 0.44 * scale.kneeBendScale,
        pelvisRotX: -0.08,
        pelvisRotY: -0.82 * f * scale.twistScale,
        pelvisRotZ: 0.16 * f,
        torsoRotX: -0.10,
        torsoRotY: 0.16 * f * scale.twistScale,
        torsoRotZ: 0.28 * f,
        headRotY: 0.72 * f * scale.twistScale,
        ...(isP1
          ? {
              // Left balancing hand braces down toward ground; right arm guards chest
              lShX: 0.18,
              lShZ: -0.82 - scale.guardSpread,
              lElbX: -0.16,
              rShX: -0.86,
              rShZ: 0.44 + scale.guardSpread,
              rElbX: -1.48,
              lHipX: -1.10 * scale.kneeBendScale,
              lKneeX: 1.78 * scale.kneeBendScale,
              rHipX: -0.32,
              rHipZ: 0.78,
              rKneeX: 1.24,
            }
          : {
              rShX: 0.18,
              rShZ: 0.82 + scale.guardSpread,
              rElbX: -0.16,
              lShX: -0.86,
              lShZ: -0.44 - scale.guardSpread,
              lElbX: -1.48,
              rHipX: -1.10 * scale.kneeBendScale,
              rKneeX: 1.78 * scale.kneeBendScale,
              lHipX: -0.32,
              lHipZ: -0.78,
              lKneeX: 1.24,
            }),
        snapRate: 34,
      };
      const impactPose: Partial<CombatPose> = {
        pelvisX: 0.22 * scale.limbReach,
        pelvisY: guard.pelvisY - 0.46 * scale.kneeBendScale,
        pelvisRotX: -0.12,
        pelvisRotY: -1.18 * f * scale.twistScale, // Chest stays open toward camera!
        pelvisRotZ: 0.24 * f,
        torsoRotX: -0.12,
        torsoRotY: 0.24 * f * scale.twistScale,
        torsoRotZ: 0.44 * f, // Leans back over balancing hand!
        headRotY: 0.96 * f * scale.twistScale,
        ...(isP1
          ? {
              lShX: 0.22,
              lShZ: -0.96 - scale.guardSpread,
              lElbX: -0.12,
              rShX: -0.72,
              rShZ: 0.56 + scale.guardSpread,
              rElbX: -1.24,
              // Deep tucked base knee
              lHipX: -1.12 * scale.kneeBendScale,
              lKneeX: 1.82 * scale.kneeBendScale,
              // Sweeping leg whips completely straight along floor straight at opponent!
              rHipX: -0.22,
              rHipY: -0.14,
              rHipZ: 1.32 * scale.limbReach,
              rKneeX: 0.04,
            }
          : {
              rShX: 0.22,
              rShZ: 0.96 + scale.guardSpread,
              rElbX: -0.12,
              lShX: -0.72,
              lShZ: -0.56 - scale.guardSpread,
              lElbX: -1.24,
              rHipX: -1.12 * scale.kneeBendScale,
              rKneeX: 1.82 * scale.kneeBendScale,
              lHipX: -0.22,
              lHipY: 0.14,
              lHipZ: -1.32 * scale.limbReach,
              lKneeX: 0.04,
            }),
        snapRate: 38,
      };
      const frames: PoseKeyframe[] = [
        { t: 0.0, pose: {} },
        { t: 0.20, ease: 'easeInQuad', pose: dropPose },
        { t: 0.40, ease: 'easeOutExpo', pose: impactPose },
        { t: 0.60, ease: 'hold', pose: impactPose },
        { t: 1.0, ease: 'smooth', pose: { snapRate: 22 } },
      ];
      return sampleKeyframeTrack(guard, frames, atkProgress);
    }

    case 'grab': {
      // PHYSICAL KUNG-FU GRAB REACH & CLINCH (with whiff recoil if missed):
      // Both elbows reach forward to lock onto opponent's shoulders/collar while stepping in close.
      const reachPose: Partial<CombatPose> = {
        pelvisX: 0.30 * scale.limbReach,
        pelvisY: guard.pelvisY - 0.08 * scale.kneeBendScale,
        pelvisRotY: 0,
        torsoRotX: 0.30,
        torsoRotY: 0,
        headRotY: 0,
        lShX: -1.62 * scale.limbReach,
        lShY: 0.24,
        lShZ: 0.22,
        lElbX: -0.34,
        lElbZ: 0.24,
        rShX: -1.62 * scale.limbReach,
        rShY: -0.24,
        rShZ: -0.22,
        rElbX: -0.34,
        rElbZ: -0.24,
        lHipX: -0.56 * scale.kneeBendScale,
        lKneeX: 0.68 * scale.kneeBendScale,
        rHipX: 0.48 * scale.kneeBendScale,
        rKneeX: 0.38 * scale.kneeBendScale,
        snapRate: 32,
      };
      const whiffRecoil: Partial<CombatPose> = {
        pelvisX: 0.08,
        pelvisY: guard.pelvisY - 0.04,
        torsoRotX: -0.18,
        torsoRotY: 0,
        lShX: -1.26,
        lShZ: -0.58 - scale.guardSpread,
        lElbX: -0.68,
        rShX: -1.26,
        rShZ: 0.58 + scale.guardSpread,
        rElbX: -0.68,
        snapRate: 22,
      };
      const frames: PoseKeyframe[] = [
        { t: 0.0, pose: {} },
        { t: 0.26, ease: 'easeOutExpo', pose: reachPose },
        { t: 0.44, ease: 'hold', pose: reachPose },
        { t: 0.72, ease: 'smooth', pose: whiffRecoil },
        { t: 1.0, ease: 'smooth', pose: { snapRate: 20 } },
      ];
      return sampleKeyframeTrack(guard, frames, atkProgress);
    }

    case 'grab_hold': {
      // PHYSICAL KUNG-FU HIP-THROW / SLAM:
      // 1) Clinch lock & deep knee bend -> 2) Pivot pelvisGroup 180° hoisting opponent across hip ->
      // 3) Violently slam opponent backward onto floor -> 4) Unwind cleanly to guard!
      const clinchDrop: Partial<CombatPose> = {
        pelvisX: 0.20,
        pelvisY: guard.pelvisY - 0.16 * scale.kneeBendScale,
        pelvisRotY: 0.52 * scale.twistScale,
        torsoRotX: 0.24,
        torsoRotY: 0.24 * scale.twistScale,
        headRotY: -0.25,
        lShX: -1.55,
        lShZ: 0.26,
        lElbX: -0.88,
        rShX: -1.55,
        rShZ: -0.26,
        rElbX: -0.88,
        lHipX: -0.74 * scale.kneeBendScale,
        lKneeX: 1.08 * scale.kneeBendScale,
        rHipX: -0.44 * scale.kneeBendScale,
        rKneeX: 0.98 * scale.kneeBendScale,
        snapRate: 30,
      };
      const hipPivot180: Partial<CombatPose> = {
        pelvisX: 0.06,
        pelvisY: guard.pelvisY + 0.06,
        pelvisRotY: Math.PI * scale.twistScale, // Full 180° kung-fu hip-throw pivot!
        pelvisRotX: 0.18,
        torsoRotX: 0.34,
        torsoRotY: 0.18,
        headRotY: -0.35,
        // Arms haul opponent up & across shoulder/hip!
        lShX: -2.28 * scale.limbReach,
        lShZ: 0.16,
        lElbX: -1.12,
        rShX: -2.28 * scale.limbReach,
        rShZ: -0.16,
        rElbX: -1.12,
        // Legs drive upward lifting opponent off the ground!
        lHipX: -0.38 * scale.kneeBendScale,
        lKneeX: 0.42 * scale.kneeBendScale,
        rHipX: 0.28 * scale.kneeBendScale,
        rKneeX: 0.36 * scale.kneeBendScale,
        snapRate: 32,
      };
      const slamFinish: Partial<CombatPose> = {
        pelvisX: 0.30 * scale.limbReach,
        pelvisY: guard.pelvisY - 0.10 * scale.kneeBendScale,
        pelvisRotY: Math.PI * 0.82 * scale.twistScale,
        pelvisRotX: 0.22,
        torsoRotX: 0.66, // Explosive forward throw slam!
        torsoRotY: -0.38 * scale.twistScale,
        headRotX: -0.22,
        lShX: -1.24 * scale.limbReach,
        lShZ: -0.24,
        lElbX: -0.18,
        rShX: -1.24 * scale.limbReach,
        rShZ: 0.24,
        rElbX: -0.18,
        lHipX: -0.66 * scale.kneeBendScale,
        lKneeX: 0.80 * scale.kneeBendScale,
        rHipX: 0.54 * scale.kneeBendScale,
        rKneeX: 0.36 * scale.kneeBendScale,
        snapRate: 36,
      };
      const frames: PoseKeyframe[] = [
        { t: 0.0, pose: clinchDrop },
        { t: 0.28, ease: 'easeInQuad', pose: clinchDrop },
        { t: 0.54, ease: 'easeOutCubic', pose: hipPivot180 },
        { t: 0.74, ease: 'easeOutExpo', pose: slamFinish },
        { t: 0.84, ease: 'hold', pose: slamFinish },
        { t: 1.0, ease: 'smooth', pose: { snapRate: 22 } },
      ];
      return sampleKeyframeTrack(guard, frames, atkProgress);
    }

    case 'grabbed': {
      // Hoisted across attacker's hip and flipped upside-down before slam into knockdown!
      const frames: PoseKeyframe[] = [
        {
          t: 0.0,
          pose: {
            pelvisY: basePelvisY + 0.04,
            pelvisRotX: -0.24,
            torsoRotX: -0.28,
            lShX: -1.78,
            lShZ: -0.68,
            lElbX: -0.52,
            rShX: -1.78,
            rShZ: 0.68,
            rElbX: -0.52,
            lHipX: -0.44,
            lKneeX: 0.86,
            rHipX: -0.26,
            rKneeX: 0.78,
            snapRate: 28,
          },
        },
        {
          t: 0.52,
          ease: 'easeOutCubic',
          pose: {
            pelvisY: basePelvisY + 0.14,
            pelvisRotX: -1.22, // Hoisted horizontally over attacker's hip!
            pelvisRotZ: 0.28,
            torsoRotX: -0.36,
            headRotX: -0.34,
            lShX: -2.18,
            lShZ: -0.92,
            lElbX: -0.32,
            rShX: -1.92,
            rShZ: 0.92,
            rElbX: -0.32,
            lHipX: -0.78,
            lKneeX: 1.18,
            rHipX: -0.38,
            rKneeX: 0.94,
            snapRate: 28,
          },
        },
        {
          t: 1.0,
          ease: 'easeInQuad',
          pose: {
            pelvisY: basePelvisY + 0.04,
            pelvisRotX: -Math.PI * 0.48,
            pelvisRotZ: -0.24,
            torsoRotX: -0.22,
            lShX: -2.02,
            lShZ: -0.84,
            lElbX: -0.28,
            rShX: -1.86,
            rShZ: 0.84,
            rElbX: -0.28,
            lHipX: 0.18,
            lKneeX: 0.34,
            rHipX: -0.14,
            rKneeX: 0.28,
            snapRate: 30,
          },
        },
      ];
      return sampleKeyframeTrack(guard, frames, atkProgress);
    }

    case 'hit': {
      // Explosive snap-back stagger -> brief pain hold -> elastic spring back into guard
      const hitProg = clamp01(state.actionTimer / 0.26);
      const recoilPose: Partial<CombatPose> = {
        pelvisX: -0.18,
        pelvisY: guard.pelvisY - 0.05,
        pelvisRotZ: 0.14,
        torsoRotX: -0.54,
        torsoRotY: 0.28 * scale.twistScale,
        headRotX: -0.46,
        headRotZ: 0.18,
        lShX: -1.44,
        lShZ: -0.82,
        lElbX: -0.46,
        rShX: -1.44,
        rShZ: 0.82,
        rElbX: -0.46,
        lHipX: -0.20,
        rHipX: 0.38,
        snapRate: 34,
      };
      const frames: PoseKeyframe[] = [
        { t: 0.0, pose: {} },
        { t: 0.28, ease: 'easeOutExpo', pose: recoilPose },
        { t: 0.46, ease: 'hold', pose: recoilPose },
        { t: 1.0, ease: 'smooth', pose: { snapRate: 24 } },
      ];
      return sampleKeyframeTrack(guard, frames, hitProg);
    }

    case 'knockdown': {
      // Mid-air pelvis rotation -> lands flat on back with naturally bent limbs!
      const airborne = state.y > 0.08;
      if (airborne) {
        const airT = clamp01(state.actionTimer / 0.38);
        const airFrames: PoseKeyframe[] = [
          {
            t: 0.0,
            pose: {
              pelvisY: basePelvisY * 0.92,
              pelvisRotX: -0.38,
              pelvisRotY: 0,
              pelvisRotZ: 0.12,
              torsoRotX: -0.36,
              torsoRotY: 0,
              headRotX: -0.30,
              headRotY: 0,
              lShX: -1.96,
              lShZ: -0.78,
              lElbX: -0.42,
              rShX: -1.80,
              rShZ: 0.78,
              rElbX: -0.42,
              lHipX: -0.56,
              lKneeX: 0.74,
              rHipX: -0.36,
              rKneeX: 0.56,
              snapRate: 20,
            },
          },
          {
            t: 1.0,
            ease: 'easeOutCubic',
            pose: {
              pelvisY: scale.flatPelvisY + 0.24,
              pelvisRotX: -Math.PI * 0.46,
              pelvisRotY: 0,
              pelvisRotZ: 0.10,
              torsoRotX: -0.14,
              torsoRotY: 0,
              headRotX: -0.16,
              headRotY: 0,
              lShX: -1.84,
              lShZ: -0.82,
              lElbX: -0.36,
              rShX: -1.68,
              rShZ: 0.82,
              rElbX: -0.36,
              lHipX: 0.14,
              lKneeX: 0.30,
              rHipX: -0.10,
              rKneeX: 0.26,
              snapRate: 18,
            },
          },
        ];
        return sampleKeyframeTrack(guard, airFrames, airT);
      }
      // Flat on back on arena floor with naturally bent knees & elbows
      return {
        ...guard,
        pelvisY: scale.flatPelvisY,
        pelvisRotX: -Math.PI * 0.48,
        pelvisRotY: 0,
        pelvisRotZ: 0.10,
        torsoRotX: -0.05,
        torsoRotY: 0,
        headRotX: 0.08,
        headRotY: 0,
        lShX: -1.76,
        lShZ: -0.84,
        lElbX: -0.36,
        lElbZ: 0.08,
        rShX: -1.58,
        rShZ: 0.84,
        rElbX: -0.36,
        rElbZ: -0.08,
        lHipX: 0.14,
        lHipY: -0.10,
        lHipZ: -0.16,
        lKneeX: 0.28,
        rHipX: -0.10,
        rHipY: 0.10,
        rHipZ: 0.16,
        rKneeX: 0.24,
        snapRate: 18,
      };
    }

    case 'getup': {
      // 2-STAGE GET-UP (Multi-Keyframe Track):
      // Stage 1 (0.00..0.48): Push up from flat on back onto bent knees & braced hands!
      // Stage 2 (0.48..1.00): Rise smoothly from crouched base back into active kung-fu guard!
      const crouchPelvisY = basePelvisY - 0.36 * scale.kneeBendScale;
      const flatStart: Partial<CombatPose> = {
        pelvisX: -0.08,
        pelvisY: scale.flatPelvisY,
        pelvisRotX: -Math.PI * 0.48,
        pelvisRotY: 0,
        pelvisRotZ: 0.10,
        torsoRotX: -0.05,
        torsoRotY: 0,
        headRotX: 0.08,
        headRotY: 0,
        lShX: -1.76,
        lShZ: -0.84,
        lElbX: -0.36,
        rShX: -1.58,
        rShZ: 0.84,
        rElbX: -0.36,
        lHipX: 0.14,
        lKneeX: 0.28,
        rHipX: -0.10,
        rKneeX: 0.24,
        snapRate: 18,
      };
      const kneesAndHandsPush: Partial<CombatPose> = {
        pelvisX: 0.04,
        pelvisY: crouchPelvisY,
        pelvisRotX: 0.20,
        pelvisRotY: guard.pelvisRotY * 0.5,
        pelvisRotZ: 0,
        torsoRotX: 0.68,
        torsoRotY: guard.torsoRotY * 0.5,
        headRotX: -0.32,
        headRotY: guard.headRotY * 0.6,
        // Hands press down bracing torso off arena floor
        lShX: -0.86,
        lShZ: -0.36 - scale.guardSpread,
        lElbX: -0.36,
        rShX: -0.86,
        rShZ: 0.36 + scale.guardSpread,
        rElbX: -0.36,
        // Knees tucked tightly underneath in crouched push-up base
        lHipX: -1.18 * scale.kneeBendScale,
        lKneeX: 1.74 * scale.kneeBendScale,
        rHipX: -1.04 * scale.kneeBendScale,
        rKneeX: 1.64 * scale.kneeBendScale,
        snapRate: 18,
      };
      const halfRise: Partial<CombatPose> = {
        pelvisX: 0.02,
        pelvisY: (crouchPelvisY + guard.pelvisY) * 0.5 + 0.03,
        pelvisRotX: 0.10,
        pelvisRotY: guard.pelvisRotY * 0.8,
        torsoRotX: 0.28,
        torsoRotY: guard.torsoRotY * 0.8,
        headRotX: -0.14,
        headRotY: guard.headRotY * 0.85,
        lShX: -1.04,
        lElbX: -1.24,
        rShX: -0.96,
        rElbX: -1.32,
        lHipX: -0.68 * scale.kneeBendScale,
        lKneeX: 0.96 * scale.kneeBendScale,
        rHipX: -0.18 * scale.kneeBendScale,
        rKneeX: 0.88 * scale.kneeBendScale,
        snapRate: 20,
      };
      const frames: PoseKeyframe[] = [
        { t: 0.0, pose: flatStart },
        { t: 0.48, ease: 'easeInOutCubic', pose: kneesAndHandsPush },
        { t: 0.76, ease: 'smooth', pose: halfRise },
        { t: 1.0, ease: 'easeOutCubic', pose: { snapRate: 20 } },
      ];
      return sampleKeyframeTrack(guard, frames, atkProgress);
    }

    case 'ko': {
      return {
        ...guard,
        pelvisY: scale.flatPelvisY,
        pelvisRotX: -Math.PI * 0.47,
        pelvisRotY: 0,
        pelvisRotZ: 0.16,
        torsoRotX: -0.06,
        torsoRotY: 0,
        headRotZ: 0.22,
        lShX: -1.85,
        lShZ: -0.80,
        lElbX: -0.36,
        rShX: -1.55,
        rShZ: 0.80,
        rElbX: -0.36,
        lHipX: 0.2,
        rHipX: -0.15,
        lKneeX: 0.28,
        rKneeX: 0.24,
        snapRate: 12,
      };
    }

    case 'victory': {
      const pump = Math.sin(elapsed * 7.2);
      return {
        ...guard,
        pelvisY: basePelvisY + Math.abs(pump) * 0.14,
        pelvisRotY: 0,
        torsoRotX: -0.1,
        torsoRotY: 0,
        headRotY: 0,
        lShX: -2.55 + pump * 0.26,
        lShZ: -0.32,
        lElbX: -0.35,
        rShX: -2.55 - pump * 0.26,
        rShZ: 0.32,
        rElbX: -0.35,
        lHipX: 0.08,
        rHipX: -0.08,
        lKneeX: 0.14,
        rKneeX: 0.14,
        snapRate: 16,
      };
    }

    default: {
      // 'special' and 'super' are driven by fighter-specific choreography in rig.ts
      const snap = Math.sin(atkProgress * Math.PI);
      return {
        ...guard,
        torsoRotX: 0.32 * snap,
        torsoRotY: -0.52 * snap,
        rShX: -1.65,
        rElbX: -0.15,
        lShX: 0.35,
        snapRate: 24,
      };
    }
  }
}
