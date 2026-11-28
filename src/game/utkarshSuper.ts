import { ARENA_MAX_X, ARENA_MIN_X, GROUND_Y, computeTotalSuperDamage } from './combat';
import type { CombatEvent, FighterState } from './types';

export const UTKARSH_SUPER_DURATION = 3.4;
export const UTKARSH_SUPER_BANNER = 'LIGHTNING ORBIT BLITZ!';
export const UTKARSH_SUPER_SIGNATURE_TEXT = 'PAKAD KE DIKHA — LIGHTNING SPEED!';

export const UTKARSH_ORBIT_START_TIME = 1.7;
export const UTKARSH_FINISHER_IMPACT_TIME = 3.06;
export const UTKARSH_ORBIT_REVOLUTIONS = 3.5;

const ORBIT_STRIKE_TIMES: readonly number[] = [1.88, 2.08, 2.28, 2.48, 2.68, 2.88];

export type UtkarshSuperPhase = 'laugh_taunt' | 'orbit_blitz' | 'done';

export interface UtkarshSuperState {
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: UtkarshSuperPhase;
  attackerOriginX: number;
  attackerFacing: 1 | -1;
  defenderOriginX: number;
  attackerZ: number;
  orbitAngle: number;
  orbitTangentYaw: number;
  orbitActive: boolean;
  strikesLanded: number;
  finisherFired: boolean;
  totalDamageBudget: number;
  damageDealt: number;
  finisherTriggeredKo: boolean;
}

export interface UtkarshSuperBeatSignal {
  kind: 'laugh_taunt' | 'sneaker_sparks' | 'orbit_start' | 'orbit_strike' | 'electric_finisher';
  x: number;
  y: number;
  z: number;
  facing: 1 | -1;
}

