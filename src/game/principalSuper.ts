import { computeTotalSuperDamage, GROUND_Y, KNOCKDOWN_GROUND_DURATION, resolveRoundEnd } from './combat';
import type { CombatEvent, FighterState, MatchState } from './types';

export const PRINCIPAL_SUPER_DURATION = 5.2;
export const PRINCIPAL_SUPER_BANNER = 'RUSTICATION ORDER!';
export const PRINCIPAL_SUPER_SIGNATURE_TEXT =
  'AISA RUSTICATE KARUNGA... WAAPIS LAUT KE NHI AA PAYEGA!';
export const PRINCIPAL_LEVITATE_Y = 2.4;
export const PRINCIPAL_PAPER_COUNT = 14;

export type PrincipalSuperPhase =
  | 'levitate_aura'
  | 'orbit_notices'
  | 'barrage_slam'
  | 'done';

export interface PrincipalSuperBeatSignal {
  kind:
    | 'levitate_start'
    | 'papers_summon'
    | 'barrage_start'
    | 'paper_hit'
    | 'master_notice_impact'
    | 'super_end';
  x: number;
  y: number;
  hitIndex?: number;
}

export interface PrincipalSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: PrincipalSuperPhase;
  attackerOriginX: number;
  defenderOriginX: number;
  totalDamageBudget: number;
  barrageDamagePool: number;
  barrageDamageDealt: number;
  masterDamagePool: number;
  levitateSignaled: boolean;
  papersSignaled: boolean;
  signatureShown: boolean;
  barrageSignaled: boolean;
  barrageHitsTriggered: number;
  masterHitTriggered: boolean;
  endSignaled: boolean;
}

const BARRAGE_HIT_TIMES = [3.04, 3.24, 3.44, 3.64, 3.84, 4.08];
const MASTER_NOTICE_IMPACT_TIME = 4.5;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function createPrincipalSuperState(
  attacker: FighterState,
  defender: FighterState,
): PrincipalSuperState {
  const totalBudget = computeTotalSuperDamage(defender.maxHp);
  const barragePool = Math.round(totalBudget * 0.5);
  const masterPool = Math.max(1, totalBudget - barragePool);

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: PRINCIPAL_SUPER_DURATION,
    phase: 'levitate_aura',
    attackerOriginX: attacker.x,
    defenderOriginX: defender.x,
    totalDamageBudget: totalBudget,
    barrageDamagePool: barragePool,
    barrageDamageDealt: 0,
    masterDamagePool: masterPool,
    levitateSignaled: false,
    papersSignaled: false,
    signatureShown: false,
    barrageSignaled: false,
    barrageHitsTriggered: 0,
    masterHitTriggered: false,
    endSignaled: false,
  };
}

/**
 * Choreographed 5.2s Principal Man "RUSTICATION ORDER!" Super sequence:
 * - Phase 1 (0.0s–1.5s): Smooth levitation to y ≈ 2.4 with pulsing golden-orange aura,
 *   swirling admin-paper wind, and low-angle camera sweep.
 * - Phase 2 (1.5s–2.8s): Summons 14 glowing red-bordered notices ("RUSTICATE", "DISCIPLINE",
 *   "RUSTICATED") orbiting in a rapid 3D vortex + iconic signature dialogue pop-up.
 * - Phase 3 (2.8s–5.2s): Cascading homing barrage of red notices (~50% of 33% cap),
 *   followed at 4.5s by a giant glowing red "FINAL RUSTICATION!" Notice Stamp slam
 *   (~50% remaining damage) with red shockwave ring, paper confetti, flat knockdown,
 *   and smooth float-down jacket-dusting finish.
 */
