import type { CombatEvent, FighterState, MatchState } from './types';
import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  GROUND_Y,
  KNOCKDOWN_GROUND_DURATION,
  computeTotalSuperDamage,
  resolveRoundEnd,
} from './combat';

export const MAUSI_SUPER_DURATION = 5.0;
export const MAUSI_SUPER_BANNER = 'GOL-GOL LADDOO BARRAGE!';
export const MAUSI_LEVITATION_PEAK_Y = 2.0;
export const MAUSI_LADDOO_COUNT = 14;
export const MAUSI_MEGA_LAUNCH_TIME = 4.02;
export const MAUSI_MEGA_IMPACT_TIME = 4.3;

// 7 timed multi-hit ticks across Phase 3's rapid storm of 14 glowing laddoos (~50% of totalSuperDamage)
export const MAUSI_BARRAGE_HIT_TIMES = [2.68, 2.9, 3.12, 3.34, 3.56, 3.78, 4.0] as const;
export const MAUSI_BARRAGE_DAMAGE_SHARE = 0.5;

const MAUSI_BARRAGE_WORDS = [
  'LADDOO POWER!',
  'MEETHA HIT!',
  'GOL-GOL!',
  'LADDOO POWER!',
  'MEETHA HIT!',
  'BESAN BLAST!',
  'LADDOO POWER!',
] as const;

export type MausiSuperPhase =
  | 'laddoo_gulp'    // 0.0s - 1.6s: Holds up glowing golden Power Laddoo, pops into mouth, fiery golden aura ignites
  | 'levitate'       // 1.6s - 2.5s: Levitates smoothly to y=2.0 with golden aura rings & fluttering saree pallu
  | 'laddoo_barrage'; // 2.5s - 5.0s: Fires 14 glowing golden laddoos (~50%) + 4.3s Mega Laddoo finisher (~50%) + touchdown

export interface MausiSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: MausiSuperPhase;
  auraIgnited: boolean;
  levitationStarted: boolean;
  barrageStarted: boolean;
  barrageHitsLanded: number;
  barrageDamageDealt: number;
  megaLaunched: boolean;
  megaImpacted: boolean;
  totalSuperDamage: number;
  barrageDamageBudget: number;
  superDamageDealt: number;
  targetX: number;
}

export interface MausiSuperBeatSignal {
  kind:
    | 'gulp_start'
    | 'aura_ignite'
    | 'levitate_start'
    | 'barrage_start'
    | 'laddoo_hit'
    | 'mega_launch'
    | 'mega_impact'
    | 'super_end';
  x: number;
  y: number;
  hitIndex?: number;
}

export function getMausiSuperPhase(elapsed: number): MausiSuperPhase {
  if (elapsed < 1.6) return 'laddoo_gulp';
  if (elapsed < 2.5) return 'levitate';
  return 'laddoo_barrage';
}

/**
 * Smooth power-up levitation altitude curve for Laddoo Mausi:
 * - 0.00s..1.60s: Grounded while presenting & gulping the glowing Power Laddoo
 * - 1.60s..2.45s: Smooth cubic rise to y ≈ 2.0 units above the arena floor
 * - 2.45s..4.35s: Hovering gently around y ≈ 2.0 while firing the laddoo storm + Mega Laddoo
 * - 4.35s..4.98s: Smooth graceful touchdown back onto the arena floor (y = 0)
 */
export function getMausiLevitationY(elapsed: number): number {
  if (elapsed <= 1.6 || elapsed >= MAUSI_SUPER_DURATION) return GROUND_Y;
  if (elapsed < 2.45) {
    const p = (elapsed - 1.6) / 0.85;
    const eased = 1 - Math.pow(1 - p, 3);
    return eased * MAUSI_LEVITATION_PEAK_Y;
  }
  if (elapsed < 4.35) {
    return MAUSI_LEVITATION_PEAK_Y + Math.sin((elapsed - 2.45) * 4.6) * 0.08;
  }
  const downT = Math.min(1, (elapsed - 4.35) / 0.62);
  const easedDown = downT * downT * (3 - 2 * downT);
  return Math.max(GROUND_Y, MAUSI_LEVITATION_PEAK_Y * (1 - easedDown));
}

/**
 * Computes warm festive golden-orange vignette dim factor [0..1] across the 5.0s sequence.
 */
export function getMausiSuperDimFactor(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= MAUSI_SUPER_DURATION) return 0;
  if (elapsed < 0.25) return elapsed / 0.25;
  if (elapsed > 4.45) return Math.max(0, 1 - (elapsed - 4.45) / 0.55);
  return 1;
}