function clampArena(x: number): number {
  return Math.max(ARENA_MIN_X + 0.35, Math.min(ARENA_MAX_X - 0.35, x));
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function createUtkarshSuperState(
  attacker: FighterState,
  defender: FighterState,
): UtkarshSuperState {
  const facing: 1 | -1 = attacker.x <= defender.x ? 1 : -1;
  return {
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: UTKARSH_SUPER_DURATION,
    phase: 'laugh_taunt',
    attackerOriginX: attacker.x,
    attackerFacing: facing,
    defenderOriginX: defender.x,
    attackerZ: 0,
    orbitAngle: 0,
    orbitTangentYaw: facing === 1 ? Math.PI * 0.42 : -Math.PI * 0.42,
    orbitActive: false,
    strikesLanded: 0,
    finisherFired: false,
    totalDamageBudget: computeTotalSuperDamage(defender.maxHp),
    damageDealt: 0,
    finisherTriggeredKo: false,
  };
}

/**
 * Pure deterministic simulation for Utkarsh's 3.4s "LIGHTNING ORBIT BLITZ!" Super Power:
 * - Phase 1 (0.0s–1.7s, synced to laugh + "Pakad ke dikha bhai..."): Expressive grounded
 *   laughing taunt with cyan electric sparks crackling around sneakers.
 * - Phase 2 (1.7s–3.4s, synced to "ab dekh meri lightning speed!"): Hyper-speed 3.5-revolution
 *   360° circular sprint in 3D XZ space orbiting around opponent while darting inward to deliver
 *   6 multi-hit electric strikes from multiple angles, finishing with an electric launch blow at
 *   3.06s (strict 33% maxHP cap) before snapping cleanly back to Z=0 fighting stance.
 */
export function stepUtkarshSuper(
  sup: UtkarshSuperState,
  attacker: FighterState,
  defender: FighterState,
  dt: number,
  events: CombatEvent[],
  signals: UtkarshSuperBeatSignal[],
): boolean {
  const prevElapsed = sup.elapsed;
  sup.elapsed = Math.min(sup.duration, sup.elapsed + dt);
  const t = sup.elapsed;

  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = sup.duration;
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.invulnTimer = Math.max(attacker.invulnTimer, 0.2);

  // Phase 1 (0.0s–1.7s): Grounded laughing taunt + sneaker sparks
  if (t < UTKARSH_ORBIT_START_TIME) {
    sup.phase = 'laugh_taunt';
    sup.orbitActive = false;
    sup.attackerZ = 0;
    sup.orbitAngle = 0;
    attacker.facing = sup.attackerFacing;
    attacker.x = sup.attackerOriginX;
    attacker.y = GROUND_Y;
    attacker.expression = 'victory';

    if (prevElapsed < 0.06 && t >= 0.06) {
      signals.push({
        kind: 'laugh_taunt',
        x: attacker.x,
        y: 1.5,
        z: 0,
        facing: sup.attackerFacing,
      });
    }
    if (
      (prevElapsed < 0.45 && t >= 0.45) ||
      (prevElapsed < 1.15 && t >= 1.15)
    ) {
      signals.push({
        kind: 'sneaker_sparks',
        x: attacker.x,
        y: 0.22,
        z: 0,
        facing: sup.attackerFacing,
      });
    }

    defender.vx *= 0.84;
    if (defender.y > GROUND_Y) {
      defender.y = Math.max(GROUND_Y, defender.y - dt * 6);
    }
    return false;
  }

  // Phase 2 (1.7s–3.4s): 3.5-revolution circular XZ sprint + multi-hit strikes + electric finisher
  sup.phase = t >= sup.duration ? 'done' : 'orbit_blitz';
  attacker.expression = 'attack';

  if (prevElapsed < UTKARSH_ORBIT_START_TIME) {
    signals.push({
      kind: 'orbit_start',
      x: attacker.x,
      y: 0.8,
      z: 0,
      facing: sup.attackerFacing,
    });
  }

  const orbitCenter = sup.defenderOriginX;
  const returnX = clampArena(orbitCenter - sup.attackerFacing * 1.45);

  if (t < UTKARSH_FINISHER_IMPACT_TIME) {
    sup.orbitActive = true;
    const orbitSpan = UTKARSH_FINISHER_IMPACT_TIME - UTKARSH_ORBIT_START_TIME;
    const orbitNorm = Math.max(0, Math.min(1, (t - UTKARSH_ORBIT_START_TIME) / orbitSpan));

    // Smooth entry from attackerOriginX into the circular orbit around defender
    const entryBlend = smoothstep(Math.min(1, (t - UTKARSH_ORBIT_START_TIME) / 0.14));
    // Start angle on attacker's side of defender (PI if attacker is on left, 0 if on right)
    const startTheta = sup.attackerFacing === 1 ? Math.PI : 0;
    const theta = startTheta + orbitNorm * UTKARSH_ORBIT_REVOLUTIONS * Math.PI * 2 * sup.attackerFacing;
    sup.orbitAngle = theta;

    // Pulse radius inward slightly on strike beats so Utkarsh darts in & out dynamically
    const dartPulse = Math.abs(Math.sin(orbitNorm * ORBIT_STRIKE_TIMES.length * Math.PI));
    const radiusX = 1.78 - dartPulse * 0.62;
    const radiusZ = 1.68 - dartPulse * 0.45;

    const orbitX = clampArena(orbitCenter + Math.cos(theta) * radiusX);
    const orbitZ = Math.sin(theta) * radiusZ;

    attacker.x = sup.attackerOriginX * (1 - entryBlend) + orbitX * entryBlend;
    sup.attackerZ = orbitZ * entryBlend;
    attacker.y = GROUND_Y + Math.abs(Math.sin(orbitNorm * 14 * Math.PI)) * 0.18;

    // Compute forward sprint tangent direction along the circular orbit so rig leans & faces velocity!
    const dirSign = sup.attackerFacing;
    const tanX = -Math.sin(theta) * dirSign * radiusX;
    const tanZ = Math.cos(theta) * dirSign * radiusZ;
    sup.orbitTangentYaw = Math.atan2(tanX, tanZ);
    attacker.facing = tanX >= 0 ? 1 : -1;

    // Check 6 multi-hit orbit strikes (non-lethal, ~46% of total 33% budget)
    const multiHitBudget = Math.max(6, Math.round(sup.totalDamageBudget * 0.46));
    const perStrikeDmg = Math.max(1, Math.floor(multiHitBudget / ORBIT_STRIKE_TIMES.length));

    while (
      sup.strikesLanded < ORBIT_STRIKE_TIMES.length &&
      t >= ORBIT_STRIKE_TIMES[sup.strikesLanded]
    ) {
      sup.strikesLanded += 1;
      const nonLethalCap = Math.max(0, defender.hp - 1);
      const budgetLeft = Math.max(0, sup.totalDamageBudget - sup.damageDealt);
      const dmg = Math.min(perStrikeDmg, nonLethalCap, budgetLeft);
      if (dmg > 0) {
        defender.hp = Math.max(1, defender.hp - dmg);
        sup.damageDealt += dmg;
        attacker.damageDealt += dmg;
        attacker.superDamageDealt = sup.damageDealt;
      }
      attacker.comboCount += 1;
      attacker.comboTimer = 2.0;
      if (attacker.comboCount > attacker.maxCombo) {
        attacker.maxCombo = attacker.comboCount;
      }
      defender.action = 'hit';
      defender.actionTimer = 0;
      defender.expression = 'hit';
      defender.hitFlashTimer = 0.1;
      defender.squashX = 1.22;
      defender.squashY = 0.84;

      signals.push({
        kind: 'orbit_strike',
        x: defender.x,
        y: 1.1 + (sup.strikesLanded % 3) * 0.18,
        z: sup.attackerZ * 0.3,
        facing: attacker.facing,
      });

      events.push({
        type: 'hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.25,
        damage: dmg,
        word: sup.strikesLanded % 2 === 0 ? 'ZAP!' : 'BLITZ!',
        color: '#38BDF8',
      });
    }
  } else {
    // Electric launch finisher at 3.06s -> smooth snap back to Z=0 fighting stance
    const settleT = smoothstep(
      (t - UTKARSH_FINISHER_IMPACT_TIME) / Math.max(0.1, sup.duration - UTKARSH_FINISHER_IMPACT_TIME),
    );
    sup.orbitActive = settleT < 0.45;
    attacker.x = attacker.x + (returnX - attacker.x) * Math.min(1, dt * 14);
    sup.attackerZ = sup.attackerZ * (1 - settleT);
    attacker.y = GROUND_Y;
    attacker.facing = sup.attackerFacing;
    sup.orbitTangentYaw = sup.attackerFacing === 1 ? Math.PI * 0.42 : -Math.PI * 0.42;

    if (!sup.finisherFired) {
      sup.finisherFired = true;
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
      defender.squashX = 0.8;
      defender.squashY = 1.28;
      defender.vx = sup.attackerFacing * 8.6;
      defender.vy = 7.4;
      defender.y = 0.14;
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
        kind: 'electric_finisher',
        x: defender.x,
        y: 1.2,
        z: 0,
        facing: sup.attackerFacing,
      });

      events.push({
        type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.35,
        damage: actualDamage,
        word: UTKARSH_SUPER_SIGNATURE_TEXT,
        isSuperSignature: true,
        moveCallout: UTKARSH_SUPER_BANNER,
        color: '#38BDF8',
        headline:
          defender.hp <= 0
            ? 'BREAKING: UTKARSH SHOCKS THE ARENA WITH LIGHTNING ORBIT BLITZ!'
            : 'LIGHTNING ORBIT BLITZ! 360° ELECTRIC SPEED BARRAGE!',
      });
    }

    // Defender electric launch recoil physics
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
    sup.orbitActive = false;
    sup.attackerZ = 0;
    attacker.x = returnX;
    attacker.y = GROUND_Y;
    attacker.facing = sup.attackerFacing;
    attacker.vx = 0;
    attacker.vy = 0;
    attacker.action = 'idle';
    attacker.actionTimer = 0;
    attacker.expression = 'idle';
    return true;
  }

  return false;
}
