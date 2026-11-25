import { computeTotalSuperDamage, GROUND_Y, KNOCKDOWN_GROUND_DURATION, resolveRoundEnd } from './combat';
import type { CombatEvent, FighterState, MatchState } from './types';

export const SAMYAK_SUPER_DURATION = 4.8;
export const SAMYAK_SUPER_BANNER = 'MISSION IAS: BEAST MODE!';
export const SAMYAK_SUPER_SIGNATURE_TEXT =
  'BODY BHI HAI AUR DIMAAG BHI... AB DEKH IAS KI POWER!';
export const SAMYAK_BOOK_COUNT = 8;
export const SAMYAK_DUMBBELL_COUNT = 6;
export const SAMYAK_SLAM_IMPACT_TIME = 4.1;

export type SamyakSuperPhase =
  | 'beast_flex'
  | 'ias_barrage'
  | 'air1_slam'
  | 'done';

export interface SamyakSuperBeatSignal {
  kind:
    | 'flex_start'
    | 'lens_glint'
    | 'barrage_summon'
    | 'barrage_hit'
    | 'slam_leap'
    | 'air1_slam_impact'
    | 'super_end';
  x: number;
  y: number;
  hitIndex?: number;
}

export interface SamyakSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: SamyakSuperPhase;
  attackerOriginX: number;
  defenderOriginX: number;
  slamLandingX: number;
  totalDamageBudget: number;
  barrageDamagePool: number;
  barrageDamageDealt: number;
  finisherDamagePool: number;
  flexSignaled: boolean;
  lensGlintSignaled: boolean;
  signatureShown: boolean;
  barrageSignaled: boolean;
  barrageHitsTriggered: number;
  leapSignaled: boolean;
  slamImpactTriggered: boolean;
  endSignaled: boolean;
}

const BARRAGE_HIT_TIMES = [2.42, 2.57, 2.72, 2.87, 3.02, 3.17, 3.32];

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function clampArenaX(x: number): number {
  return Math.max(-8.4, Math.min(8.4, x));
}

export function createSamyakSuperState(
  attacker: FighterState,
  defender: FighterState,
): SamyakSuperState {
  const totalBudget = computeTotalSuperDamage(defender.maxHp);
  const barragePool = Math.round(totalBudget * 0.45);
  const finisherPool = Math.max(1, totalBudget - barragePool);
  const facing: 1 | -1 = defender.x >= attacker.x ? 1 : -1;
  const slamLandingX = clampArenaX(defender.x - facing * 0.55);

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: SAMYAK_SUPER_DURATION,
    phase: 'beast_flex',
    attackerOriginX: attacker.x,
    defenderOriginX: defender.x,
    slamLandingX,
    totalDamageBudget: totalBudget,
    barrageDamagePool: barragePool,
    barrageDamageDealt: 0,
    finisherDamagePool: finisherPool,
    flexSignaled: false,
    lensGlintSignaled: false,
    signatureShown: false,
    barrageSignaled: false,
    barrageHitsTriggered: 0,
    leapSignaled: false,
    slamImpactTriggered: false,
    endSignaled: false,
  };
}

/**
 * Choreographed 4.8s Samyak "MISSION IAS: BEAST MODE!" Super sequence:
 * - Phase 1 (0.0s–1.8s — "Body bhi hai aur dimaag bhi..."):
 *   Dramatic golden-blue spotlight & low-angle close-up as Samyak hits a fierce
 *   double-bicep bodybuilder flex with pulsing golden-blue energy aura, followed
 *   at 1.05s by a sharp anime-style white lens glint across his black sunglasses
 *   and iconic tagline pop-up.
 * - Phase 2 (1.8s–3.5s — "Ab dekh IAS ki power!"):
 *   Dynamic 3D angle framing both fighters; summons a swirling orbital ring of
 *   8 3D UPSC books ("POLITY", "NCERT", "HISTORY", "UPSC") and 6 black iron gym
 *   dumbbells, then fires them in a rapid homing barrage (~45% of 33% cap).
 * - Phase 3 (3.5s–4.8s — "AIR 1" Finisher Slam):
 *   Samyak leaps high and dives straight down in a superhero ground-slam at 4.10s,
 *   summoning a glowing golden "IAS · AIR 1" seal + shockwave ring + heavy barbell
 *   impact wave (~55% remaining damage, strict 33% maxHP cap). Opponent blasts into
 *   flat knockdown while Samyak rises, casually adjusts his black sunglasses with
 *   one hand, and returns to fighting stance.
 */