export function createMausiSuperState(
  attacker: FighterState,
  defender: FighterState,
): MausiSuperState {
  const dir: 1 | -1 = defender.x >= attacker.x ? 1 : -1;
  attacker.facing = dir;
  defender.facing = (dir === 1 ? -1 : 1) as 1 | -1;

  // Strict global 33% maxHP cap: ~50% multi-laddoo barrage + ~50% Mega Laddoo finisher
  const totalSuperDamage = computeTotalSuperDamage(defender.maxHp);
  const barrageDamageBudget = Math.round(totalSuperDamage * MAUSI_BARRAGE_DAMAGE_SHARE);

  const safeTargetX = Math.max(ARENA_MIN_X + 1.8, Math.min(ARENA_MAX_X - 1.8, defender.x));

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: MAUSI_SUPER_DURATION,
    phase: 'laddoo_gulp',
    auraIgnited: false,
    levitationStarted: false,
    barrageStarted: false,
    barrageHitsLanded: 0,
    barrageDamageDealt: 0,
    megaLaunched: false,
    megaImpacted: false,
    totalSuperDamage,
    barrageDamageBudget,
    superDamageDealt: 0,
    targetX: safeTargetX,
  };
}

function applyMausiSuperDamage(
  attacker: FighterState,
  defender: FighterState,
  superState: MausiSuperState,
  dmg: number,
  allowKo: boolean,
): number {
  const phaseCap = allowKo ? superState.totalSuperDamage : superState.barrageDamageBudget;
  const remainingBudget = Math.max(0, phaseCap - superState.superDamageDealt);
  const hpCap = allowKo ? defender.hp : Math.max(0, defender.hp - 1);
  const capped = Math.max(0, Math.min(dmg, remainingBudget, hpCap));

  defender.hp = Math.max(allowKo ? 0 : 1, defender.hp - capped);
  superState.superDamageDealt += capped;
  attacker.superDamageDealt = superState.superDamageDealt;
  attacker.damageDealt += capped;
  attacker.comboCount += 1;
  attacker.comboTimer = 2.4;
  if (attacker.comboCount > attacker.maxCombo) {
    attacker.maxCombo = attacker.comboCount;
  }
  defender.hitFlashTimer = allowKo ? 0.25 : 0.11;
  defender.squashX = allowKo ? 1.38 : 1.18;
  defender.squashY = allowKo ? 0.64 : 0.84;
  return capped;
}

/**
 * Advances Laddoo Mausi's 5.0-second choreographed "GOL-GOL LADDOO BARRAGE!" Super.
 * Phase 1 (0.0-1.6s): Gulps glowing golden Power Laddoo -> fiery golden-orange aura ignites.
 * Phase 2 (1.6-2.5s): Smoothly levitates to y=2.0 with golden rings & fluttering saree pallu.
 * Phase 3 (2.5-5.0s): Relentless 14-laddoo storm (~50%) + 4.3s Mega Laddoo slam (~50%) + touchdown.
 */
