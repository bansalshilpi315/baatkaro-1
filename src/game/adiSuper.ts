import {
  computeTotalSuperDamage,
  GROUND_Y,
  KNOCKDOWN_GROUND_DURATION,
  resolveRoundEnd,
} from './combat';
import type { CombatEvent, FighterState, MatchState } from './types';

export const ADI_SUPER_DURATION = 4.6;
export const ADI_SUPER_BANNER = 'ADI LAST-BENCH STRIKE!';
export const ADI_SUPER_SIGNATURE_TEXT = 'LAST BENCH SE SEEDHA TOP SCORE!';

export const ADI_BARRAGE_HIT_TIMES: readonly number[] = [
  1.22, 1.50, 1.78, 2.06, 2.34, 2.66,
];
export const ADI_AURA_SURGE_TIME = 0.55;
export const ADI_BARRAGE_SUMMON_TIME = 1.02;
export const ADI_FINISHER_LEAP_TIME = 3.0;
export const ADI_FINISHER_IMPACT_TIME = 3.62;
export const ADI_LANDING_END_TIME = 4.18;

export type AdiSuperPhase = 'collar_flex' | 'bench_barrage' | 'finisher_slam' | 'done';

export interface AdiSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: AdiSuperPhase;
  originX: number;
  defenderX: number;
  strikeX: number;
  settleX: number;
  facing: 1 | -1;
  totalDamageTarget: number;
  barrageDamagePool: number;
  barrageDamageDealt: number;
  collarFlexSignaled: boolean;
  auraSurgeFired: boolean;
  signatureShown: boolean;
  barrageSummoned: boolean;
  barrageHitsApplied: number;
  finisherLeaped: boolean;
  finisherImpactFired: boolean;
  endSignaled: boolean;
}

export interface AdiSuperBeatSignal {
  kind:
    | 'collar_flex'
    | 'aura_surge'
    | 'barrage_summon'
    | 'barrage_hit'
    | 'finisher_leap'
    | 'last_bench_impact'
    | 'super_end';
  x: number;
  y: number;
  facing: 1 | -1;
  hitIndex?: number;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function clampArenaX(x: number): number {
  return Math.max(-8.4, Math.min(8.4, x));
}

export function createAdiSuperState(
  attacker: FighterState,
  defender: FighterState,
): AdiSuperState {
  const facing: 1 | -1 = defender.x >= attacker.x ? 1 : -1;
  const totalDamageTarget = computeTotalSuperDamage(defender.maxHp);
  const barrageDamagePool = Math.round(totalDamageTarget * 0.45);
  const strikeX = clampArenaX(defender.x - facing * 0.85);
  const settleX = clampArenaX(defender.x - facing * 1.75);

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: ADI_SUPER_DURATION,
    phase: 'collar_flex',
    originX: attacker.x,
    defenderX: defender.x,
    strikeX,
    settleX,
    facing,
    totalDamageTarget,
    barrageDamagePool,
    barrageDamageDealt: 0,
    collarFlexSignaled: false,
    auraSurgeFired: false,
    signatureShown: false,
    barrageSummoned: false,
    barrageHitsApplied: 0,
    finisherLeaped: false,
    finisherImpactFired: false,
    endSignaled: false,
  };
}

/**
 * Choreographed 4.6s Adi "ADI LAST-BENCH STRIKE!" Super sequence:
 * - Phase 1 (0.0s–1.1s): Collar snap & knuckle crack under olive-emerald & gold spotlight,
 *   aura surge at 0.55s, and iconic Last-Bench signature callout.
 * - Phase 2 (1.1s–3.0s): Rapid 6-hit spiral notebook & chalk-duster barrage (~45% of strict
 *   33% maxHP cap, clamped non-lethal so defender stays >= 1 HP until finisher).
 * - Phase 3 (3.0s–4.6s): Acrobatic Last-Bench leaping spinning strike landing at 3.62s
 *   (~55% remaining damage, strict 33% maxHP cap), blasting opponent into knockdown/KO.
 */
