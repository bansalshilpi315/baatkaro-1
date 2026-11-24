import type { CombatEvent, FighterState, MatchState } from './types';
import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  GROUND_Y,
  KNOCKDOWN_GROUND_DURATION,
  SUPER_COMBO_DAMAGE_SHARE,
  computeTotalSuperDamage,
  resolveRoundEnd,
} from './combat';

export const BILLA_SUPER_DURATION = 4.5;
export const BILLA_SUPER_BANNER = 'CHIRKUT CHAOS!';

export type BillaSuperPhase =
  | 'eye_glow'       // 0.0s - 1.2s: Arena dims, close-up on Blue Billa, eyes enlarge & glow neon green-yellow
  | 'roach_launch'   // 1.2s - 2.1s: 3 stylized cockroaches burst from Billa's eyes toward opponent
  | 'smoke_beatdown' // 2.1s - 4.1s: Swirling cartoon smoke cloud engulfs opponent with timed multi-hit ticks (~45%)
  | 'pop_finisher';  // 4.1s - 4.5s: Comic pop explosion deals remaining ~55%, flat knockdown, roaches zip away

export interface BillaSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: BillaSuperPhase;
  roachesLaunched: boolean;
  smokeStarted: boolean;
  smokeHitsLanded: number;
  smokeDamageDealt: number;
  finisherPopped: boolean;
  totalSuperDamage: number;
  comboDamageBudget: number;
  superDamageDealt: number;
  targetX: number;
}

export interface BillaSuperBeatSignal {
  kind:
    | 'eye_glow_start'
    | 'roach_launch'
    | 'smoke_start'
    | 'smoke_hit'
    | 'pop_finisher'
    | 'super_end';
  x: number;
  y: number;
  hitIndex?: number;
}

export function getBillaSuperPhase(elapsed: number): BillaSuperPhase {
  if (elapsed < 1.2) return 'eye_glow';
  if (elapsed < 2.1) return 'roach_launch';
  if (elapsed < 4.1) return 'smoke_beatdown';
  return 'pop_finisher';
}

/**
 * Computes lighting dim factor [0..1] across the 4.5s "CHIRKUT CHAOS" sequence:
 * smooth dim in 0.0-0.24s, dramatic dim held through 4.12s pop explosion,
 * smooth restore back to 0 during 4.12-4.5s.
 */
export function getBillaSuperDimFactor(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= BILLA_SUPER_DURATION) return 0;
  if (elapsed < 0.24) return elapsed / 0.24;
  if (elapsed > 4.12) return Math.max(0, 1 - (elapsed - 4.12) / 0.38);
  return 1;
}

export function createBillaSuperState(
  attacker: FighterState,
  defender: FighterState,
): BillaSuperState {
  const dir: 1 | -1 = defender.x >= attacker.x ? 1 : -1;
  attacker.facing = dir;
  defender.facing = (dir === 1 ? -1 : 1) as 1 | -1;

  // Strict global 33% maxHP cap (~45% timed smoke-cloud ticks, ~55% pop finisher)
  const totalSuperDamage = computeTotalSuperDamage(defender.maxHp);
  const comboDamageBudget = Math.round(totalSuperDamage * SUPER_COMBO_DAMAGE_SHARE);

  const safeTargetX = Math.max(ARENA_MIN_X + 1.4, Math.min(ARENA_MAX_X - 1.4, defender.x));

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: BILLA_SUPER_DURATION,
    phase: 'eye_glow',
    roachesLaunched: false,
    smokeStarted: false,
    smokeHitsLanded: 0,
    smokeDamageDealt: 0,
    finisherPopped: false,
    totalSuperDamage,
    comboDamageBudget,
    superDamageDealt: 0,
    targetX: safeTargetX,
  };
}

function applyBillaSuperDamage(
  attacker: FighterState,
  defender: FighterState,
  superState: BillaSuperState,
  dmg: number,
  allowKo: boolean,
): number {
  const phaseCap = allowKo ? superState.totalSuperDamage : superState.comboDamageBudget;
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
  defender.hitFlashTimer = allowKo ? 0.22 : 0.11;
  defender.squashX = allowKo ? 1.3 : 1.18;
  defender.squashY = allowKo ? 0.72 : 0.84;
  return capped;
}

const SMOKE_HIT_COUNT = 6;
const SMOKE_HIT_START_T = 2.28;
const SMOKE_HIT_STEP_T = 0.3; // 6 timed hits at 2.28, 2.58, 2.88, 3.18, 3.48, 3.78s
const SMOKE_COMIC_WORDS = ['POW!', 'WHAM!', 'CHIRKUT!', 'POW!', 'WHAM!', 'CHIRKUT!'];
const SMOKE_COMIC_COLORS = ['#FDE047', '#FB923C', '#4ADE80', '#FDE047', '#F472B6', '#38BDF8'];

/**
 * Advances Blue Billa's 4.5-second choreographed "CHIRKUT CHAOS!" Super.
 * Locks both fighters cleanly, enforces exact 33% maxHP cumulative damage,
 * and launches opponent into a flat knockdown on the 4.1s comic pop explosion.
 */