export function stepMausiSuper(
  state: MatchState,
  superState: MausiSuperState,
  dt: number,
  events: CombatEvent[],
): MausiSuperBeatSignal[] {
  const signals: MausiSuperBeatSignal[] = [];
  if (!superState.active) return signals;

  const attacker = state.fighters[superState.attackerSlot];
  const defender = state.fighters[superState.defenderSlot];
  const dir: 1 | -1 = attacker.facing;

  const prevElapsed = superState.elapsed;
  superState.elapsed = Math.min(superState.duration, superState.elapsed + dt);
  const t = superState.elapsed;
  superState.phase = getMausiSuperPhase(t);

  // Lock Laddoo Mausi into gulp -> levitation -> rapid volley -> smooth touchdown
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = superState.duration;
  attacker.invulnTimer = Math.max(attacker.invulnTimer, 0.25);
  attacker.expression = t >= 1.15 && t < 1.6 ? 'victory' : t >= 4.3 ? 'victory' : 'attack';
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.y = getMausiLevitationY(t);

  if (prevElapsed === 0) {
    signals.push({ kind: 'gulp_start', x: attacker.x, y: 1.55 });
  }

  if (state.projectiles.length > 0) {
    state.projectiles.length = 0;
  }

  // PHASE 1 (0.0s - 1.6s): Glowing Power Laddoo Gulp & Aura Ignition
  if (t < 1.6) {
    if (!superState.auraIgnited && t >= 1.18) {
      superState.auraIgnited = true;
      signals.push({ kind: 'aura_ignite', x: attacker.x, y: 1.15 });
    }
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.5;

    // Ensure clear dramatic firing distance (~4.2 units) for the curved & straight laddoo trajectories
    const minRange = 4.2;
    const desiredDefX =
      Math.abs(defender.x - attacker.x) < minRange
        ? Math.max(ARENA_MIN_X + 1.6, Math.min(ARENA_MAX_X - 1.6, attacker.x + dir * minRange))
        : Math.max(ARENA_MIN_X + 1.6, Math.min(ARENA_MAX_X - 1.6, defender.x));
    defender.x += (desiredDefX - defender.x) * Math.min(1, dt * 5.0);
    superState.targetX = defender.x;
    return signals;
  }

  // PHASE 2 (1.6s - 2.5s): Power-Up Levitation
  if (t < 2.5) {
    if (!superState.levitationStarted) {
      superState.levitationStarted = true;
      signals.push({ kind: 'levitate_start', x: attacker.x, y: 0.5 });
    }
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.55;
    superState.targetX = defender.x;
    return signals;
  }

  // PHASE 3 (2.5s - 5.0s): Rapid Multi-Laddoo Storm (~50%) + 4.3s Mega Laddoo Finisher (~50%)
  if (!superState.barrageStarted) {
    superState.barrageStarted = true;
    signals.push({ kind: 'barrage_start', x: attacker.x, y: attacker.y + 1.2 });
  }

  if (!superState.megaLaunched && t >= MAUSI_MEGA_LAUNCH_TIME) {
    superState.megaLaunched = true;
    signals.push({ kind: 'mega_launch', x: attacker.x + dir * 0.6, y: attacker.y + 1.3 });
  }

  if (!superState.megaImpacted) {
    // Keep opponent jittering in hit-stagger as glowing laddoos pepper them!
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -24 * dt;
      defender.y = Math.max(GROUND_Y, defender.y + defender.vy * dt);
      if (defender.y <= GROUND_Y) defender.vy = 0;
    }
    defender.vx = 0;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.6;
    superState.targetX = defender.x;

    while (
      superState.barrageHitsLanded < MAUSI_BARRAGE_HIT_TIMES.length &&
      t >= MAUSI_BARRAGE_HIT_TIMES[superState.barrageHitsLanded]
    ) {
      const idx = superState.barrageHitsLanded;
      superState.barrageHitsLanded += 1;
      const targetBarrageTotal = Math.round(
        (superState.barrageDamageBudget * (idx + 1)) / MAUSI_BARRAGE_HIT_TIMES.length,
      );
      const beatDmg = Math.max(0, targetBarrageTotal - superState.barrageDamageDealt);
      const dealt = applyMausiSuperDamage(attacker, defender, superState, beatDmg, false);
      superState.barrageDamageDealt += dealt;

      defender.vy = 2.4 + (idx % 2) * 0.8;
      defender.y = Math.max(defender.y, 0.06);

      const word = MAUSI_BARRAGE_WORDS[idx % MAUSI_BARRAGE_WORDS.length];
      signals.push({ kind: 'laddoo_hit', x: defender.x, y: 1.15 + (idx % 3) * 0.22, hitIndex: idx });
      events.push({
        type: 'hit',
        attackerSlot: attacker.slot,
        x: defender.x + ((idx % 2 === 0 ? 1 : -1) * 0.25),
        y: 1.35 + (idx % 3) * 0.2,
        damage: dealt,
        word,
        color: idx % 2 === 0 ? '#FACC15' : '#FB923C',
      });
    }

    if (t >= MAUSI_MEGA_IMPACT_TIME) {
      superState.megaImpacted = true;
      const remaining = Math.max(0, superState.totalSuperDamage - superState.superDamageDealt);
      const dealt = applyMausiSuperDamage(attacker, defender, superState, remaining, true);

      state.hitstopTimer = Math.max(state.hitstopTimer, 0.07);
      defender.vx = dir * 9.8;
      defender.vy = 7.4;
      defender.y = 0.14;
      defender.hitstunTimer = 0;
      if (defender.hp <= 0) {
        defender.action = 'ko';
        defender.expression = 'ko';
      } else {
        defender.action = 'knockdown';
        defender.actionTimer = 0;
        defender.actionDuration = 0;
        defender.knockdownTimer = KNOCKDOWN_GROUND_DURATION;
        defender.expression = 'hit';
      }

      signals.push({ kind: 'mega_impact', x: superState.targetX, y: 1.1 });
      events.push({
        type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
        attackerSlot: attacker.slot,
        x: superState.targetX,
        y: 1.55,
        damage: dealt,
        word: 'MEGA LADDOO!',
        color: '#FDE047',
        headline:
          defender.hp <= 0
            ? 'BREAKING: LADDOO MAUSI SERVES A SWEET MEGA-LADDOO K.O.!'
            : 'GOL-GOL LADDOO BARRAGE! OPPONENT BURIED IN GOLDEN BESAN POWER!',
      });
    }
  } else {
    // Advance launched opponent into flat floor knockdown while Mausi gracefully floats down
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -24 * dt;
      defender.y += defender.vy * dt;
      defender.x += defender.vx * dt;
      if (defender.y <= GROUND_Y) {
        defender.y = GROUND_Y;
        defender.vy = 0;
        defender.vx *= 0.32;
      }
    } else {
      defender.vx *= Math.max(0, 1 - dt * 7.5);
      defender.x += defender.vx * dt;
    }
    defender.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, defender.x));
    defender.actionTimer += dt;
  }

  // Sequence complete at 5.0s — Mausi lands smoothly into heavyweight kung-fu stance
  if (t >= superState.duration) {
    superState.active = false;
    attacker.y = GROUND_Y;
    attacker.vy = 0;
    attacker.action = 'idle';
    attacker.actionTimer = 0;
    attacker.actionDuration = 0;
    attacker.expression = 'idle';
    attacker.invulnTimer = 0.2;
    if (defender.hp <= 0) {
      resolveRoundEnd(state, attacker.slot, 'ko');
      defender.action = 'ko';
      defender.expression = 'ko';
    }
    signals.push({ kind: 'super_end', x: attacker.x, y: 1.0 });
  }

  return signals;
}
