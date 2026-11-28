import { ARENA_MAX_X, ARENA_MIN_X, GROUND_Y, computeTotalSuperDamage } from './combat';
import type { CombatEvent, FighterState } from './types';

export const KRISH_SUPER_DURATION = 3.0;
export const KRISH_SUPER_BANNER = '10KG HEAVY BAG SMASH!';
export const KRISH_SUPER_SIGNATURE_TEXT = '10 KILO KITABEIN — SEEDHA FLAT!';

export const KRISH_LEAP_START_TIME = 1.4;
export const KRISH_SMASH_START_TIME = 2.1;
export const KRISH_SMASH_IMPACT_TIME = 2.34;
export const KRISH_REATTACH_TIME = 2.72;

export type KrishSuperPhase =
  | 'unstrap_windup'
  | 'midair_leap'
  | 'overhead_smash'
  | 'done';

export interface KrishSuperState {
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: KrishSuperPhase;
  attackerOriginX: number;
  attackerFacing: 1 | -1;
  defenderOriginX: number;
  strikeX: number;
  bagDetached: boolean;
  bagInBothHands: boolean;
  smashImpactFired: boolean;
  totalDamageBudget: number;
  damageDealt: number;
  finisherTriggeredKo: boolean;
}

export interface KrishSuperBeatSignal {
  kind: 'unstrap_bag' | 'leap_raise' | 'bag_smash_impact' | 'bag_reattach';
  x: number;
  y: number;
  facing: 1 | -1;
}

