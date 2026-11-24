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

export const NETA_SUPER_DURATION = 4.8;
export const NETA_SUPER_BANNER = 'VANS, ATTACK!';
export const NETA_LEVITATION_PEAK_Y = 2.2;
export const NETA_VAN_COUNT = 5;

export type NetaSuperPhase =
  | 'levitate_command' // 0.0s - 1.5s: Neta levitates smoothly to y=2.2 with golden-saffron aura & points forward
  | 'van_stampede'     // 1.5s - 4.0s: Fleet of 5 desi white mini-vans race across ground floor (~45% combo ticks)
  | 'van_finisher';    // 4.0s - 4.8s: Lead Van delivers heavy finisher (~55%), spinning launch + Neta touchdown

export interface NetaSuperState {
  active: boolean;
  attackerSlot: 0 | 1;
  defenderSlot: 0 | 1;
  elapsed: number;
  duration: number;
  phase: NetaSuperPhase;
  commandPointed: boolean;
  stampedeStarted: boolean;
  vanHitsLanded: number;
  vanDamageDealt: number;
  finisherHitLanded: boolean;
  totalSuperDamage: number;
  comboDamageBudget: number;
  superDamageDealt: number;
  targetX: number;
}

export interface NetaSuperBeatSignal {
  kind:
    | 'levitate_start'
    | 'command_point'
    | 'stampede_start'
    | 'van_hit'
    | 'van_finisher'
    | 'super_end';
  x: number;
  y: number;
  vanIndex?: number;
}

export function getNetaSuperPhase(elapsed: number): NetaSuperPhase {
  if (elapsed < 1.5) return 'levitate_command';
  if (elapsed < 4.0) return 'van_stampede';
  return 'van_finisher';
}

/**
 * Smooth levitation altitude curve for Garib Sena Neta:
 * - 0.00s..1.05s: Smooth cubic ease-out rise from GROUND_Y (0) to ~2.2 units
 * - 1.05s..4.05s: Gentle mystical hover bob around 2.2 units
 * - 4.05s..4.78s: Smooth touchdown descent back to GROUND_Y (0)
 */
export function getNetaLevitationY(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= NETA_SUPER_DURATION) return GROUND_Y;
  if (elapsed < 1.05) {
    const p = elapsed / 1.05;
    const eased = 1 - Math.pow(1 - p, 3);
    return eased * NETA_LEVITATION_PEAK_Y;
  }
  if (elapsed < 4.05) {
    return NETA_LEVITATION_PEAK_Y + Math.sin((elapsed - 1.05) * 4.2) * 0.08;
  }
  const downT = Math.min(1, (elapsed - 4.05) / 0.72);
  const easedDown = downT * downT * (3 - 2 * downT);
  return Math.max(GROUND_Y, NETA_LEVITATION_PEAK_Y * (1 - easedDown));
}

/**
 * Computes lighting dim factor [0..1] across the 4.8s "VANS, ATTACK!" sequence:
 * smooth dim in 0.0-0.24s, dramatic dim held through 4.2s lead-van ram,
 * smooth restore back to 0 during 4.2-4.8s.
 */
export function getNetaSuperDimFactor(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= NETA_SUPER_DURATION) return 0;
  if (elapsed < 0.24) return elapsed / 0.24;
  if (elapsed > 4.2) return Math.max(0, 1 - (elapsed - 4.2) / 0.6);
  return 1;
}