export function stepBillaSuper(
  state: MatchState,
  superState: BillaSuperState,
  dt: number,
  events: CombatEvent[],
): BillaSuperBeatSignal[] {
  const signals: BillaSuperBeatSignal[] = [];
  if (!superState.active) return signals;

  const attacker = state.fighters[superState.attackerSlot];
  const defender = state.fighters[superState.defenderSlot];
  const dir: 1 | -1 = attacker.facing;

  const prevElapsed = superState.elapsed;
  superState.elapsed = Math.min(superState.duration, superState.elapsed + dt);
  const t = superState.elapsed;
  superState.phase = getBillaSuperPhase(t);

  // Lock attacker cleanly in Super state
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = superState.duration;
  attacker.invulnTimer = Math.max(attacker.invulnTimer, 0.25);
  attacker.expression = t < 1.2 ? 'attack' : t >= 4.1 ? 'victory' : 'attack';
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.y = GROUND_Y;

  if (prevElapsed === 0) {
    signals.push({ kind: 'eye_glow_start', x: attacker.x, y: 1.78 });
  }

  // Clear stray projectiles so nothing disrupts the cutscene
  if (state.projectiles.length > 0) {
    state.projectiles.length = 0;
  }

  // Ensure enough visual spacing between Billa and opponent so roach flight reads dramatically
  if (t < 1.2) {
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.45;
    const minSep = 3.2;
    const desiredDefX =
      Math.abs(defender.x - attacker.x) < minSep
        ? Math.max(ARENA_MIN_X + 1.4, Math.min(ARENA_MAX_X - 1.4, attacker.x + dir * minSep))
        : Math.max(ARENA_MIN_X + 1.4, Math.min(ARENA_MAX_X - 1.4, defender.x));
    defender.x += (desiredDefX - defender.x) * Math.min(1, dt * 6);
    superState.targetX = defender.x;
    return signals;
  }

  // PHASE 2 (1.2s - 2.1s): 3 Cockroaches Burst Out of Blue Billa's Glowing Eyes
  if (t < 2.1) {
    if (!superState.roachesLaunched) {
      superState.roachesLaunched = true;
      signals.push({ kind: 'roach_launch', x: attacker.x, y: 1.78 });
    }
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.5;
    superState.targetX = defender.x;
    return signals;
  }

  // PHASE 3 (2.1s - 4.1s): Swirling Cartoon Smoke-Cloud Beatdown
  if (t < 4.1) {
    if (!superState.smokeStarted) {
      superState.smokeStarted = true;
      signals.push({ kind: 'smoke_start', x: defender.x, y: 1.15 });
    }

    // Slight comedic jostling inside the churning smoke cloud
    defender.vx = 0;
    defender.y = GROUND_Y + Math.abs(Math.sin(t * 24)) * 0.16;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.6;
    superState.targetX = defender.x;

    while (
      superState.smokeHitsLanded < SMOKE_HIT_COUNT &&
      t >= SMOKE_HIT_START_T + superState.smokeHitsLanded * SMOKE_HIT_STEP_T
    ) {
      const idx = superState.smokeHitsLanded;
      superState.smokeHitsLanded += 1;
      const targetComboTotal = Math.round(
        (superState.comboDamageBudget * (idx + 1)) / SMOKE_HIT_COUNT,
      );
      const beatDmg = Math.max(0, targetComboTotal - superState.smokeDamageDealt);
      const dealt = applyBillaSuperDamage(attacker, defender, superState, beatDmg, false);
      superState.smokeDamageDealt += dealt;

      const offsetX = idx % 2 === 0 ? -0.45 : 0.45;
      const offsetY = 1.05 + (idx % 3) * 0.28;
      signals.push({
        kind: 'smoke_hit',
        x: defender.x + offsetX,
        y: offsetY,
        hitIndex: idx,
      });
      events.push({
        type: idx % 2 === 1 ? 'heavy_hit' : 'hit',
        attackerSlot: attacker.slot,
        x: defender.x + offsetX,
        y: offsetY + 0.25,
        damage: dealt,
        word: SMOKE_COMIC_WORDS[idx % SMOKE_COMIC_WORDS.length],
        color: SMOKE_COMIC_COLORS[idx % SMOKE_COMIC_COLORS.length],
      });
    }
    return signals;
  }

  // PHASE 4 (4.1s - 4.5s): Comic Pop Explosion Finisher & Flat Knockdown
  if (!superState.finisherPopped) {
    superState.finisherPopped = true;
    const remaining = Math.max(0, superState.totalSuperDamage - superState.superDamageDealt);
    const dealt = applyBillaSuperDamage(attacker, defender, superState, remaining, true);

    defender.vx = dir * 8.8;
    defender.vy = 6.2;
    defender.y = 0.12;
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

    signals.push({ kind: 'pop_finisher', x: defender.x, y: 1.25 });
    events.push({
      type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
      attackerSlot: attacker.slot,
      x: defender.x,
      y: 1.55,
      damage: dealt,
      word: 'CHIRKUT POP!',
      color: '#4ADE80',
      headline:
        defender.hp <= 0
          ? 'BREAKING: BLUE BILLA ENDS MATCH WITH CHIRKUT CHAOS K.O.!'
          : 'CHIRKUT CHAOS! COCKROACH SMOKE CLOUD SENDS OPPONENT FLYING!',
    });
  } else {
    // Advance launched opponent knockdown arc cleanly during 4.1s - 4.5s
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -24 * dt;
      defender.y += defender.vy * dt;
      defender.x += defender.vx * dt;
      if (defender.y <= GROUND_Y) {
        defender.y = GROUND_Y;
        defender.vy = 0;
        defender.vx *= 0.35;
      }
    } else {
      defender.vx *= Math.max(0, 1 - dt * 8);
      defender.x += defender.vx * dt;
    }
    defender.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, defender.x));
    defender.actionTimer += dt;
  }

  // Sequence complete at 4.5s
  if (t >= superState.duration) {
    superState.active = false;
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