function clampArena(x: number): number {
  return Math.max(ARENA_MIN_X + 0.35, Math.min(ARENA_MAX_X - 0.35, x));
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function createKrishSuperState(
  attacker: FighterState,
  defender: FighterState,
): KrishSuperState {
  const facing: 1 | -1 = attacker.x <= defender.x ? 1 : -1;
  const strikeX = clampArena(defender.x - facing * 0.92);
  return {
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: KRISH_SUPER_DURATION,
    phase: 'unstrap_windup',
    attackerOriginX: attacker.x,
    attackerFacing: facing,
    defenderOriginX: defender.x,
    strikeX,
    bagDetached: true,
    bagInBothHands: false,
    smashImpactFired: false,
    totalDamageBudget: computeTotalSuperDamage(defender.maxHp),
    damageDealt: 0,
    finisherTriggeredKo: false,
  };
}

/**
 * Pure deterministic simulation for Krish's 3.0s "10KG HEAVY BAG SMASH!" Super Power:
 * - Phase 1 (0.0s–1.4s): Reaches back with right arm, detaches 3D black backpack into right hand,
 *   swings back with golden-olive brawler power aura.
 * - Phase 2 (1.4s–2.1s): Explosive mid-air leap toward opponent raising the 10kg backpack high
 *   overhead with BOTH hands while camera zooms in dynamically.
 * - Phase 3 (2.1s–3.0s): Overhead downward bag slam onto opponent at 2.34s dealing strictly
 *   33% maxHP Super damage, scattering 3D notebooks/books & golden shockwave, then cleanly
 *   re-attaching backpack onto Krish's back on landing.
 */
export function stepKrishSuper(
  sup: KrishSuperState,
  attacker: FighterState,
  defender: FighterState,
  dt: number,
  events: CombatEvent[],
  signals: KrishSuperBeatSignal[],
): boolean {
  const prevElapsed = sup.elapsed;
  sup.elapsed = Math.min(sup.duration, sup.elapsed + dt);
  const t = sup.elapsed;

  attacker.facing = sup.attackerFacing;
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = sup.duration;
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.invulnTimer = Math.max(attacker.invulnTimer, 0.2);

  if (prevElapsed < 0.14 && t >= 0.14) {
    signals.push({
      kind: 'unstrap_bag',
      x: attacker.x,
      y: 1.35,
      facing: sup.attackerFacing,
    });
  }

  if (t < KRISH_LEAP_START_TIME) {
    sup.phase = 'unstrap_windup';
    sup.bagDetached = true;
    sup.bagInBothHands = false;
    attacker.x = sup.attackerOriginX;
    attacker.y = GROUND_Y;
    attacker.expression = 'attack';
    defender.vx *= 0.84;
    if (defender.y > GROUND_Y) {
      defender.y = Math.max(GROUND_Y, defender.y - dt * 6);
    }
    return false;
  }

  if (t < KRISH_SMASH_START_TIME) {
    sup.phase = 'midair_leap';
    sup.bagDetached = true;
    sup.bagInBothHands = true;
    attacker.expression = 'attack';

    if (prevElapsed < KRISH_LEAP_START_TIME) {
      signals.push({
        kind: 'leap_raise',
        x: attacker.x,
        y: 1.85,
        facing: sup.attackerFacing,
      });
    }

    const leapNorm = smoothstep(
      (t - KRISH_LEAP_START_TIME) / (KRISH_SMASH_START_TIME - KRISH_LEAP_START_TIME),
    );
    attacker.x =
      sup.attackerOriginX + (sup.strikeX - sup.attackerOriginX) * Math.min(1, leapNorm * 0.88);
    // High athletic parabolic leap peaking at ~2.45m right before overhead slam
    attacker.y = Math.sin(leapNorm * Math.PI * 0.78) * 2.48;
    defender.vx *= 0.82;
    return false;
  }

  sup.phase = t >= sup.duration ? 'done' : 'overhead_smash';

  if (t < KRISH_SMASH_IMPACT_TIME) {
    // Diving downward with the 10kg backpack raised overhead
    sup.bagDetached = true;
    sup.bagInBothHands = true;
    const dropNorm = smoothstep(
      (t - KRISH_SMASH_START_TIME) / (KRISH_SMASH_IMPACT_TIME - KRISH_SMASH_START_TIME),
    );
    attacker.x = sup.attackerOriginX + (sup.strikeX - sup.attackerOriginX) * (0.88 + 0.12 * dropNorm);
    const startY = Math.sin(0.78 * Math.PI) * 2.48;
    attacker.y = Math.max(GROUND_Y, startY * (1 - dropNorm));
  } else {
    attacker.x = sup.strikeX;
    attacker.y = GROUND_Y;
    if (t < KRISH_REATTACH_TIME) {
      sup.bagDetached = true;
      sup.bagInBothHands = false;
    } else {
      if (sup.bagDetached) {
        sup.bagDetached = false;
        sup.bagInBothHands = false;
        signals.push({
          kind: 'bag_reattach',
          x: attacker.x,
          y: 1.35,
          facing: sup.attackerFacing,
        });
      }
    }
  }

  // Exact overhead bag slam impact beat ("seedha flat kar dunga!")
  if (!sup.smashImpactFired && t >= KRISH_SMASH_IMPACT_TIME) {
    sup.smashImpactFired = true;
    const remainingBudget = Math.max(0, sup.totalDamageBudget - sup.damageDealt);
    const actualDamage = Math.min(remainingBudget, defender.hp);
    defender.hp = Math.max(0, defender.hp - actualDamage);
    sup.damageDealt += actualDamage;
    attacker.damageDealt += actualDamage;
    attacker.superDamageDealt = sup.damageDealt;
    attacker.comboCount += 1;
    attacker.comboTimer = 2.0;
    if (attacker.comboCount > attacker.maxCombo) {
      attacker.maxCombo = attacker.comboCount;
    }

    defender.hitFlashTimer = 0.24;
    defender.squashX = 1.48;
    defender.squashY = 0.52;
    defender.vx = sup.attackerFacing * 8.4;
    defender.vy = 5.8;
    defender.y = 0.12;
    defender.blockstunTimer = 0;

    if (defender.hp <= 0) {
      sup.finisherTriggeredKo = true;
      defender.action = 'ko';
      defender.expression = 'ko';
      defender.hitstunTimer = 0;
    } else {
      defender.action = 'knockdown';
      defender.actionTimer = 0;
      defender.knockdownTimer = 0.82;
      defender.hitstunTimer = 0;
      defender.expression = 'hit';
    }

    signals.push({
      kind: 'bag_smash_impact',
      x: defender.x,
      y: 0.95,
      facing: sup.attackerFacing,
    });

    events.push({
      type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
      attackerSlot: attacker.slot,
      x: defender.x,
      y: 1.25,
      damage: actualDamage,
      word: KRISH_SUPER_SIGNATURE_TEXT,
      isSuperSignature: true,
      moveCallout: KRISH_SUPER_BANNER,
      color: '#A3E635',
      headline:
        defender.hp <= 0
          ? 'BREAKING: KRISH FLATTENS OPPONENT WITH THE 10KG HEAVY BAG SMASH!'
          : '10KG HEAVY BAG SMASH! TEXTBOOKS FLY ACROSS THE ARENA!',
    });
  }

  // Defender airborne recoil physics after bag smash
  if (sup.smashImpactFired) {
    defender.vy -= 21 * dt;
    defender.x = clampArena(defender.x + defender.vx * dt);
    defender.y = Math.max(GROUND_Y, defender.y + defender.vy * dt);
    if (defender.y <= GROUND_Y) {
      defender.y = GROUND_Y;
      defender.vx *= 0.72;
      defender.vy = 0;
    }
  }

  if (t >= sup.duration) {
    sup.phase = 'done';
    sup.bagDetached = false;
    sup.bagInBothHands = false;
    attacker.y = GROUND_Y;
    attacker.vx = 0;
    attacker.vy = 0;
    attacker.action = 'idle';
    attacker.actionTimer = 0;
    attacker.expression = 'idle';
    return true;
  }

  return false;
}
