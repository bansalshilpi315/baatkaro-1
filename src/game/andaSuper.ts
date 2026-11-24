import type { CombatEvent, FighterState, MatchState } from './types';
import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  GROUND_Y,
  KNOCKDOWN_GROUND_DURATION,
  computeTotalSuperDamage,
  resolveRoundEnd,
} from './combat';

export const ANDA_SUPER_DURATION = 4.5;
export const ANDA_SUPER_BANNER = 'THE GREAT WALL DROP!';
export const ANDA_WALL_START_Y = 14.0;
export const ANDA_WALL_DROP_START = 2.5;
export const ANDA_WALL_IMPACT_TIME = 2.74;
export const ANDA_WALL_SHATTER_TIME = 3.54; // ~0.8s comedic flattened beat before wall shatters!

// 3 dramatic sky lightning strikes in Phase 2 (1.4s - 2.5s) dealing ~25% of totalSuperDamage
export const ANDA_LIGHTNING_HIT_TIMES = [1.56, 1.94, 2.3] as const;
export const ANDA_LIGHTNING_DAMAGE_SHARE = 0.25;

export type AndaSuperPhase =
  | 'hat_bow'          // 0.0s - 1.4s: Stormy dark-blue dim, Anda lifts off blue top hat & bows politely ~35°
  | 'lightning_strike' // 1.4s - 2.5s: 2-3 jagged glowing cyan-white lightning bolts strike opponent (~25% dmg)
  | 'wall_drop';       // 2.5s - 4.5s: Massive 3D red-brick wall crashes from y=14 (~75% dmg), holds ~0.8s, shatters

export interface AndaSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: AndaSuperPhase;
  lightningHitsLanded: number;
  lightningDamageDealt: number;
  wallDropStarted: boolean;
  wallImpacted: boolean;
  wallShattered: boolean;
  totalSuperDamage: number;
  lightningDamageBudget: number;
  superDamageDealt: number;
  targetX: number;
}

export interface AndaSuperBeatSignal {
  kind:
    | 'hat_bow_start'
    | 'lightning_strike'
    | 'wall_drop_start'
    | 'wall_impact'
    | 'wall_shatter'
    | 'super_end';
  x: number;
  y: number;
  boltIndex?: number;
}

export function getAndaSuperPhase(elapsed: number): AndaSuperPhase {
  if (elapsed < 1.4) return 'hat_bow';
  if (elapsed < 2.5) return 'lightning_strike';
  return 'wall_drop';
}

/**
 * Computes stormy dark-blue dim factor [0..1] across the 4.5s "THE GREAT WALL DROP!" sequence.
 */
export function getAndaSuperDimFactor(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= ANDA_SUPER_DURATION) return 0;
  if (elapsed < 0.24) return elapsed / 0.24;
  if (elapsed > 3.92) return Math.max(0, 1 - (elapsed - 3.92) / 0.58);
  return 1;
}

/**
 * Computes intense white-blue lightning flash pulse [0..1] right on each Phase 2 bolt strike.
 */
export function getAndaSkyFlash(elapsed: number): number {
  let flash = 0;
  for (const strikeTime of ANDA_LIGHTNING_HIT_TIMES) {
    const dt = elapsed - strikeTime;
    if (dt >= -0.02 && dt < 0.26) {
      const normalized = Math.max(0, dt) / 0.26;
      const pulse = Math.pow(1 - normalized, 2.2);
      if (pulse > flash) flash = pulse;
    }
  }
  return flash;
}

/**
 * Computes the massive 3D brick wall's bottom Y position during Phase 3:
 * - Drops rapidly with gravity acceleration from y=14.0 (t=2.50s) to y=0.0 (t=2.74s)
 * - Sits solidly on the flattened opponent with a tiny elastic squash settle during 2.74s..3.54s
 */
export function getAndaWallDropY(elapsed: number): number {
  if (elapsed < ANDA_WALL_DROP_START) return ANDA_WALL_START_Y;
  if (elapsed >= ANDA_WALL_IMPACT_TIME) return GROUND_Y;
  const p = (elapsed - ANDA_WALL_DROP_START) / (ANDA_WALL_IMPACT_TIME - ANDA_WALL_DROP_START);
  // Crisp heavy gravity drop curve (accelerating slam)
  return ANDA_WALL_START_Y * (1 - p * p * p);
}

