import type { CombatEvent, FighterState, MatchState } from './types';
import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  GROUND_Y,
  SUPER_COMBO_DAMAGE_SHARE,
  computeTotalSuperDamage,
} from './combat';

export const SHERU_SUPER_DURATION = 7.5;
export const SHERU_SUPER_BANNER = 'TRILLION DOLLAR BEATDOWN!';

export type SheruSuperPhase =
  | 'beat_drop'      // 0.0s - 1.0s: Dim arena, golden spotlight, shades tilt, aura freeze
  | 'paw_flurry'     // 1.0s - 3.0s: Rapid dash + alternating golden paw flurry
  | 'standing_hit'   // 3.0s - 4.05s: Tall billionaire backhand slap / uppercut pop
  | 'lying_combo'    // 4.05s - 5.5s: Hilarious reclined floor kick + ground-slap combo
  | 'finisher';      // 5.5s - 7.5s: Pop up, raise paw, finger snap -> $ TRILLION $ explosion

export interface SheruSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: SheruSuperPhase;
  flurryHitsLanded: number;
  flurryDamageDealt: number;
  standingHitLanded: boolean;
  lyingKickLanded: boolean;
  lyingSlapLanded: boolean;
  snapTriggered: boolean;
  totalSuperDamage: number;
  comboDamageBudget: number;
  superDamageDealt: number;
  startAttackerX: number;
  dashTargetX: number;
}

export interface SheruSuperBeatSignal {
  kind:
    | 'spotlight_start'
    | 'flurry_hit'
    | 'standing_hit'
    | 'lying_kick'
    | 'lying_slap'
    | 'finisher_snap'
    | 'super_end';
  x: number;
  y: number;
  hitIndex?: number;
}

export function getSheruSuperPhase(elapsed: number): SheruSuperPhase {
  if (elapsed < 1.0) return 'beat_drop';
  if (elapsed < 3.0) return 'paw_flurry';
  if (elapsed < 4.05) return 'standing_hit';
  if (elapsed < 5.5) return 'lying_combo';
  return 'finisher';
}

/**
 * Computes lighting dim factor [0..1] across the 7.5s Super sequence:
 * smooth dim in during 0.0-0.25s, dramatic dim held through finisher snap,
 * smooth restore back to 0 during 6.6-7.5s.
 */
export function getSheruSuperDimFactor(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= SHERU_SUPER_DURATION) return 0;
  if (elapsed < 0.25) return elapsed / 0.25;
  if (elapsed > 6.6) return Math.max(0, 1 - (elapsed - 6.6) / 0.9);
  return 1;
}

export function createSheruSuperState(
  attacker: FighterState,
  defender: FighterState,
): SheruSuperState {
  const dir: 1 | -1 = defender.x >= attacker.x ? 1 : -1;
  attacker.facing = dir;
  defender.facing = (dir === 1 ? -1 : 1) as 1 | -1;

  // Global Super Power cap: exactly 33% of opponent maxHp (~45% flurry/combo, ~55% finisher)
  const totalSuperDamage = computeTotalSuperDamage(defender.maxHp);
  const comboDamageBudget = Math.round(totalSuperDamage * SUPER_COMBO_DAMAGE_SHARE);

  // Compute safe melee target position next to opponent inside arena bounds
  const idealX = defender.x - dir * 1.18;
  const dashTargetX = Math.max(ARENA_MIN_X + 0.4, Math.min(ARENA_MAX_X - 0.4, idealX));

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: SHERU_SUPER_DURATION,
    phase: 'beat_drop',
    flurryHitsLanded: 0,
    flurryDamageDealt: 0,
    standingHitLanded: false,
    lyingKickLanded: false,
    lyingSlapLanded: false,
    snapTriggered: false,
    totalSuperDamage,
    comboDamageBudget,
    superDamageDealt: 0,
    startAttackerX: attacker.x,
    dashTargetX,
  };
}

function applySuperBeatDamage(
  attacker: FighterState,
  defender: FighterState,
  superState: SheruSuperState,
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
  defender.hitFlashTimer = allowKo ? 0.22 : 0.1;
  defender.squashX = allowKo ? 1.32 : 1.16;
  defender.squashY = allowKo ? 0.72 : 0.86;
  return capped;
}

const FLURRY_HIT_COUNT = 10;
const FLURRY_START_T = 1.24;
const FLURRY_STEP_T = 0.17; // 10 hits from 1.24s to 2.77s

/**
 * Advances Sheru Bhai's 7.5-second choreographed "Trillion Dollar Beatdown" Super.
 * Locks both fighters cleanly into the sequence, auto-dashes into melee contact,
 * delivers multi-hit beats, and finishes with the heavy $ TRILLION $ explosion.
 */