export function stepPrincipalSuper(
  state: MatchState,
  sup: PrincipalSuperState,
  dt: number,
  events: CombatEvent[],
): PrincipalSuperBeatSignal[] {
  const signals: PrincipalSuperBeatSignal[] = [];
  if (!sup.active) return signals;

  const attacker = state.fighters[sup.attackerSlot];
  const defender = state.fighters[sup.defenderSlot];

  sup.elapsed = Math.min(sup.duration, sup.elapsed + dt);
  const t = sup.elapsed;

  attacker.facing = sup.defenderOriginX >= sup.attackerOriginX ? 1 : -1;
  defender.facing = (attacker.facing * -1) as 1 | -1;
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = sup.duration;
  attacker.invulnTimer = 0.25;
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.x = sup.attackerOriginX;

  // Phase 1 (0.0s–1.5s): Smooth levitation + golden-orange aura + admin-paper wind
  if (t < 1.5) {
    sup.phase = 'levitate_aura';
    if (!sup.levitateSignaled) {
      sup.levitateSignaled = true;
      signals.push({
        kind: 'levitate_start',
        x: attacker.x,
        y: 1.55,
      });
    }
    const liftT = smoothstep(t / 1.35);
    attacker.y = liftT * PRINCIPAL_LEVITATE_Y + Math.sin(t * 4.0) * 0.05 * liftT;
    attacker.expression = 'attack';
    defender.x = sup.defenderOriginX;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    defender.action = 'idle';
    defender.expression = 'block';
    return signals;
  }

  // Phase 2 (1.5s–2.8s): 14 orbiting red-bordered notices + iconic signature pop-up
  if (t < 2.8) {
    sup.phase = 'orbit_notices';
    if (!sup.papersSignaled) {
      sup.papersSignaled = true;
      signals.push({
        kind: 'papers_summon',
        x: attacker.x,
        y: PRINCIPAL_LEVITATE_Y + 1.15,
      });
    }
    if (!sup.signatureShown && t >= 1.8) {
      sup.signatureShown = true;
      events.push({
        type: 'super',
        attackerSlot: attacker.slot,
        x: attacker.x,
        y: attacker.y + 1.85,
        damage: 0,
        word: PRINCIPAL_SUPER_SIGNATURE_TEXT,
        isSuperSignature: true,
        color: '#FEF08A',
      });
    }

    attacker.y = PRINCIPAL_LEVITATE_Y + Math.sin((t - 1.5) * 4.4) * 0.08;
    attacker.expression = 'attack';
    defender.x = sup.defenderOriginX;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    defender.action = 'idle';
    defender.expression = 'hit';
    return signals;
  }

  // Phase 3 (2.8s–5.2s): Homing barrage -> Giant "FINAL RUSTICATION!" Notice Stamp -> float down
  sup.phase = 'barrage_slam';
  if (!sup.barrageSignaled) {
    sup.barrageSignaled = true;
    signals.push({
      kind: 'barrage_start',
      x: attacker.x,
      y: PRINCIPAL_LEVITATE_Y + 1.0,
    });
  }

  if (t < 4.55) {
    attacker.y = PRINCIPAL_LEVITATE_Y + Math.sin((t - 2.8) * 5.2) * 0.07;
  } else {
    const descT = smoothstep((t - 4.55) / Math.max(0.1, sup.duration - 4.55));
    attacker.y = PRINCIPAL_LEVITATE_Y * (1 - descT);
  }
  attacker.expression = t >= MASTER_NOTICE_IMPACT_TIME ? 'victory' : 'attack';

  // Cascading homing barrage damage ticks (~50% of total 33% cap, never KOs early)
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

    signals.push({
      kind: 'paper_hit',
      x: defender.x,
      y: 1.18 + (hitIdx % 3) * 0.24,
      hitIndex: hitIdx,
    });
    events.push({
      type: 'hit',
      attackerSlot: attacker.slot,
      x: defender.x,
      y: 1.18 + (hitIdx % 3) * 0.24,
      damage: dmg,
      color: '#EF4444',
    });
  }

  // Giant glowing red "FINAL RUSTICATION!" Notice Stamp slams straight down at 4.5s
  if (!sup.masterHitTriggered && t >= MASTER_NOTICE_IMPACT_TIME) {
    sup.masterHitTriggered = true;
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
    defender.vx = attacker.facing * 2.2;
    defender.vy = 0;

    if (defender.hp <= 0) {
      defender.action = 'ko';
      defender.expression = 'ko';
      defender.hitstunTimer = 0;
    } else {
      defender.action = 'knockdown';
      defender.actionTimer = 0;
      defender.knockdownTimer = KNOCKDOWN_GROUND_DURATION + 0.24;
      defender.expression = 'hit';
    }

    signals.push({
      kind: 'master_notice_impact',
      x: defender.x,
      y: 0.95,
    });

    events.push({
      type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
      attackerSlot: attacker.slot,
      x: defender.x,
      y: 1.25,
      damage: dmg,
      color: '#EF4444',
      headline:
        defender.hp <= 0
          ? 'FINAL RUSTICATION DELIVERED! PRINCIPAL MAN SIGNS THE KNOCKOUT!'
          : 'DISCIPLINE RESTORED! PRINCIPAL MAN FLATTENS OPPONENT WITH RUSTICATION ORDER!',
    });
  }

  if (t < MASTER_NOTICE_IMPACT_TIME) {
    const jitter = sup.barrageHitsTriggered > 0 ? Math.sin(t * 42) * 0.14 : 0;
    defender.x = sup.defenderOriginX + jitter;
    defender.y = GROUND_Y;
  } else {
    defender.vx *= Math.max(0, 1 - dt * 6.5);
    defender.x = Math.max(-8.8, Math.min(8.8, defender.x + defender.vx * dt));
    defender.y = GROUND_Y;
  }

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
