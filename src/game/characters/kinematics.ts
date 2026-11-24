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
  rShX: number;
  rShY: number;
  rShZ: number;
  rElbX: number;
  lHipX: number;
  lHipZ: number;
  lKneeX: number;
  rHipX: number;
  rHipZ: number;
  rKneeX: number;
  snapRate: number;
}

export interface StrikePhaseWeights {
  windup: number;
  strike: number;
  recover: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - (1 - c) * (1 - c) * (1 - c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Evaluates a crisp 3-stage martial-arts keyframe curve:
 * Wind-Up (0..windupEnd) -> Snappy Strike (windupEnd..strikeEnd) -> Recovery (strikeEnd..1).
 * Returns normalized weights for blending wind-up coil, peak impact extension, and guard return.
 */
export function evalStrikeCurve(
  progress: number,
  windupEnd = 0.24,
  strikeEnd = 0.58,
): StrikePhaseWeights {
  const p = clamp01(progress);
  if (p < windupEnd) {
    const w = smoothstep(p / Math.max(0.01, windupEnd));
    return { windup: w, strike: 0, recover: 0 };
  }
  if (p < strikeEnd) {
    const s = easeOutCubic((p - windupEnd) / Math.max(0.01, strikeEnd - windupEnd));
    return { windup: 1 - s, strike: s, recover: 0 };
  }
  const r = smoothstep((p - strikeEnd) / Math.max(0.01, 1 - strikeEnd));
  return { windup: 0, strike: 1 - r, recover: r };
}

/**
 * Computes proportion scale factors so full-body kinematics look athletic and
 * natural across all 5 fighters (including Anda Bhai's egg silhouette and
 * Laddoo Mausi's sturdy heavyweight frame) without limb clipping.
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
      twistScale: 0.82,
      kneeBendScale: 0.85,
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
      twistScale: 1.08,
      kneeBendScale: 1.05,
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
 * Computes the active martial-arts fighting guard stance:
 * - Feet planted apart (front foot forward, back foot angled)
 * - Knees athletically bent
 * - Torso angled ~30 deg toward camera
 * - Both elbows bent with fists/hands raised near chest/chin guard height
 * - Subtle rhythmic breathing bounce
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
  const breathe = Math.sin(elapsed * 4.8 + slot * 2.1);
  const bounce = Math.sin(elapsed * 2.4 + slot * 1.4);

  // Athletic stance: knees bent, slight forward/back split, torso angled ~30 deg open toward camera
  const crouchDrop = 0.07 * scale.kneeBendScale;
  const stanceTwist = -0.34 * scale.twistScale * facing;

  return {
    pelvisX: 0,
    pelvisY: basePelvisY - crouchDrop + breathe * 0.032,
    pelvisRotX: 0.04,
    pelvisRotY: -0.20 * scale.twistScale * facing,
    pelvisRotZ: bounce * (id === 'anda' ? 0.075 : 0.025),
    torsoRotX: (id === 'sheru' ? -0.04 : 0.08) + breathe * 0.028,
    torsoRotY: stanceTwist + bounce * 0.05,
    torsoRotZ: 0,
    headRotX: (id === 'sheru' ? 0.04 : -0.04) - breathe * 0.025,
    headRotY: 0.36 * scale.twistScale * facing, // Head looks straight at opponent across angled torso
    headRotZ: 0,
    // Front (left) guard arm raised near chest/chin
    lShX: -1.14 + breathe * 0.06,
    lShY: 0.18,
    lShZ: -0.22 - scale.guardSpread,
    lElbX: -1.56 - breathe * 0.05,
    // Rear (right) guard arm tucked tight at chin
    rShX: -0.96 - breathe * 0.06,
    rShY: -0.18,
    rShZ: 0.24 + scale.guardSpread,
    rElbX: -1.72 + breathe * 0.05,
    // Front leg planted forward, knee bent
    lHipX: -0.34 * scale.kneeBendScale,
    lHipZ: -0.08,
    lKneeX: 0.44 * scale.kneeBendScale - breathe * 0.06,
    // Rear leg planted back & angled for balance
    rHipX: 0.32 * scale.kneeBendScale,
    rHipZ: 0.12,
    rKneeX: 0.38 * scale.kneeBendScale + breathe * 0.06,
    snapRate: 18,
  };
}

/**
 * Pure procedural martial-arts pose solver for all core combat states:
 * idle, walk, jump, crouch, block, punch (3-hit), kick (snap / low sweep / jump-kick finisher),
 * sweep, grab (clinch + whiff recoil), grab_hold (pull-twist-hurl throw), grabbed,
 * hit (sharp stagger), knockdown (mid-air flip -> flat on back), getup (2-stage crouch -> stand),
 * ko, and victory.
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
      // Responsive stepping footwork while keeping fists raised in guard & torso facing opponent
      const movingForward = state.vx * f >= 0;
      const cyc = state.walkCycle * (movingForward ? 1.15 : -1.05);
      const stride = Math.sin(cyc);
      const stepLift = Math.abs(Math.cos(cyc));
      const strideAmp = 0.56 * scale.kneeBendScale;

      return {
        ...guard,
        pelvisX: movingForward ? 0.06 : -0.05,
        pelvisY: basePelvisY - 0.06 * scale.kneeBendScale + stepLift * 0.068,
        pelvisRotY: -0.18 * scale.twistScale * f + stride * 0.14,
        pelvisRotZ: stride * (state.id === 'anda' ? 0.12 : 0.05),
        torsoRotX: movingForward ? 0.13 : -0.03,
        torsoRotY: -0.28 * scale.twistScale * f + stride * 0.16,
        headRotY: 0.30 * scale.twistScale * f - stride * 0.12,
        // Guard stays UP while stepping! Subtle counter-bob only.
        lShX: -1.06 - stride * 0.16,
        lShZ: -0.24 - scale.guardSpread,
        lElbX: -1.52 + stride * 0.08,
        rShX: -0.92 + stride * 0.16,
        rShZ: 0.26 + scale.guardSpread,
        rElbX: -1.68 - stride * 0.08,
        // Crisp martial-arts stepping footwork
        lHipX: -0.16 + stride * strideAmp,
        lHipZ: -0.06,
        lKneeX: 0.30 + Math.max(0, -stride) * 0.68 * scale.kneeBendScale,
        rHipX: 0.16 - stride * strideAmp,
        rHipZ: 0.08,
        rKneeX: 0.30 + Math.max(0, stride) * 0.68 * scale.kneeBendScale,
        snapRate: 20,
      };
    }

    case 'jump': {
      const rising = state.vy > 0;
      return {
        ...guard,
        pelvisY: basePelvisY + 0.04,
        torsoRotX: rising ? 0.16 : 0.06,
        torsoRotY: -0.22 * scale.twistScale * f,
        lShX: -1.35,
        lShZ: -0.34 - scale.guardSpread,
        lElbX: -1.35,
        rShX: -1.25,
        rShZ: 0.34 + scale.guardSpread,
        rElbX: -1.45,
        lHipX: rising ? -0.85 : -0.45,
        lKneeX: rising ? 1.38 : 0.85,
        rHipX: rising ? -0.35 : -0.15,
        rKneeX: rising ? 0.92 : 0.65,
        snapRate: 18,
      };
    }

    case 'crouch': {
      return {
        ...guard,
        pelvisY: basePelvisY - 0.36 * scale.kneeBendScale,
        pelvisRotX: 0.08,
        torsoRotX: 0.30,
        torsoRotY: -0.26 * scale.twistScale * f,
        lShX: -1.08,
        lElbX: -1.62,
        rShX: -1.02,
        rElbX: -1.72,
        lHipX: -1.02 * scale.kneeBendScale,
        lKneeX: 1.56 * scale.kneeBendScale,
        rHipX: -0.88 * scale.kneeBendScale,
        rKneeX: 1.44 * scale.kneeBendScale,
        snapRate: 22,
      };
    }

    case 'block': {
      return {
        ...guard,
        pelvisX: -0.08,
        pelvisY: basePelvisY - 0.12 * scale.kneeBendScale,
        torsoRotX: -0.10,
        torsoRotY: -0.18 * scale.twistScale * f,
        headRotX: 0.08,
        lShX: -1.42,
        lShY: 0.28,
        lShZ: 0.32 - scale.guardSpread * 0.5,
        lElbX: -1.68,
        rShX: -1.48,
        rShY: -0.28,
        rShZ: -0.32 + scale.guardSpread * 0.5,
        rElbX: -1.74,
        lHipX: -0.38 * scale.kneeBendScale,
        lKneeX: 0.54 * scale.kneeBendScale,
        rHipX: 0.38 * scale.kneeBendScale,
        rKneeX: 0.48 * scale.kneeBendScale,
        snapRate: 26,
      };
    }

    case 'punch': {
      if (state.comboStep === 0) {
        // HIT 1 — QUICK JAB: Front shoulder drives forward, ~25° torso twist,
        // front arm snaps straight out while rear hand stays tucked tight at chin!
        const { windup, strike } = evalStrikeCurve(atkProgress, 0.21, 0.54);
        return {
          ...guard,
          pelvisX: lerp(guard.pelvisX, 0.14 * scale.limbReach, strike) - 0.04 * windup,
          pelvisY: guard.pelvisY - 0.03 * strike,
          pelvisRotY: lerp(guard.pelvisRotY, 0.18 * scale.twistScale, strike) - 0.14 * windup,
          torsoRotX: lerp(guard.torsoRotX, 0.14, strike),
          // ~25° forward jab twist (0.44 rad)
          torsoRotY: lerp(guard.torsoRotY, 0.44 * scale.twistScale, strike) - 0.18 * windup,
          headRotY: lerp(guard.headRotY, -0.36 * scale.twistScale, strike),
          // Front (left) arm snaps straight out
          lShX: lerp(guard.lShX, -1.66 * scale.limbReach, strike) + 0.24 * windup,
          lShY: lerp(0.18, -0.15, strike),
          lShZ: lerp(guard.lShZ, 0.08, strike),
          lElbX: lerp(guard.lElbX, -0.05, strike) - 0.15 * windup,
          // Rear (right) hand stays tucked tight at chin guard!
          rShX: -1.08,
          rShY: -0.22,
          rShZ: 0.20 + scale.guardSpread,
          rElbX: -1.82,
          // Front foot steps crisply into jab
          lHipX: lerp(guard.lHipX, -0.46 * scale.kneeBendScale, strike),
          lKneeX: lerp(guard.lKneeX, 0.54 * scale.kneeBendScale, strike),
          rHipX: lerp(guard.rHipX, 0.36 * scale.kneeBendScale, strike),
          rKneeX: lerp(guard.rKneeX, 0.34 * scale.kneeBendScale, strike),
          snapRate: 30,
        };
      }

      if (state.comboStep === 1) {
        // HIT 2 — POWER CROSS: Front leg lunges forward, hips & torso rotate ~45°
        // into a heavy rear-hand straight punch!
        const { windup, strike } = evalStrikeCurve(atkProgress, 0.23, 0.56);
        return {
          ...guard,
          pelvisX: lerp(guard.pelvisX, 0.24 * scale.limbReach, strike) - 0.06 * windup,
          pelvisY: guard.pelvisY - 0.06 * strike,
          pelvisRotY: lerp(guard.pelvisRotY, -0.42 * scale.twistScale, strike) + 0.28 * windup,
          torsoRotX: lerp(guard.torsoRotX, 0.20, strike) - 0.08 * windup,
          // ~45° power cross rotation (-0.79 rad)
          torsoRotY: lerp(guard.torsoRotY, -0.79 * scale.twistScale, strike) + 0.42 * windup,
          headRotY: lerp(guard.headRotY, 0.72 * scale.twistScale, strike),
          // Rear (right) arm fires straight through
          rShX: lerp(guard.rShX, -1.72 * scale.limbReach, strike) + 0.42 * windup,
          rShY: lerp(-0.18, 0.16, strike),
          rShZ: lerp(guard.rShZ, -0.06, strike) + 0.24 * windup,
          rElbX: lerp(guard.rElbX, -0.04, strike) - 0.12 * windup,
          // Front (left) arm stays tucked at chin/cheek
          lShX: -1.04,
          lShY: 0.24,
          lShZ: -0.18 - scale.guardSpread,
          lElbX: -1.78,
          // Front leg lunges forward, back leg drives off toes
          lHipX: lerp(guard.lHipX, -0.62 * scale.kneeBendScale, strike),
          lKneeX: lerp(guard.lKneeX, 0.72 * scale.kneeBendScale, strike),
          rHipX: lerp(guard.rHipX, 0.56 * scale.kneeBendScale, strike),
          rKneeX: lerp(guard.rKneeX, 0.28 * scale.kneeBendScale, strike),
          snapRate: 30,
        };
      }

      // HIT 3 — HEAVY RISING UPPERCUT / HOOK FINISHER:
      // Brief dip of knees -> explosive rising uppercut with full upper-body lean!
      const { windup, strike } = evalStrikeCurve(atkProgress, 0.26, 0.62);
      return {
        ...guard,
        pelvisX: lerp(guard.pelvisX, 0.28 * scale.limbReach, strike) - 0.06 * windup,
        pelvisY:
          guard.pelvisY - 0.20 * scale.kneeBendScale * windup + 0.18 * scale.limbReach * strike,
        pelvisRotY: lerp(guard.pelvisRotY, -0.52 * scale.twistScale, strike) + 0.35 * windup,
        torsoRotX: lerp(guard.torsoRotX, -0.32, strike) + 0.34 * windup,
        torsoRotY: lerp(guard.torsoRotY, -0.84 * scale.twistScale, strike) + 0.55 * windup,
        torsoRotZ: lerp(0, -0.14, strike) + 0.12 * windup,
        headRotX: lerp(0, -0.16, strike) + 0.14 * windup,
        headRotY: lerp(guard.headRotY, 0.76 * scale.twistScale, strike),
        // Right fist dips low during windup, then explodes skyward in rising uppercut!
        rShX: lerp(guard.rShX, -2.62 * scale.limbReach, strike) + 1.25 * windup,
        rShZ: lerp(guard.rShZ, 0.18, strike) + 0.36 * windup,
        rElbX: lerp(guard.rElbX, -0.42, strike) + 0.22 * windup,
        // Left arm pulls back for explosive torque counter-balance
        lShX: lerp(guard.lShX, 0.38, strike) - 0.15 * windup,
        lShZ: -0.38 - scale.guardSpread,
        lElbX: -1.45,
        // Deep knee dip -> explosive drive upward
        lHipX: lerp(guard.lHipX, -0.32, strike) - 0.52 * scale.kneeBendScale * windup,
        lKneeX: lerp(guard.lKneeX, 0.20, strike) + 0.85 * scale.kneeBendScale * windup,
        rHipX: lerp(guard.rHipX, 0.42, strike) - 0.38 * scale.kneeBendScale * windup,
        rKneeX: lerp(guard.rKneeX, 0.18, strike) + 0.85 * scale.kneeBendScale * windup,
        snapRate: 30,
      };
    }

    case 'kick': {
      if (state.comboStep === 1) {
        // 2ND KICK COMBO -> LOW SWEEP KICK (identical crisp low-sweep kinematics!)
        return computeLowSweepPose(guard, atkProgress, scale);
      }

      if (state.comboStep >= 2) {
        // 3RD KICK COMBO -> JUMP-KICK / TURNING BACK-KICK FINISHER:
        // Brisk forward hop, sharp torso twist, extended launching kick, tucked non-kicking leg!
        const { windup, strike } = evalStrikeCurve(atkProgress, 0.25, 0.62);
        const hopLift = Math.sin(clamp01((atkProgress - 0.12) / 0.68) * Math.PI) * 0.34;
        return {
          ...guard,
          pelvisX: lerp(guard.pelvisX, 0.32 * scale.limbReach, strike) - 0.08 * windup,
          pelvisY: guard.pelvisY - 0.14 * windup + hopLift * scale.limbReach,
          pelvisRotY: lerp(guard.pelvisRotY, 1.05 * scale.twistScale, strike) - 0.45 * windup,
          pelvisRotZ: lerp(0, -0.26, strike),
          torsoRotX: lerp(guard.torsoRotX, -0.34, strike) + 0.22 * windup,
          torsoRotY: lerp(guard.torsoRotY, -0.68 * scale.twistScale, strike) + 0.42 * windup,
          headRotY: lerp(guard.headRotY, -0.38 * scale.twistScale, strike),
          // Arms tucked tightly for athletic aerial spin balance
          lShX: -1.24,
          lShZ: -0.34 - scale.guardSpread,
          lElbX: -1.62,
          rShX: -0.82 + 0.45 * strike,
          rShZ: 0.38 + scale.guardSpread,
          rElbX: -1.48,
          // Extended kicking leg snaps straight out; support leg tucks underneath in mid-air!
          rHipX: lerp(guard.rHipX, -1.88 * scale.limbReach, strike) - 0.65 * windup,
          rHipZ: lerp(0.12, 0.26, strike),
          rKneeX: lerp(guard.rKneeX, 0.04, strike) + 1.15 * windup,
          lHipX: lerp(guard.lHipX, -0.82 * scale.kneeBendScale, strike),
          lKneeX: lerp(guard.lKneeX, 1.48 * scale.kneeBendScale, strike),
          snapRate: 30,
        };
      }

      // HIT 1 — FRONT / HIGH SNAP KICK:
      // Hips pivot sideways, torso leans back for realistic counter-balance, knee chambers high
      // then snaps straight out to chest/head height while arms stay tucked for balance!
      const { windup, strike } = evalStrikeCurve(atkProgress, 0.24, 0.58);
      return {
        ...guard,
        pelvisX: lerp(guard.pelvisX, 0.16 * scale.limbReach, strike),
        pelvisY: guard.pelvisY + 0.04 * strike,
        pelvisRotY: lerp(guard.pelvisRotY, 0.58 * scale.twistScale, strike + windup * 0.6),
        pelvisRotZ: lerp(0, -0.20, strike),
        torsoRotX: lerp(guard.torsoRotX, -0.36, strike) - 0.14 * windup,
        torsoRotY: lerp(guard.torsoRotY, -0.22 * scale.twistScale, strike),
        headRotX: lerp(0, 0.14, strike),
        // Arms stay tucked cleanly in guard for realistic martial-arts balance (NOT stiff at sides!)
        lShX: lerp(guard.lShX, -1.22, strike),
        lShZ: -0.32 - scale.guardSpread,
        lElbX: -1.68,
        rShX: lerp(guard.rShX, -0.88, strike),
        rShZ: 0.36 + scale.guardSpread,
        rElbX: -1.58,
        // Chamber knee high on windup, then snap straight out to chest/head height on strike!
        rHipX: lerp(guard.rHipX, -1.94 * scale.limbReach, strike) - 1.38 * windup,
        rHipZ: lerp(0.12, 0.18, strike),
        rKneeX: lerp(guard.rKneeX, 0.05, strike) + 1.52 * windup,
        // Standing leg plants firmly
        lHipX: lerp(guard.lHipX, 0.16, strike),
        lKneeX: lerp(guard.lKneeX, 0.18, strike),
        snapRate: 30,
      };
    }

    case 'sweep': {
      return computeLowSweepPose(guard, atkProgress, scale);
    }

    case 'grab': {
      // Clinch lunge (0..0.44) -> If missed, empty reach-and-recoil animation (0.44..1.0)!
      if (atkProgress < 0.44) {
        const reach = easeOutCubic(atkProgress / 0.44);
        return {
          ...guard,
          pelvisX: lerp(0, 0.28 * scale.limbReach, reach),
          pelvisY: guard.pelvisY - 0.08 * reach,
          pelvisRotY: lerp(guard.pelvisRotY, 0, reach),
          torsoRotX: lerp(guard.torsoRotX, 0.30, reach),
          torsoRotY: lerp(guard.torsoRotY, 0, reach),
          headRotY: 0,
          lShX: lerp(guard.lShX, -1.62 * scale.limbReach, reach),
          lShZ: lerp(guard.lShZ, 0.24, reach),
          lElbX: lerp(guard.lElbX, -0.32, reach),
          rShX: lerp(guard.rShX, -1.62 * scale.limbReach, reach),
          rShZ: lerp(guard.rShZ, -0.24, reach),
          rElbX: lerp(guard.rElbX, -0.32, reach),
          lHipX: lerp(guard.lHipX, -0.54 * scale.kneeBendScale, reach),
          lKneeX: lerp(guard.lKneeX, 0.64 * scale.kneeBendScale, reach),
          rHipX: lerp(guard.rHipX, 0.46 * scale.kneeBendScale, reach),
          rKneeX: lerp(guard.rKneeX, 0.34 * scale.kneeBendScale, reach),
          snapRate: 28,
        };
      }
      // Whiff recoil: over-extended reach stumbles slightly back with splayed hands before returning to guard
      const whiffT = clamp01((atkProgress - 0.44) / 0.56);
      const recoilPeak = Math.sin(whiffT * Math.PI);
      return {
        ...guard,
        pelvisX: lerp(0.18, 0, whiffT),
        pelvisY: guard.pelvisY - 0.04 * recoilPeak,
        torsoRotX: lerp(0.18, guard.torsoRotX, whiffT) - 0.22 * recoilPeak,
        torsoRotY: lerp(0, guard.torsoRotY, whiffT),
        lShX: lerp(-1.35, guard.lShX, whiffT),
        lShZ: lerp(-0.55 - scale.guardSpread, guard.lShZ, whiffT),
        lElbX: lerp(-0.65, guard.lElbX, whiffT),
        rShX: lerp(-1.35, guard.rShX, whiffT),
        rShZ: lerp(0.55 + scale.guardSpread, guard.rShZ, whiffT),
        rElbX: lerp(-0.65, guard.rElbX, whiffT),
        snapRate: 20,
      };
    }

    case 'grab_hold': {
      // Clinch Connect -> Pull/Lift off-balance with full torso twist (0..0.44) -> Explosive Throw Hurl (0.44..1.0)
      if (atkProgress < 0.44) {
        const pull = smoothstep(atkProgress / 0.44);
        return {
          ...guard,
          pelvisX: lerp(0.16, -0.06, pull),
          pelvisY: guard.pelvisY - 0.10 * scale.kneeBendScale + pull * 0.14,
          pelvisRotY: lerp(0, 0.65 * scale.twistScale, pull),
          torsoRotX: lerp(0.20, -0.24, pull),
          torsoRotY: lerp(0, 0.72 * scale.twistScale, pull),
          headRotY: -0.42 * pull,
          lShX: lerp(-1.45, -2.25 * scale.limbReach, pull),
          lShZ: 0.22,
          lElbX: -0.68,
          rShX: lerp(-1.45, -2.25 * scale.limbReach, pull),
          rShZ: -0.22,
          rElbX: -0.68,
          lHipX: -0.52 * scale.kneeBendScale,
          lKneeX: 0.72 * scale.kneeBendScale,
          rHipX: 0.42 * scale.kneeBendScale,
          rKneeX: 0.56 * scale.kneeBendScale,
          snapRate: 26,
        };
      }
      const hurl = easeOutCubic((atkProgress - 0.44) / 0.34);
      const settle = atkProgress > 0.78 ? smoothstep((atkProgress - 0.78) / 0.22) : 0;
      const w = hurl * (1 - settle);
      return {
        ...guard,
        pelvisX: lerp(guard.pelvisX, 0.34 * scale.limbReach, w),
        pelvisY: guard.pelvisY - 0.08 * w,
        pelvisRotY: lerp(guard.pelvisRotY, -0.58 * scale.twistScale, w),
        torsoRotX: lerp(guard.torsoRotX, 0.48, w),
        torsoRotY: lerp(guard.torsoRotY, -0.88 * scale.twistScale, w),
        headRotY: lerp(guard.headRotY, 0.62 * scale.twistScale, w),
        lShX: lerp(guard.lShX, -1.35 * scale.limbReach, w),
        lShZ: lerp(guard.lShZ, -0.28, w),
        lElbX: lerp(guard.lElbX, -0.14, w),
        rShX: lerp(guard.rShX, -1.35 * scale.limbReach, w),
        rShZ: lerp(guard.rShZ, 0.28, w),
        rElbX: lerp(guard.rElbX, -0.14, w),
        lHipX: lerp(guard.lHipX, -0.64 * scale.kneeBendScale, w),
        lKneeX: lerp(guard.lKneeX, 0.76 * scale.kneeBendScale, w),
        rHipX: lerp(guard.rHipX, 0.52 * scale.kneeBendScale, w),
        rKneeX: lerp(guard.rKneeX, 0.32 * scale.kneeBendScale, w),
        snapRate: 30,
      };
    }

    case 'grabbed': {
      // Pulled off balance, tilted & flailing helplessly before throw arc
      const flail = Math.sin(elapsed * 22);
      return {
        ...guard,
        pelvisY: basePelvisY + 0.06,
        pelvisRotX: -0.38 + flail * 0.14,
        pelvisRotY: flail * 0.32,
        pelvisRotZ: flail * 0.28,
        torsoRotX: -0.38,
        torsoRotY: -flail * 0.25,
        headRotX: -0.32,
        lShX: -1.95 + flail * 0.45,
        lShZ: -0.78,
        lElbX: -0.45,
        rShX: -1.95 - flail * 0.45,
        rShZ: 0.78,
        rElbX: -0.45,
        lHipX: -0.52 + flail * 0.35,
        lKneeX: 0.92,
        rHipX: -0.52 - flail * 0.35,
        rKneeX: 0.92,
        snapRate: 24,
      };
    }

    case 'hit': {
      // Sharp head & upper-torso recoil backward + brief arm flare, then spring back toward guard!
      const hitProg = clamp01(state.actionTimer / 0.26);
      const recoil = Math.sin(Math.min(1, hitProg * 1.15) * Math.PI);
      const impactPeak = hitProg < 0.35 ? easeOutCubic(hitProg / 0.35) : 1 - smoothstep((hitProg - 0.35) / 0.65);
      return {
        ...guard,
        pelvisX: -0.16 * impactPeak,
        pelvisY: guard.pelvisY - 0.04 * impactPeak,
        pelvisRotZ: 0.12 * recoil,
        torsoRotX: lerp(guard.torsoRotX, -0.52, impactPeak),
        torsoRotY: lerp(guard.torsoRotY, 0.24 * scale.twistScale, impactPeak),
        headRotX: lerp(guard.headRotX, -0.44, impactPeak),
        headRotZ: 0.16 * impactPeak,
        lShX: lerp(guard.lShX, -1.42, impactPeak),
        lShZ: lerp(guard.lShZ, -0.78, impactPeak),
        lElbX: lerp(guard.lElbX, -0.48, impactPeak),
        rShX: lerp(guard.rShX, -1.42, impactPeak),
        rShZ: lerp(guard.rShZ, 0.78, impactPeak),
        rElbX: lerp(guard.rElbX, -0.48, impactPeak),
        lHipX: lerp(guard.lHipX, -0.22, impactPeak),
        rHipX: lerp(guard.rHipX, 0.34, impactPeak),
        snapRate: 30,
      };
    }

    case 'knockdown': {
      // Smooth mid-air backward rotation -> flat on back on arena floor!
      const airborne = state.y > 0.08;
      if (airborne) {
        const flipT = easeOutCubic(state.actionTimer / 0.38);
        return {
          ...guard,
          pelvisY: lerp(basePelvisY * 0.92, scale.flatPelvisY + 0.28, flipT),
          pelvisRotX: lerp(-0.35, -Math.PI * 0.45, flipT),
          pelvisRotY: 0,
          pelvisRotZ: 0.14 * Math.sin(state.actionTimer * 9),
          torsoRotX: -0.34 * (1 - flipT * 0.6),
          torsoRotY: 0,
          headRotX: -0.28,
          headRotY: 0,
          lShX: -1.95,
          lShZ: -0.76,
          lElbX: -0.38,
          rShX: -1.78,
          rShZ: 0.76,
          rElbX: -0.38,
          lHipX: -0.52 * (1 - flipT) + 0.12 * flipT,
          lKneeX: 0.68 * (1 - flipT) + 0.22 * flipT,
          rHipX: -0.34 * (1 - flipT) - 0.08 * flipT,
          rKneeX: 0.52 * (1 - flipT) + 0.18 * flipT,
          snapRate: 16,
        };
      }
      // Flat on back on arena floor
      return {
        ...guard,
        pelvisY: scale.flatPelvisY,
        pelvisRotX: -Math.PI * 0.48,
        pelvisRotY: 0,
        pelvisRotZ: 0.10,
        torsoRotX: -0.05,
        torsoRotY: 0,
        headRotX: 0.06,
        headRotY: 0,
        lShX: -1.76,
        lShZ: -0.82,
        lElbX: -0.26,
        rShX: -1.58,
        rShZ: 0.82,
        rElbX: -0.26,
        lHipX: 0.14,
        lHipZ: -0.14,
        lKneeX: 0.22,
        rHipX: -0.10,
        rHipZ: 0.14,
        rKneeX: 0.18,
        snapRate: 15,
      };
    }

    case 'getup': {
      // Realistic 2-stage get-up cycle:
      // Stage 1 (0.00..0.48): Push up from flat on back onto hands/knees/deep crouch!
      // Stage 2 (0.48..1.00): Rise smoothly from deep crouch back into athletic fighting guard!
      const crouchPelvisY = basePelvisY - 0.36 * scale.kneeBendScale;
      if (atkProgress < 0.48) {
        const t = smoothstep(atkProgress / 0.48);
        return {
          ...guard,
          pelvisX: lerp(-0.08, 0.04, t),
          pelvisY: lerp(scale.flatPelvisY, crouchPelvisY, t),
          pelvisRotX: lerp(-Math.PI * 0.48, 0.18, t),
          pelvisRotY: lerp(0, guard.pelvisRotY * 0.5, t),
          pelvisRotZ: lerp(0.10, 0, t),
          torsoRotX: lerp(-0.05, 0.68, t),
          torsoRotY: lerp(0, guard.torsoRotY * 0.5, t),
          headRotX: lerp(0.06, -0.32, t),
          headRotY: lerp(0, guard.headRotY * 0.6, t),
          // Hands press down to push torso off floor into crouch!
          lShX: lerp(-1.76, -0.88, t),
          lShZ: lerp(-0.82, -0.36 - scale.guardSpread, t),
          lElbX: lerp(-0.26, -0.42, t),
          rShX: lerp(-1.58, -0.88, t),
          rShZ: lerp(0.82, 0.36 + scale.guardSpread, t),
          rElbX: lerp(-0.26, -0.42, t),
          // Knees tuck tightly underneath into crouched push-up base
          lHipX: lerp(0.14, -1.16 * scale.kneeBendScale, t),
          lKneeX: lerp(0.22, 1.72 * scale.kneeBendScale, t),
          rHipX: lerp(-0.10, -1.04 * scale.kneeBendScale, t),
          rKneeX: lerp(0.18, 1.62 * scale.kneeBendScale, t),
          snapRate: 16,
        };
      }
      const t = smoothstep((atkProgress - 0.48) / 0.52);
      return {
        ...guard,
        pelvisX: lerp(0.04, guard.pelvisX, t),
        pelvisY: lerp(crouchPelvisY, guard.pelvisY, t),
        pelvisRotX: lerp(0.18, guard.pelvisRotX, t),
        pelvisRotY: lerp(guard.pelvisRotY * 0.5, guard.pelvisRotY, t),
        pelvisRotZ: lerp(0, guard.pelvisRotZ, t),
        torsoRotX: lerp(0.68, guard.torsoRotX, t),
        torsoRotY: lerp(guard.torsoRotY * 0.5, guard.torsoRotY, t),
        headRotX: lerp(-0.32, guard.headRotX, t),
        headRotY: lerp(guard.headRotY * 0.6, guard.headRotY, t),
        lShX: lerp(-0.88, guard.lShX, t),
        lShZ: lerp(-0.36 - scale.guardSpread, guard.lShZ, t),
        lElbX: lerp(-0.42, guard.lElbX, t),
        rShX: lerp(-0.88, guard.rShX, t),
        rShZ: lerp(0.36 + scale.guardSpread, guard.rShZ, t),
        rElbX: lerp(-0.42, guard.rElbX, t),
        lHipX: lerp(-1.16 * scale.kneeBendScale, guard.lHipX, t),
        lKneeX: lerp(1.72 * scale.kneeBendScale, guard.lKneeX, t),
        rHipX: lerp(-1.04 * scale.kneeBendScale, guard.rHipX, t),
        rKneeX: lerp(1.62 * scale.kneeBendScale, guard.rKneeX, t),
        snapRate: 18,
      };
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
        lShZ: -0.78,
        lElbX: -0.32,
        rShX: -1.55,
        rShZ: 0.78,
        rElbX: -0.32,
        lHipX: 0.2,
        rHipX: -0.15,
        lKneeX: 0.24,
        rKneeX: 0.2,
        snapRate: 10,
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
        lKneeX: 0.12,
        rKneeX: 0.12,
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
        snapRate: 22,
      };
    }
  }
}

function computeLowSweepPose(
  guard: CombatPose,
  atkProgress: number,
  scale: ReturnType<typeof getFighterKinematicScale>,
): CombatPose {
  // Low Sweep Kick: drop low into crouched one-knee stance, lean torso back,
  // and whip the extended leg horizontally along the floor to trip the opponent!
  const { windup, strike } = evalStrikeCurve(atkProgress, 0.22, 0.62);
  const sweepArc = Math.sin(clamp01((atkProgress - 0.16) / 0.56) * Math.PI);
  return {
    ...guard,
    pelvisX: lerp(guard.pelvisX, 0.22 * scale.limbReach, strike),
    pelvisY: guard.pelvisY - 0.42 * scale.kneeBendScale * Math.max(windup, strike),
    pelvisRotX: lerp(0, -0.22, strike),
    pelvisRotY: lerp(guard.pelvisRotY, 0.88 * scale.twistScale, strike) - 0.36 * windup,
    pelvisRotZ: lerp(0, -0.18, strike),
    torsoRotX: lerp(guard.torsoRotX, -0.28, strike) + 0.28 * windup,
    torsoRotY: lerp(guard.torsoRotY, -0.32 * scale.twistScale, strike),
    headRotY: lerp(guard.headRotY, -0.45 * scale.twistScale, strike),
    // Support hand braces low/back while front hand stays up for guard balance
    lShX: lerp(guard.lShX, -0.68, strike),
    lShZ: -0.62 - scale.guardSpread,
    lElbX: -0.82,
    rShX: lerp(guard.rShX, 0.48, strike),
    rShZ: 0.54 + scale.guardSpread,
    rElbX: -0.65,
    // Support leg drops into low crouch/one-knee base
    lHipX: lerp(guard.lHipX, -1.08 * scale.kneeBendScale, Math.max(windup, strike)),
    lKneeX: lerp(guard.lKneeX, 1.68 * scale.kneeBendScale, Math.max(windup, strike)),
    // Sweeping leg whips horizontally along the floor!
    rHipX: lerp(guard.rHipX, -1.24 * scale.limbReach, strike) - 0.42 * windup,
    rHipZ: lerp(0.12, 0.64 * sweepArc, strike),
    rKneeX: lerp(guard.rKneeX, 0.05, strike) + 0.72 * windup,
    snapRate: 30,
  };
}