export function createNetaSuperState(
  attacker: FighterState,
  defender: FighterState,
): NetaSuperState {
  const dir: 1 | -1 = defender.x >= attacker.x ? 1 : -1;
  attacker.facing = dir;
  defender.facing = (dir === 1 ? -1 : 1) as 1 | -1;

  // Strict global 33% maxHP cap (~45% convoy ramming hits, ~55% Lead Van finisher)
  const totalSuperDamage = computeTotalSuperDamage(defender.maxHp);
  const comboDamageBudget = Math.round(totalSuperDamage * SUPER_COMBO_DAMAGE_SHARE);

  const safeTargetX = Math.max(ARENA_MIN_X + 1.8, Math.min(ARENA_MAX_X - 1.8, defender.x));

  return {
    active: true,
    attackerSlot: attacker.slot,
    defenderSlot: defender.slot,
    elapsed: 0,
    duration: NETA_SUPER_DURATION,
    phase: 'levitate_command',
    commandPointed: false,
    stampedeStarted: false,
    vanHitsLanded: 0,
    vanDamageDealt: 0,
    finisherHitLanded: false,
    totalSuperDamage,
    comboDamageBudget,
    superDamageDealt: 0,
    targetX: safeTargetX,
  };
}

function applyNetaSuperDamage(
  attacker: FighterState,
  defender: FighterState,
  superState: NetaSuperState,
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
  defender.hitFlashTimer = allowKo ? 0.24 : 0.12;
  defender.squashX = allowKo ? 1.34 : 1.22;
  defender.squashY = allowKo ? 0.68 : 0.82;
  return capped;
}

// 4 convoy vans impact times in Phase 2 + 5th Lead Van finisher at 4.02s
export const NETA_CONVOY_HIT_TIMES = [1.96, 2.48, 3.0, 3.52] as const;
export const NETA_LEAD_VAN_HIT_TIME = 4.02;

/**
 * Advances Garib Sena Neta's 4.8-second choreographed "VANS, ATTACK!" Super.
 * Smoothly levitates Neta to y ~ 2.2, sends 5 stylized white mini-vans charging
 * across the arena surface, enforces exact 33% maxHP damage cap, and touches Neta
 * smoothly back down onto the arena floor.
 */
