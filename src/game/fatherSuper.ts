import { computeTotalSuperDamage, GROUND_Y, KNOCKDOWN_GROUND_DURATION, resolveRoundEnd } from './combat';
import type { CombatEvent, FighterState, MatchState } from './types';

export const FATHER_SUPER_DURATION = 5.2;
export const FATHER_SUPER_BANNER = 'RUSTICATION ORDER!';
export const FATHER_SUPER_SIGNATURE_TEXT =
  'AISA RUSTICATE KARUNGA... WAAPIS LAUT KE NHI AA PAYEGA!';
export const FATHER_LEVITATE_Y = 2.4;
export const FATHER_PAPER_COUNT = 14;

export type FatherSuperPhase =
  | 'levitate_sweep'
  | 'orbit_papers'
  | 'paper_barrage'
  | 'done';

export interface FatherSuperBeatSignal {
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

export interface FatherSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: FatherSuperPhase;
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

const BARRAGE_HIT_TIMES = [3.04, 3.22, 3.4, 3.58, 3.76, 3.94, 4.12];
const MASTER_NOTICE_IMPACT_TIME = 4.5;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function createFatherSuperState(
  attacker: FighterState,
  defender: FighterState,
): FatherSuperState {
  const totalBudget = computeTotalSuperDamage(defender.maxHp);
  const barragePool = Math.round(totalBudget * 0.5);
  const masterPool = Math.max(1, totalBudget - barragePool);

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: FATHER_SUPER_DURATION,
    phase: 'levitate_sweep',
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
 * Choreographed 5.2s Father Roy Dolphus "RUSTICATION ORDER!" Super sequence:
 * - Phase 1 (0.0s–1.5s): Dim arena with crimson-gold spotlight; Father levitates smoothly
 *   to y ≈ 2.4 while camera performs a cinematic low-angle orbit/sweep upward.
 * - Phase 2 (1.5s–2.8s): Summons 14 glowing red-bordered "RUSTICATE" official notices
 *   descending and orbiting rapidly around him + iconic signature dialogue pop-up.
 * - Phase 3 (2.8s–5.2s): Dual-palm thrust launches the 14 papers in a high-speed homing
 *   barrage (~50% of 33% cap), followed at 4.5s by a giant crimson-gold "RUSTICATED!"
 *   Master Notice slamming straight down (~50% remaining damage) into flat knockdown,
 *   then Father descends smoothly back to the arena floor.
 */
export function stepFatherSuper(
  state: MatchState,
  sup: FatherSuperState,
  dt: number,
  events: CombatEvent[],
): FatherSuperBeatSignal[] {
  const signals: FatherSuperBeatSignal[] = [];
  if (!sup.active) return signals;

  const attacker = state.fighters[sup.attackerSlot];
  const defender = state.fighters[sup.defenderSlot];

  sup.elapsed = Math.min(sup.duration, sup.elapsed + dt);
  const t = sup.elapsed;

  // Lock facing & clear velocity while choreographing
  attacker.facing = sup.defenderOriginX >= sup.attackerOriginX ? 1 : -1;
  defender.facing = (attacker.facing * -1) as 1 | -1;
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = sup.duration;
  attacker.invulnTimer = 0.25;
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.x = sup.attackerOriginX;

  // Phase 1 (0.0s–1.5s): Smooth dignified levitation up to y ≈ 2.4
  if (t < 1.5) {
    sup.phase = 'levitate_sweep';
    if (!sup.levitateSignaled) {
      sup.levitateSignaled = true;
      signals.push({
        kind: 'levitate_start',
        x: attacker.x,
        y: 1.55,
      });
    }
    const liftT = smoothstep(t / 1.35);
    attacker.y = liftT * FATHER_LEVITATE_Y + Math.sin(t * 3.8) * 0.05 * liftT;
    attacker.expression = 'attack';
    defender.x = sup.defenderOriginX;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    defender.action = 'idle';
    defender.expression = 'block';
    return signals;
  }

  // Phase 2 (1.5s–2.8s): Orbiting red "RUSTICATE" papers + iconic signature pop-up
  if (t < 2.8) {
    sup.phase = 'orbit_papers';
    if (!sup.papersSignaled) {
      sup.papersSignaled = true;
      signals.push({
        kind: 'papers_summon',
        x: attacker.x,
        y: FATHER_LEVITATE_Y + 1.15,
      });
    }
    if (!sup.signatureShown && t >= 1.82) {
      sup.signatureShown = true;
      events.push({
        type: 'super',
        attackerSlot: attacker.slot,
        x: attacker.x,
        y: attacker.y + 1.85,
        damage: 0,
        word: FATHER_SUPER_SIGNATURE_TEXT,
        isSuperSignature: true,
        color: '#FEF08A',
      });
    }

    attacker.y = FATHER_LEVITATE_Y + Math.sin((t - 1.5) * 4.2) * 0.08;
    attacker.expression = 'attack';
    defender.x = sup.defenderOriginX;
    defender.y = GROUND_Y;
    defender.vx = 0;
    defender.vy = 0;
    defender.action = 'idle';
    defender.expression = 'hit';
    return signals;
  }

  // Phase 3 (2.8s–5.2s): High-speed homing barrage -> Giant Master Notice slam -> smooth descent
  sup.phase = 'paper_barrage';
  if (!sup.barrageSignaled) {
    sup.barrageSignaled = true;
    signals.push({
      kind: 'barrage_start',
      x: attacker.x,
      y: FATHER_LEVITATE_Y + 1.0,
    });
  }

  // Hover calmly during barrage & finisher, then smoothly descend back to y=0 over 4.65s..5.2s
  if (t < 4.65) {
    attacker.y = FATHER_LEVITATE_Y + Math.sin((t - 2.8) * 5.2) * 0.07;
  } else {
    const descT = smoothstep((t - 4.65) / (sup.duration - 4.65));
    attacker.y = FATHER_LEVITATE_Y * (1 - descT);
  }
  attacker.expression = t >= MASTER_NOTICE_IMPACT_TIME ? 'victory' : 'attack';

  // Trigger timed multi-hit homing paper barrage (~50% of total 33% cap, never KOs early)
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
    // Keep opponent at >= 1 HP until the giant Master Notice finisher at 4.5s
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

  // Giant glowing crimson-gold "RUSTICATED!" Master Notice slams straight down at 4.5s (~50% remaining damage)
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

    defender.hitFlashTimer = 0.22;
    defender.squashX = 1.44;
    defender.squashY = 0.62;
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
      defender.knockdownTimer = KNOCKDOWN_GROUND_DURATION + 0.2;
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
          ? 'RUSTICATED FOR LIFE! PRINCIPAL MAN SEALS THE DISCIPLINARY KO!'
          : 'OFFICIAL RUSTICATION ORDER DELIVERED! OPPONENT FLATTENED ON ASSEMBLY GROUND!',
    });
  }

  // Opponent physics during barrage vs post-slam knockdown
  if (t < MASTER_NOTICE_IMPACT_TIME) {
    const jitter =
      sup.barrageHitsTriggered > 0 ? Math.sin(t * 42) * 0.14 : 0;
    defender.x = sup.defenderOriginX + jitter;
    defender.y = GROUND_Y;
  } else {
    defender.vx *= Math.max(0, 1 - dt * 6.5);
    defender.x = Math.max(-8.8, Math.min(8.8, defender.x + defender.vx * dt));
    defender.y = GROUND_Y;
  }

  // Complete at 5.2s
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