export function createAndaSuperState(
  attacker: FighterState,
  defender: FighterState,
): AndaSuperState {
  const dir: 1 | -1 = defender.x >= attacker.x ? 1 : -1;
  attacker.facing = dir;
  defender.facing = (dir === 1 ? -1 : 1) as 1 | -1;

  // Strict global 33% maxHP cap: ~25% lightning strikes + remaining ~75% giant brick wall crash
  const totalSuperDamage = computeTotalSuperDamage(defender.maxHp);
  const lightningDamageBudget = Math.round(totalSuperDamage * ANDA_LIGHTNING_DAMAGE_SHARE);

  const safeTargetX = Math.max(ARENA_MIN_X + 1.9, Math.min(ARENA_MAX_X - 1.9, defender.x));

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: ANDA_SUPER_DURATION,
    phase: 'hat_bow',
    lightningHitsLanded: 0,
    lightningDamageDealt: 0,
    wallDropStarted: false,
    wallImpacted: false,
    wallShattered: false,
    totalSuperDamage,
    lightningDamageBudget,
    superDamageDealt: 0,
    targetX: safeTargetX,
  };
}

function applyAndaSuperDamage(
  attacker: FighterState,
  defender: FighterState,
  superState: AndaSuperState,
  dmg: number,
  allowKo: boolean,
): number {
  const phaseCap = allowKo ? superState.totalSuperDamage : superState.lightningDamageBudget;
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
  defender.hitFlashTimer = allowKo ? 0.26 : 0.14;
  defender.squashX = allowKo ? 1.46 : 1.18;
  defender.squashY = allowKo ? 0.42 : 0.86;
  return capped;
}

/**
 * Advances Anda Bhai's 4.5-second choreographed "THE GREAT WALL DROP!" Super.
 * Phase 1 (0.0-1.4s): Gentleman top hat lift & polite bow.
 * Phase 2 (1.4-2.5s): 3 cyan-white lightning strikes (~25% of 33% maxHP) locking opponent in place.
 * Phase 3 (2.5-4.5s): Massive red-brick wall drops from y=14 (~75% of 33% maxHP), holds ~0.8s, shatters.
 */