export function stepSamyakSuper(
  state: MatchState,
  sup: SamyakSuperState,
  dt: number,
  events: CombatEvent[],
): SamyakSuperBeatSignal[] {
  const signals: SamyakSuperBeatSignal[] = [];
  if (!sup.active) return signals;

  const attacker = state.fighters[sup.attackerSlot];
  const defender = state.fighters[sup.defenderSlot];

  sup.elapsed = Math.min(sup.duration, sup.elapsed + dt);
  const t = sup.elapsed;

  // Lock facing & clear stray velocity
  attacker.facing = sup.defenderOriginX >= sup.attackerOriginX ? 1 : -1;
  defender.facing = (attacker.facing * -1) as 1 | -1;
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = sup.duration;
  attacker.invulnTimer = 0.25;
  attacker.vx = 0;
  attacker.vy = 0;

  // Phase 1 (0.0s–1.8s): Fierce Double-Bicep Flex + Golden-Blue Aura + Sunglasses Lens Glint
  if (t < 1.8) {
    sup.phase = 'beast_flex';
    if (!sup.flexSignaled) {
      sup.flexSignaled = true;
      signals.push({
        kind: 'flex_start',
        x: attacker.x,
        y: 1.35,
      });
    }
    if (!sup.lensGlintSignaled && t >= 1.05) {
      sup.lensGlintSignaled = true;
      signals.push({
        kind: 'lens_glint',
        x: attacker.x,
        y: 2.02,
      });
    }
    if (!sup.signatureShown && t >= 1.05) {
      sup.signatureShown = true;
      events.push({
        type: 'super',
        attackerSlot: attacker.slot,
        x: attacker.x,
        y: 2.35,
        damage: 0,
        word: SAMYAK_SUPER_SIGNATURE_TEXT,
        isSuperSignature: true,
        color: '#FEF08A',
      });
    }

    attacker.x = sup.attackerOriginX;
    attacker.y = GROUND_Y;
    attacker.expression = 'attack';
    defender.x = sup.defenderOriginX;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    defender.action = 'idle';
    defender.expression = 'block';
    return signals;
  }

  // Phase 2 (1.8s–3.5s): Orbiting & Homing UPSC Books + Heavy Iron Gym Dumbbells Barrage
  if (t < 3.5) {
    sup.phase = 'ias_barrage';
    if (!sup.barrageSignaled) {
      sup.barrageSignaled = true;
      signals.push({
        kind: 'barrage_summon',
        x: attacker.x,
        y: 1.55,
      });
    }

    attacker.x = sup.attackerOriginX;
    attacker.y = GROUND_Y;
    attacker.expression = 'attack';

    // Trigger 7 timed multi-hit impacts (~45% of 33% cap, never KOs early)
    while (
      sup.barrageHitsTriggered < BARRAGE_HIT_TIMES.length &&
      t >= BARRAGE_HIT_TIMES[sup.barrageHitsTriggered]
    ) {
      const hitIdx = sup.barrageHitsTriggered;
      sup.barrageHitsTriggered += 1;

      const hitsRemaining = BARRAGE_HIT_TIMES.length - hitIdx;
      const poolRemaining = Math.max(0, sup.barrageDamagePool - sup.barrageDamageDealt);
      const plannedDamage = Math.max(1, Math.round(poolRemaining / hitsRemaining));
      const capRemaining = Math.max(0, sup.totalDamageBudget - attacker.superDamageDealt);
      const maxNonLethal = Math.max(0, defender.hp - 1);
      const dmg = Math.min(plannedDamage, capRemaining, maxNonLethal);

      if (dmg > 0) {
        defender.hp = Math.max(1, defender.hp - dmg);
        attacker.damageDealt += dmg;
        attacker.superDamageDealt += dmg;
        sup.barrageDamageDealt += dmg;
      }

      attacker.comboCount += 1;
      attacker.comboTimer = 2.2;
      if (attacker.comboCount > attacker.maxCombo) attacker.maxCombo = attacker.comboCount;

      defender.action = 'hit';
      defender.expression = 'hit';
      defender.hitFlashTimer = 0.1;
      defender.squashX = 1.18;
      defender.squashY = 0.84;

      const hitY = 1.15 + (hitIdx % 3) * 0.24;
      signals.push({
        kind: 'barrage_hit',
        x: defender.x,
        y: hitY,
        hitIndex: hitIdx,
      });
      events.push({
        type: 'hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: hitY,
        damage: dmg,
        color: hitIdx % 2 === 0 ? '#38BDF8' : '#FACC15',
      });
    }

    const jitter = sup.barrageHitsTriggered > 0 ? Math.sin(t * 46) * 0.13 : 0;
    defender.x = sup.defenderOriginX + jitter;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    return signals;
  }

  // Phase 3 (3.5s–4.8s): High Leap -> Superhero Ground-Slam ("IAS · AIR 1") -> Sunglasses Adjust
  sup.phase = 'air1_slam';
  if (!sup.leapSignaled) {
    sup.leapSignaled = true;
    signals.push({
      kind: 'slam_leap',
      x: attacker.x,
      y: 1.4,
    });
  }

  if (t < 3.86) {
    // Explosive superhero leap upward toward apex above opponent
    const leapT = smoothstep((t - 3.5) / 0.36);
    attacker.x = sup.attackerOriginX + (sup.slamLandingX - sup.attackerOriginX) * (leapT * 0.72);
    attacker.y = Math.sin(leapT * Math.PI * 0.5) * 3.65;
    attacker.expression = 'attack';
  } else if (t < SAMYAK_SLAM_IMPACT_TIME) {
    // High-velocity meteoric dive straight down onto the arena floor
    const diveT = (t - 3.86) / (SAMYAK_SLAM_IMPACT_TIME - 3.86);
    const accel = diveT * diveT;
    const startX = sup.attackerOriginX + (sup.slamLandingX - sup.attackerOriginX) * 0.72;
    attacker.x = startX + (sup.slamLandingX - startX) * diveT;
    attacker.y = 3.65 * (1 - accel);
    attacker.expression = 'attack';
  } else {
    // Landed cleanly; rises and adjusts black sunglasses smoothly
    attacker.x = sup.slamLandingX;
    attacker.y = GROUND_Y;
    attacker.expression = t >= 4.3 ? 'victory' : 'attack';
  }

  // Trigger massive "IAS · AIR 1" ground-slam impact at 4.10s (~55% remaining damage)
  if (!sup.slamImpactTriggered && t >= SAMYAK_SLAM_IMPACT_TIME) {
    sup.slamImpactTriggered = true;
    const capRemaining = Math.max(0, sup.totalDamageBudget - attacker.superDamageDealt);
    const dmg = Math.min(capRemaining, defender.hp);

    if (dmg > 0) {
      defender.hp = Math.max(0, defender.hp - dmg);
      attacker.damageDealt += dmg;
      attacker.superDamageDealt += dmg;
    }

    attacker.comboCount += 1;
    attacker.comboTimer = 2.2;
    if (attacker.comboCount > attacker.maxCombo) attacker.maxCombo = attacker.comboCount;

    defender.hitFlashTimer = 0.24;
    defender.squashX = 1.46;
    defender.squashY = 0.6;
    defender.y = GROUND_Y;
    defender.vx = attacker.facing * 5.2;
    defender.vy = 0;

    if (defender.hp <= 0) {
      defender.action = 'ko';
      defender.expression = 'ko';
      defender.hitstunTimer = 0;
    } else {
      defender.action = 'knockdown';
      defender.actionTimer = 0;
      defender.knockdownTimer = KNOCKDOWN_GROUND_DURATION + 0.25;
      defender.expression = 'hit';
    }

    signals.push({
      kind: 'air1_slam_impact',
      x: defender.x,
      y: 0.9,
    });

    events.push({
      type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
      attackerSlot: attacker.slot,
      x: defender.x,
      y: 1.25,
      damage: dmg,
      color: '#FACC15',
      headline:
        defender.hp <= 0
          ? 'AIR 1 KNOCKOUT! SAMYAK CRACKS OPPONENT IN FIRST ATTEMPT!'
          : 'MISSION IAS BEAST MODE! GOLDEN AIR 1 GROUND-SLAM SHAKES THE ARENA!',
    });
  }

  // Opponent physics before vs after Air 1 slam
  if (t < SAMYAK_SLAM_IMPACT_TIME) {
    defender.x = sup.defenderOriginX;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
  } else {
    defender.vx *= Math.max(0, 1 - dt * 5.8);
    defender.x = Math.max(-8.8, Math.min(8.8, defender.x + defender.vx * dt));
    defender.y = GROUND_Y;
  }

  // Complete at 4.8s
  if (t >= sup.duration) {
    sup.phase = 'done';
    sup.active = false;
    attacker.y = GROUND_Y;
    attacker.vy = 0;
    attacker.vx = 0;
    attacker.action = 'idle';
    attacker.actionTimer = 0;
    attacker.expression = 'idle';

    if (!sup.endSignaled) {
      sup.endSignaled = true;
      signals.push({
        kind: 'super_end',
        x: attacker.x,
        y: 1.2,
      });
    }

    if (defender.hp <= 0) {
      resolveRoundEnd(state, attacker.slot, 'ko');
    }
  }

  return signals;
}