export function stepNetaSuper(
  state: MatchState,
  superState: NetaSuperState,
  dt: number,
  events: CombatEvent[],
): NetaSuperBeatSignal[] {
  const signals: NetaSuperBeatSignal[] = [];
  if (!superState.active) return signals;

  const attacker = state.fighters[superState.attackerSlot];
  const defender = state.fighters[superState.defenderSlot];
  const dir: 1 | -1 = attacker.facing;

  const prevElapsed = superState.elapsed;
  superState.elapsed = Math.min(superState.duration, superState.elapsed + dt);
  const t = superState.elapsed;
  superState.phase = getNetaSuperPhase(t);

  // Lock Neta into smooth levitation -> command -> hover -> touchdown curve
  attacker.action = 'super';
  attacker.actionTimer = t;
  attacker.actionDuration = superState.duration;
  attacker.invulnTimer = Math.max(attacker.invulnTimer, 0.25);
  attacker.expression = t >= 4.02 ? 'victory' : 'attack';
  attacker.vx = 0;
  attacker.vy = 0;
  attacker.y = getNetaLevitationY(t);

  if (prevElapsed === 0) {
    signals.push({ kind: 'levitate_start', x: attacker.x, y: 0.4 });
  }

  // Clear stray projectiles so nothing interrupts the van convoy
  if (state.projectiles.length > 0) {
    state.projectiles.length = 0;
  }

  // PHASE 1 (0.0s - 1.5s): Levitation & Command ("Vans, attack!")
  if (t < 1.5) {
    if (!superState.commandPointed && t >= 0.95) {
      superState.commandPointed = true;
      signals.push({ kind: 'command_point', x: attacker.x, y: attacker.y + 1.4 });
    }
    defender.vx = 0;
    defender.vy = 0;
    defender.y = GROUND_Y;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.45;
    // Ensure clear horizontal runway for the incoming mini-van convoy
    const minRunway = 3.4;
    const desiredDefX =
      Math.abs(defender.x - attacker.x) < minRunway
        ? Math.max(ARENA_MIN_X + 1.6, Math.min(ARENA_MAX_X - 1.6, attacker.x + dir * minRunway))
        : Math.max(ARENA_MIN_X + 1.6, Math.min(ARENA_MAX_X - 1.6, defender.x));
    defender.x += (desiredDefX - defender.x) * Math.min(1, dt * 5.5);
    superState.targetX = defender.x;
    return signals;
  }

  // PHASE 2 (1.5s - 4.0s): Fleet of Vans Stampede on Arena Surface
  if (t < 4.0) {
    if (!superState.stampedeStarted) {
      superState.stampedeStarted = true;
      signals.push({ kind: 'stampede_start', x: attacker.x - dir * 6.0, y: 0.6 });
    }

    // Bounce opponent slightly on each van bumper impact while keeping them in the convoy path
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -24 * dt;
      defender.y += defender.vy * dt;
      if (defender.y <= GROUND_Y) {
        defender.y = GROUND_Y;
        defender.vy = 0;
      }
    }
    defender.vx = 0;
    defender.action = 'hit';
    defender.expression = 'hit';
    defender.hitstunTimer = 0.6;
    superState.targetX = defender.x;

    while (
      superState.vanHitsLanded < NETA_CONVOY_HIT_TIMES.length &&
      t >= NETA_CONVOY_HIT_TIMES[superState.vanHitsLanded]
    ) {
      const idx = superState.vanHitsLanded;
      superState.vanHitsLanded += 1;
      const targetComboTotal = Math.round(
        (superState.comboDamageBudget * (idx + 1)) / NETA_CONVOY_HIT_TIMES.length,
      );
      const beatDmg = Math.max(0, targetComboTotal - superState.vanDamageDealt);
      const dealt = applyNetaSuperDamage(attacker, defender, superState, beatDmg, false);
      superState.vanDamageDealt += dealt;

      defender.vy = 3.6 + (idx % 2) * 0.9;
      defender.y = Math.max(defender.y, 0.08);

      signals.push({ kind: 'van_hit', x: defender.x, y: 0.95, vanIndex: idx });
      events.push({
        type: 'heavy_hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.25 + (idx % 2) * 0.2,
        damage: dealt,
        word: 'THOKKAR!',
        color: idx % 2 === 0 ? '#FB923C' : '#FACC15',
      });
    }
    return signals;
  }

  // PHASE 3 (4.0s - 4.8s): Lead Van Finisher & Touchdown
  if (!superState.finisherHitLanded) {
    if (defender.y > GROUND_Y || defender.vy !== 0) {
      defender.vy += -24 * dt;
      defender.y = Math.max(GROUND_Y, defender.y + defender.vy * dt);
      if (defender.y <= GROUND_Y) defender.vy = 0;
    }

    if (t >= NETA_LEAD_VAN_HIT_TIME) {
      superState.finisherHitLanded = true;
      const remaining = Math.max(0, superState.totalSuperDamage - superState.superDamageDealt);
      const dealt = applyNetaSuperDamage(attacker, defender, superState, remaining, true);

      // Heavy Lead Van ram launches opponent spinning high and crashing flat onto arena floor!
      defender.vx = dir * 10.6;
      defender.vy = 7.8;
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

      signals.push({ kind: 'van_finisher', x: defender.x, y: 1.2, vanIndex: NETA_VAN_COUNT - 1 });
      events.push({
        type: defender.hp <= 0 ? 'ko' : 'heavy_hit',
        attackerSlot: attacker.slot,
        x: defender.x,
        y: 1.55,
        damage: dealt,
        word: 'MAHA THOKKAR!',
        color: '#F97316',
        headline:
          defender.hp <= 0
            ? 'BREAKING: GARIB SENA VAN CONVOY FLATTENS OPPONENT FOR K.O.!'
            : 'VANS, ATTACK! GARIB SENA CONVOY RAMS OPPONENT ACROSS THE ARENA!',
      });
    }
  } else {
    // Advance launched opponent spinning airborne -> flat floor crash during 4.02s - 4.8s
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
      defender.vx *= Math.max(0, 1 - dt * 7);
      defender.x += defender.vx * dt;
    }
    defender.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, defender.x));
    defender.actionTimer += dt;
  }

  // Sequence complete at 4.8s — Neta touches down cleanly into kung-fu stance
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