export function stepAdiSuper(
  state: MatchState,
  sup: AdiSuperState,
  dt: number,
  events: CombatEvent[],
): AdiSuperBeatSignal[] {
  const signals: AdiSuperBeatSignal[] = [];
  if (!sup.active) return signals;

  const attacker = state.fighters[sup.attackerSlot];
  const defender = state.fighters[sup.defenderSlot];

  sup.elapsed = Math.min(sup.duration, sup.elapsed + dt);
  const t = sup.elapsed;

  attacker.facing = sup.facing;
  defender.facing = (sup.facing * -1) as 1 | -1;
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = sup.duration;
  attacker.invulnTimer = 0.25;
  attacker.vx = 0;
  attacker.vy = 0;

  // Phase 1 (0.0s–1.1s): Collar Flex & Emerald-Gold Last-Bench Aura Surge
  if (t < 1.1) {
    sup.phase = 'collar_flex';
    if (!sup.collarFlexSignaled) {
      sup.collarFlexSignaled = true;
      signals.push({
        kind: 'collar_flex',
        x: attacker.x,
        y: 1.55,
        facing: sup.facing,
      });
    }
    if (!sup.auraSurgeFired && t >= ADI_AURA_SURGE_TIME) {
      sup.auraSurgeFired = true;
      signals.push({
        kind: 'aura_surge',
        x: attacker.x,
        y: 1.78,
        facing: sup.facing,
      });
    }
    if (!sup.signatureShown && t >= 0.72) {
      sup.signatureShown = true;
      events.push({
        type: 'super',
        attackerSlot: attacker.slot,
        x: attacker.x,
        y: 2.32,
        damage: 0,
        word: ADI_SUPER_SIGNATURE_TEXT,
        isSuperSignature: true,
        color: '#BEF264',
      });
    }
    if (!sup.barrageSummoned && t >= ADI_BARRAGE_SUMMON_TIME) {
      sup.barrageSummoned = true;
      signals.push({
        kind: 'barrage_summon',
        x: attacker.x,
        y: 1.85,
        facing: sup.facing,
      });
    }

    attacker.x = sup.originX;
    attacker.y = GROUND_Y;
    attacker.expression = 'attack';
    defender.x = sup.defenderX;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    defender.action = 'idle';
    defender.expression = 'block';
    return signals;
  }

  // Phase 2 (1.1s–3.0s): 6-Hit Spiral Notebook & Chalk-Duster Barrage (~45% of 33% cap)
  if (t < ADI_FINISHER_LEAP_TIME) {
    sup.phase = 'bench_barrage';
    if (!sup.barrageSummoned) {
      sup.barrageSummoned = true;
      signals.push({
        kind: 'barrage_summon',
        x: attacker.x,
        y: 1.85,
        facing: sup.facing,
      });
    }

    attacker.x = sup.originX;
    attacker.y = GROUND_Y;
    attacker.expression = 'attack';

    while (
      sup.barrageHitsApplied < ADI_BARRAGE_HIT_TIMES.length &&
      t >= ADI_BARRAGE_HIT_TIMES[sup.barrageHitsApplied]
    ) {
      const hitIdx = sup.barrageHitsApplied;
      sup.barrageHitsApplied += 1;

      const hitsRemaining = ADI_BARRAGE_HIT_TIMES.length - hitIdx;
      const poolRemaining = Math.max(0, sup.barrageDamagePool - sup.barrageDamageDealt);
      const plannedDamage = Math.max(1, Math.round(poolRemaining / hitsRemaining));
      const capRemaining = Math.max(0, sup.totalDamageTarget - attacker.superDamageDealt);
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
      defender.hitFlashTimer = 0.11;
      defender.squashX = 1.18;
      defender.squashY = 0.84;

      const hitY = 1.18 + (hitIdx % 3) * 0.24;
      signals.push({
        kind: 'barrage_hit',
        x: defender.x,
        y: hitY,
        facing: sup.facing,
        hitIndex: hitIdx,
      });
      events.push({
        type: 'hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: hitY,
        damage: dmg,
        color: hitIdx % 2 === 0 ? '#84CC16' : '#FACC15',
      });
    }

    const jitter = sup.barrageHitsApplied > 0 ? Math.sin(t * 44) * 0.12 : 0;
    defender.x = sup.defenderX + jitter;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    return signals;
  }

  // Phase 3 (3.0s–4.6s): Acrobatic Last-Bench Leaping Spinning Finisher Slam
  sup.phase = 'finisher_slam';
  if (!sup.finisherLeaped) {
    sup.finisherLeaped = true;
    signals.push({
      kind: 'finisher_leap',
      x: attacker.x,
      y: 0.45,
      facing: sup.facing,
    });
  }

  if (t < ADI_FINISHER_IMPACT_TIME) {
    const p = smoothstep(
      (t - ADI_FINISHER_LEAP_TIME) / (ADI_FINISHER_IMPACT_TIME - ADI_FINISHER_LEAP_TIME),
    );
    attacker.x = sup.originX + (sup.strikeX - sup.originX) * p;
    attacker.y = Math.sin(p * Math.PI) * 2.35;
    attacker.expression = 'attack';
  } else if (t < ADI_LANDING_END_TIME) {
    const p = (t - ADI_FINISHER_IMPACT_TIME) / (ADI_LANDING_END_TIME - ADI_FINISHER_IMPACT_TIME);
    attacker.x = sup.strikeX + (sup.settleX - sup.strikeX) * p;
    attacker.y = Math.sin(p * Math.PI) * 0.52;
    attacker.expression = 'victory';
  } else {
    attacker.x = sup.settleX;
    attacker.y = GROUND_Y;
    attacker.expression = 'victory';
  }

  // Trigger explosive Last-Bench Strike impact at 3.62s (~55% remaining of strict 33% cap)
  if (!sup.finisherImpactFired && t >= ADI_FINISHER_IMPACT_TIME) {
    sup.finisherImpactFired = true;
    const capRemaining = Math.max(0, sup.totalDamageTarget - attacker.superDamageDealt);
    const dmg = Math.min(capRemaining, defender.hp);

    if (dmg > 0) {
      defender.hp = Math.max(0, defender.hp - dmg);
      attacker.damageDealt += dmg;
      attacker.superDamageDealt += dmg;
    }

    attacker.comboCount += 1;
    attacker.comboTimer = 2.4;
    if (attacker.comboCount > attacker.maxCombo) attacker.maxCombo = attacker.comboCount;

    defender.hitFlashTimer = 0.24;
    defender.squashX = 1.44;
    defender.squashY = 0.62;
    defender.y = GROUND_Y;
    defender.vx = sup.facing * 5.6;
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
      kind: 'last_bench_impact',
      x: defender.x,
      y: 1.15,
      facing: sup.facing,
    });

    events.push({
      type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
      attackerSlot: attacker.slot,
      x: defender.x,
      y: 1.32,
      damage: dmg,
      color: '#BEF264',
      headline:
        defender.hp <= 0
          ? 'LAST-BENCH KNOCKOUT! ADI TOPS THE SCOREBOARD!'
          : 'ADI LAST-BENCH STRIKE SHAKES THE ENTIRE ARENA!',
    });
  }

  // Opponent physics before vs after impact
  if (t < ADI_FINISHER_IMPACT_TIME) {
    defender.x = sup.defenderX;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
  } else {
    defender.vx *= Math.max(0, 1 - dt * 5.6);
    defender.x = Math.max(-8.8, Math.min(8.8, defender.x + defender.vx * dt));
    defender.y = GROUND_Y;
  }

  // Finish Super cleanly at 4.6s
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
        facing: sup.facing,
      });
    }

    if (defender.hp <= 0) {
      resolveRoundEnd(state, attacker.slot, 'ko');
    }
  }

  return signals;
}