export function stepAndaSuper(
  state: MatchState,
  superState: AndaSuperState,
  dt: number,
  events: CombatEvent[],
): AndaSuperBeatSignal[] {
  const signals: AndaSuperBeatSignal[] = [];
  if (!superState.active) return signals;

  const attacker = state.fighters[superState.attackerSlot];
  const defender = state.fighters[superState.defenderSlot];
  const dir: 1 | -1 = attacker.facing;

  const prevElapsed = superState.elapsed;
  superState.elapsed = Math.min(superState.duration, superState.elapsed + dt);
  const t = superState.elapsed;
  superState.phase = getAndaSuperPhase(t);

  // Lock Anda Bhai cleanly on ground through hat-off bow -> wall drop -> hat replacement
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = superState.duration;
  attacker.invulnTimer = Math.max(attacker.invulnTimer, 0.25);
  attacker.expression = t < 1.4 || t >= 2.74 ? 'victory' : 'attack';
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.y = GROUND_Y;

  if (prevElapsed === 0) {
    signals.push({ kind: 'hat_bow_start', x: attacker.x, y: 1.55 });
  }

  if (state.projectiles.length > 0) {
    state.projectiles.length = 0;
  }

  // PHASE 1 (0.0s - 1.4s): Gentleman Hat-Off & Polite Bow
  if (t < 1.4) {
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.5;

    // Ensure comfortable dramatic framing distance (~3.6 units) so giant brick wall doesn't clip Anda Bhai
    const minSep = 3.6;
    const desiredDefX =
      Math.abs(defender.x - attacker.x) < minSep
        ? Math.max(ARENA_MIN_X + 1.8, Math.min(ARENA_MAX_X - 1.8, attacker.x + dir * minSep))
        : Math.max(ARENA_MIN_X + 1.8, Math.min(ARENA_MAX_X - 1.8, defender.x));
    defender.x += (desiredDefX - defender.x) * Math.min(1, dt * 5.5);
    superState.targetX = defender.x;
    return signals;
  }

  // PHASE 2 (1.4s - 2.5s): Sky Lightning Strikes (~25% of totalSuperDamage)
  if (t < 2.5) {
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.7;
    superState.targetX = defender.x;

    while (
      superState.lightningHitsLanded < ANDA_LIGHTNING_HIT_TIMES.length &&
      t >= ANDA_LIGHTNING_HIT_TIMES[superState.lightningHitsLanded]
    ) {
      const idx = superState.lightningHitsLanded;
      superState.lightningHitsLanded += 1;
      const targetLightningTotal = Math.round(
        (superState.lightningDamageBudget * (idx + 1)) / ANDA_LIGHTNING_HIT_TIMES.length,
      );
      const beatDmg = Math.max(0, targetLightningTotal - superState.lightningDamageDealt);
      const dealt = applyAndaSuperDamage(attacker, defender, superState, beatDmg, false);
      superState.lightningDamageDealt += dealt;

      signals.push({ kind: 'lightning_strike', x: defender.x, y: 1.4, boltIndex: idx });
      events.push({
        type: 'hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.7 + (idx % 2) * 0.25,
        damage: dealt,
        word: idx === 1 ? 'ZAP!' : 'BIJLI!',
        color: '#38BDF8',
      });
    }
    return signals;
  }

  // PHASE 3 (2.5s - 4.5s): Giant Red-Brick Wall Crash -> 0.8s Flattened Hold -> Debris Shatter
  if (!superState.wallDropStarted) {
    superState.wallDropStarted = true;
    signals.push({ kind: 'wall_drop_start', x: superState.targetX, y: ANDA_WALL_START_Y });
  }

  if (!superState.wallImpacted) {
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.6;
    superState.targetX = defender.x;

    if (t >= ANDA_WALL_IMPACT_TIME) {
      superState.wallImpacted = true;
      const remaining = Math.max(0, superState.totalSuperDamage - superState.superDamageDealt);
      const dealt = applyAndaSuperDamage(attacker, defender, superState, remaining, true);

      // Heavy hit-stop + comedic flat pancake crush beneath the giant red-brick wall!
      state.hitstopTimer = Math.max(state.hitstopTimer, 0.085);
      defender.vx = 0;
      defender.vy = 0;
      defender.y = GROUND_Y;
      defender.hitstunTimer = 0;
      defender.squashedTimer = 0.84;
      defender.squashX = 1.52;
      defender.squashY = 0.34;
      if (defender.hp <= 0) {
        defender.action = 'ko';
        defender.expression = 'ko';
      } else {
        defender.action = 'knockdown';
        defender.actionTimer = 0;
        defender.actionDuration = 0;
        defender.knockdownTimer = KNOCKDOWN_GROUND_DURATION + 0.35;
        defender.expression = 'hit';
      }

      signals.push({ kind: 'wall_impact', x: superState.targetX, y: 0.45 });
      events.push({
        type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
        attackerSlot: attacker.slot,
        x: superState.targetX,
        y: 1.45,
        damage: dealt,
        word: 'CRUSH!',
        color: '#EF4444',
        headline:
          defender.hp <= 0
            ? 'BREAKING: ANDA BHAI DROPS THE GREAT WALL FOR AN INSTANT K.O.!'
            : 'THE GREAT WALL DROP! OPPONENT FLATTENED UNDER A TON OF BRICKS!',
      });
    }
  } else if (!superState.wallShattered) {
    // Keep opponent dramatically flattened under the wall during the ~0.8s comedic beat
    defender.squashedTimer = Math.max(defender.squashedTimer, 0.12);
    defender.squashX = 1.5;
    defender.squashY = 0.36;
    defender.vx = 0;
    defender.y = GROUND_Y;

    if (t >= ANDA_WALL_SHATTER_TIME) {
      superState.wallShattered = true;
      defender.squashedTimer = 0;
      defender.vx = dir * 1.4;
      defender.vy = 1.8;
      defender.y = 0.06;
      signals.push({ kind: 'wall_shatter', x: superState.targetX, y: 1.1 });
    }
  } else {
    // Post-shatter: opponent settles flat on back into full knockdown while Anda replaces top hat
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -24 * dt;
      defender.y += defender.vy * dt;
      defender.x += defender.vx * dt;
      if (defender.y <= GROUND_Y) {
        defender.y = GROUND_Y;
        defender.vy = 0;
        defender.vx *= 0.2;
      }
    } else {
      defender.vx *= Math.max(0, 1 - dt * 10);
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
    defender.squashedTimer = 0;
    if (defender.hp <= 0) {
      resolveRoundEnd(state, attacker.slot, 'ko');
      defender.action = 'ko';
      defender.expression = 'ko';
    }
    signals.push({ kind: 'super_end', x: attacker.x, y: 1.0 });
  }

  return signals;
}