export function stepSheruSuper(
  state: MatchState,
  superState: SheruSuperState,
  dt: number,
  events: CombatEvent[],
): SheruSuperBeatSignal[] {
  const signals: SheruSuperBeatSignal[] = [];
  if (!superState.active) return signals;

  const attacker = state.fighters[superState.attackerSlot];
  const defender = state.fighters[superState.defenderSlot];
  const dir: 1 | -1 = attacker.facing;

  const prevElapsed = superState.elapsed;
  superState.elapsed = Math.min(superState.duration, superState.elapsed + dt);
  const t = superState.elapsed;
  superState.phase = getSheruSuperPhase(t);

  // Keep attacker & defender locked in Super choreography
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = superState.duration;
  attacker.invulnTimer = Math.max(attacker.invulnTimer, 0.25);
  attacker.expression = t < 1.0 || t >= 6.15 ? 'victory' : 'attack';
  attacker.y = GROUND_Y;
  attacker.vy = 0;

  if (prevElapsed === 0) {
    signals.push({ kind: 'spotlight_start', x: attacker.x, y: 1.5 });
  }

  // Clear active projectiles so nothing interrupts the cinematic sequence
  if (state.projectiles.length > 0) {
    state.projectiles.length = 0;
  }

  // PHASE 1 (0.0s - 1.0s): Beat Drop & Spotlight Freeze
  if (t < 1.0) {
    attacker.vx = 0;
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.4;
    // Ensure opponent faces Sheru and stays within arena with room for melee dash
    const safeDefX = Math.max(ARENA_MIN_X + 1.5, Math.min(ARENA_MAX_X - 1.5, defender.x));
    defender.x += (safeDefX - defender.x) * Math.min(1, dt * 8);
    superState.dashTargetX = Math.max(
      ARENA_MIN_X + 0.4,
      Math.min(ARENA_MAX_X - 0.4, defender.x - dir * 1.18),
    );
    return signals;
  }

  // PHASE 2 (1.0s - 3.0s): Rapid Auto-Dash + Golden Paw Flurry
  if (t < 3.0) {
    const dashProgress = Math.min(1, (t - 1.0) / 0.22);
    const eased = 1 - (1 - dashProgress) * (1 - dashProgress);
    attacker.x =
      superState.startAttackerX + (superState.dashTargetX - superState.startAttackerX) * eased;
    attacker.vx = 0;

    defender.vx = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.5;

    // 10 fixed-interval alternating paw strikes sharing 60% of the ~45% combo budget
    const flurryBudget = Math.round(superState.comboDamageBudget * 0.6);
    while (
      superState.flurryHitsLanded < FLURRY_HIT_COUNT &&
      t >= FLURRY_START_T + superState.flurryHitsLanded * FLURRY_STEP_T
    ) {
      const hitIdx = superState.flurryHitsLanded;
      superState.flurryHitsLanded += 1;
      const targetFlurryTotal = Math.round((flurryBudget * (hitIdx + 1)) / FLURRY_HIT_COUNT);
      const beatDmg = Math.max(0, targetFlurryTotal - superState.flurryDamageDealt);
      const dealt = applySuperBeatDamage(attacker, defender, superState, beatDmg, false);
      superState.flurryDamageDealt += dealt;
      const hitX = (attacker.x + defender.x) * 0.5 + (hitIdx % 2 === 0 ? 0.12 : -0.12);
      const hitY = 1.05 + (hitIdx % 3) * 0.18;
      signals.push({ kind: 'flurry_hit', x: hitX, y: hitY, hitIndex: hitIdx });
      events.push({
        type: 'hit',
        attackerSlot: attacker.slot,
        x: hitX,
        y: hitY,
        damage: dealt,
        word: hitIdx % 3 === 0 ? 'TADBAN!' : hitIdx % 3 === 1 ? 'DHISHUM!' : 'PAISA!',
        color: '#FDE047',
      });
    }
    return signals;
  }

  // PHASE 3 (3.0s - 5.5s): Standing-to-Lying Comedy Combo
  if (t < 5.5) {
    // Keep Sheru cleanly positioned right in front of opponent
    attacker.x = superState.dashTargetX;
    attacker.vx = 0;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.6;

    // Remaining 40% of the ~45% combo budget distributed across standing hit + lying kick + ground slap
    const flurryBudget = Math.round(superState.comboDamageBudget * 0.6);
    const phase3Budget = Math.max(0, superState.comboDamageBudget - flurryBudget);

    // 3a. Standing billionaire backhand slap / uppercut at t = 3.45s
    if (!superState.standingHitLanded && t >= 3.45) {
      superState.standingHitLanded = true;
      const dmg = Math.round(phase3Budget * 0.4);
      const dealt = applySuperBeatDamage(attacker, defender, superState, dmg, false);
      defender.vy = 5.4;
      defender.y = 0.08;
      signals.push({ kind: 'standing_hit', x: defender.x, y: 1.45 });
      events.push({
        type: 'heavy_hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.45,
        damage: dealt,
        word: 'KHADE HOKE!',
        color: '#FACC15',
      });
    }

    // Gentle gravity arc for opponent pop-up during Phase 3a/3b
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -18 * dt;
      defender.y += defender.vy * dt;
      if (defender.y <= GROUND_Y) {
        defender.y = GROUND_Y;
        defender.vy = 0;
      }
    }

    // 3b. Lying-down sliding kick (t = 4.45s) + ground-slap (t = 4.98s)
    if (!superState.lyingKickLanded && t >= 4.45) {
      superState.lyingKickLanded = true;
      const dmg = Math.round(phase3Budget * 0.3);
      const dealt = applySuperBeatDamage(attacker, defender, superState, dmg, false);
      defender.vy = 3.2;
      defender.y = Math.max(defender.y, 0.05);
      signals.push({ kind: 'lying_kick', x: defender.x, y: 0.72 });
      events.push({
        type: 'hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 0.78,
        damage: dealt,
        word: 'LET KE MAARA!',
        color: '#FDE047',
      });
    }

    if (!superState.lyingSlapLanded && t >= 4.98) {
      superState.lyingSlapLanded = true;
      const dmg = Math.max(0, superState.comboDamageBudget - superState.superDamageDealt);
      const dealt = applySuperBeatDamage(attacker, defender, superState, dmg, false);
      defender.vy = 2.6;
      signals.push({ kind: 'lying_slap', x: defender.x, y: 1.05 });
      events.push({
        type: 'heavy_hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.05,
        damage: dealt,
        word: 'JHAKAAS!',
        color: '#FB923C',
      });
    }
    return signals;
  }

  // PHASE 4 (5.5s - 7.5s): Billionaire Finisher ("Trillion Trillion Dollar")
  attacker.x = superState.dashTargetX;
  attacker.vx = 0;

  if (!superState.snapTriggered) {
    // 5.5s - 6.15s: Opponent settles staggered on floor as Sheru pops up & raises ringed paw
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -24 * dt;
      defender.y = Math.max(GROUND_Y, defender.y + defender.vy * dt);
      if (defender.y <= GROUND_Y) defender.vy = 0;
    }
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.6;

    if (t >= 6.15) {
      superState.snapTriggered = true;
      // Deliver remaining ~55% of totalSuperDamage so cumulative Super damage is locked at exact 33% maxHp
      const remaining = Math.max(0, superState.totalSuperDamage - superState.superDamageDealt);
      const dealt = applySuperBeatDamage(attacker, defender, superState, remaining, true);

      // Dramatic knockback launching opponent flying across the arena!
      defender.vx = dir * 13.2;
      defender.vy = 7.4;
      defender.y = 0.1;
      defender.hitstunTimer = 1.25;
      defender.action = defender.hp <= 0 ? 'ko' : 'hit';
      defender.expression = defender.hp <= 0 ? 'ko' : 'hit';

      signals.push({ kind: 'finisher_snap', x: defender.x, y: 1.35 });
      events.push({
        type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.6,
        damage: dealt,
        word: '$ TRILLION $',
        color: '#FDE047',
        headline:
          defender.hp <= 0
            ? 'BREAKING: SHERU BHAI ENDS MATCH WITH TRILLION DOLLAR BEATDOWN K.O.!'
            : 'TRILLION DOLLAR BEATDOWN! BILLIONAIRE SNAP SENDS OPPONENT FLYING!',
      });
    }
  } else {
    // 6.15s - 7.5s: Opponent flies dramatically across the arena & lands while Sheru holds swagger pose
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
      defender.vx *= Math.max(0, 1 - dt * 6);
      defender.x += defender.vx * dt;
    }
    defender.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, defender.x));
  }

  // Sequence complete at 7.5s
  if (t >= superState.duration) {
    superState.active = false;
    attacker.action = 'idle';
    attacker.actionTimer = 0;
    attacker.actionDuration = 0;
    attacker.expression = 'idle';
    attacker.invulnTimer = 0.2;
    if (defender.hp > 0) {
      defender.hitstunTimer = Math.min(defender.hitstunTimer, 0.2);
    } else {
      state.phase = 'ko_freeze';
      state.phaseTimer = 1.35;
      state.winnerSlot = attacker.slot;
      state.finishReason = 'ko';
      defender.action = 'ko';
      defender.expression = 'ko';
    }
    signals.push({ kind: 'super_end', x: attacker.x, y: 1.0 });
  }

  return signals;
}
