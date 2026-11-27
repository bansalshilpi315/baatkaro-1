import { FIGHTER_CONFIGS, STAGE_CONFIGS } from './characters/configs';
import { ROUND1_INTRO_TOTAL_SECONDS } from './dialogue';
import {
  ANDA_SUPER_DURATION,
  createAndaSuperState,
  stepAndaSuper,
} from './andaSuper';
import {
  BILLA_SUPER_DURATION,
  createBillaSuperState,
  stepBillaSuper,
} from './billaSuper';
import {
  FATHER_SUPER_DURATION,
  createFatherSuperState,
  stepFatherSuper,
} from './fatherSuper';
import {
  MAUSI_SUPER_DURATION,
  createMausiSuperState,
  stepMausiSuper,
} from './mausiSuper';
import {
  NETA_SUPER_DURATION,
  createNetaSuperState,
  stepNetaSuper,
} from './netaSuper';
import {
  SAMYAK_SUPER_DURATION,
  createSamyakSuperState,
  stepSamyakSuper,
} from './samyakSuper';
import {
  SHERU_SUPER_DURATION,
  createSheruSuperState,
  stepSheruSuper,
} from './sheruSuper';
import type {
  CombatEvent,
  Difficulty,
  FighterAction,
  FighterId,
  FighterInput,
  FighterState,
  MatchResultSnapshot,
  MatchState,
  ProjectileState,
  StageId,
} from './types';

export const ARENA_MIN_X = -9.5;
export const ARENA_MAX_X = 9.5;
export const GROUND_Y = 0;
export const GRAVITY = -28;
export const ROUND_DURATION_SECONDS = 60;
export const MIN_FIGHTER_SEPARATION = 1.05;
export const SUPER_MAX_HP_DAMAGE_RATIO = 0.33;
export const SUPER_COMBO_DAMAGE_SHARE = 0.45;

export function computeTotalSuperDamage(opponentMaxHp: number): number {
  return Math.round(opponentMaxHp * SUPER_MAX_HP_DAMAGE_RATIO);
}

const HIT_WORDS_LIGHT = ['DHISHUM!', 'THAPAD!', 'KADAK!', 'BUMPER!'];
const HIT_WORDS_HEAVY = ['PAISA VASOOL!', 'JHAKAAS!', 'DHAMAKA!', 'MAHA HIT!'];

export function createEmptyInput(): FighterInput {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    grab: false,
    special: false,
    superMove: false,
  };
}

export const ROUNDS_TO_WIN = 2;
export const ROUND1_INTRO_DURATION = ROUND1_INTRO_TOTAL_SECONDS;
export const NEXT_ROUND_INTRO_DURATION = 1.55;
export const KO_SLOWMO_DURATION = 0.9;
export const KO_CELEBRATION_DURATION = 1.45;
export const KNOCKDOWN_GROUND_DURATION = 0.7;
export const GETUP_DURATION = 0.56;
export const WAKEUP_INVULN_DURATION = 0.5;
export const NON_SHERU_SUPER_DURATION = 1.6;

const COMBO_FINISHER_CALLOUTS: Record<FighterId, string> = {
  sheru: 'PAISA UPPERCUT!',
  billa: 'SWATTER SLAPPER!',
  neta: 'JHOLA SLAM!',
  anda: 'ANDA CRACKER!',
  mausi: 'BELAN SMASH!',
  father: 'DISCIPLINE CHOP!',
  samyak: 'BEAST UPPERCUT!',
};

const GRAB_THROW_CALLOUTS: Record<FighterId, string> = {
  sheru: 'SYSTUMM PATKI!',
  billa: 'CATAPULT TOSS!',
  neta: 'DHARNA DHAKKA!',
  anda: 'EGG FLIP SLAM!',
  mausi: 'AUNTY PATKI!',
  father: 'PRINCIPAL DISMISSAL!',
  samyak: 'BENCH-PRESS SLAM!',
};

export function createFighterState(slot: 0 | 1, id: FighterId): FighterState {
  const cfg = FIGHTER_CONFIGS[id];
  return {
    slot,
    id,
    x: slot === 0 ? -2.4 : 2.4,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    shakti: 0,
    action: 'idle',
    actionTimer: 0,
    actionDuration: 0,
    hasHitCurrentAttack: false,
    hitstunTimer: 0,
    blockstunTimer: 0,
    specialCooldown: 0,
    specialMaxCooldown: cfg.special.cooldown,
    dharnaShieldTimer: 0,
    dharnaWaveFired: false,
    squashHoldTimer: 0,
    squashedTimer: 0,
    invulnTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    comboStep: 0,
    comboChainTimer: 0,
    knockdownTimer: 0,
    grabTargetSlot: null,
    maxCombo: 0,
    damageDealt: 0,
    superDamageBudget: 0,
    superDamageDealt: 0,
    specialsLanded: 0,
    walkCycle: 0,
    hitFlashTimer: 0,
    squashX: 1,
    squashY: 1,
    expression: 'idle',
    bufferedAction: null,
    bufferTimer: 0,
  };
}

export function createMatchState(p1Id: FighterId, p2Id: FighterId, skipIntro = false): MatchState {
  return {
    fighters: [createFighterState(0, p1Id), createFighterState(1, p2Id)],
    projectiles: [],
    roundNumber: 1,
    p1RoundsWon: 0,
    p2RoundsWon: 0,
    roundsToWin: ROUNDS_TO_WIN,
    roundWinnerSlot: null,
    roundTime: ROUND_DURATION_SECONDS,
    hitstopTimer: 0,
    phase: skipIntro ? 'fighting' : 'intro',
    phaseTimer: skipIntro ? 0 : ROUND1_INTRO_DURATION,
    introDuration: ROUND1_INTRO_DURATION,
    koSubPhase: 'none',
    koCalloutText: 'DAHI KHATAM!',
    activeSuperSlot: null,
    activeSuperElapsed: 0,
    activeSuperDuration: 0,
    winnerSlot: null,
    finishReason: null,
    nextProjectileUid: 1,
    aiThinkTimer: 0.25,
    aiCurrentIntent: 'idle',
    aiIntentTimer: 0.4,
    sheruSuper: null,
    sheruSuperSignals: [],
    billaSuper: null,
    billaSuperSignals: [],
    netaSuper: null,
    netaSuperSignals: [],
    andaSuper: null,
    andaSuperSignals: [],
    mausiSuper: null,
    mausiSuperSignals: [],
    fatherSuper: null,
    fatherSuperSignals: [],
    samyakSuper: null,
    samyakSuperSignals: [],
  };
}

export function isAnySuperActive(state: MatchState): boolean {
  return Boolean(
    state.activeSuperSlot !== null ||
      state.sheruSuper?.active ||
      state.billaSuper?.active ||
      state.netaSuper?.active ||
      state.andaSuper?.active ||
      state.mausiSuper?.active ||
      state.fatherSuper?.active ||
      state.samyakSuper?.active ||
      state.fighters[0].action === 'super' ||
      state.fighters[1].action === 'super',
  );
}

/**
 * Generic comic hit-text spam is strictly disabled during ALL Super Powers,
 * while permitting each character's signature Super finisher/punchline pop-up
 * (marked `isSuperSignature: true`) and Blue Billa's sparse Phase 3 smoke-cloud pops.
 */
export function shouldAllowFloatingCallout(state: MatchState, event?: CombatEvent): boolean {
  if (!isAnySuperActive(state)) return true;
  if (event?.isSuperSignature) return true;
  return Boolean(state.billaSuper?.active && state.billaSuper.phase === 'smoke_beatdown');
}

export function resolveRoundEnd(
  state: MatchState,
  roundWinner: 0 | 1 | 'draw',
  reason: 'ko' | 'timeout',
  freezeDuration = KO_SLOWMO_DURATION,
): void {
  state.phase = 'ko_freeze';
  state.koSubPhase = 'impact_slowmo';
  state.phaseTimer = freezeDuration;
  state.roundWinnerSlot = roundWinner;
  state.finishReason = reason;
  state.activeSuperSlot = null;
  state.activeSuperElapsed = 0;
  state.activeSuperDuration = 0;
  state.koCalloutText = reason === 'timeout' ? 'TIME KHATAM!' : 'DAHI KHATAM!';

  // Ensure defeated fighter gets launched cleanly onto the arena floor if still upright
  if (roundWinner === 0 || roundWinner === 1) {
    const loser = state.fighters[1 - roundWinner];
    const winner = state.fighters[roundWinner];
    const awayDir = loser.x >= winner.x ? 1 : -1;
    loser.action = 'ko';
    loser.expression = 'ko';
    loser.grabTargetSlot = null;
    if (reason === 'ko' && Math.abs(loser.vx) < 2.2) {
      loser.vx = awayDir * 5.2;
      loser.vy = Math.max(loser.vy, 4.4);
      loser.y = Math.max(loser.y, 0.08);
    }
  }

  if (roundWinner === 0) {
    state.p1RoundsWon = Math.min(state.roundsToWin, state.p1RoundsWon + 1);
  } else if (roundWinner === 1) {
    state.p2RoundsWon = Math.min(state.roundsToWin, state.p2RoundsWon + 1);
  }

  if (state.p1RoundsWon >= state.roundsToWin) {
    state.winnerSlot = 0;
  } else if (state.p2RoundsWon >= state.roundsToWin) {
    state.winnerSlot = 1;
  } else if (roundWinner === 'draw' && state.roundNumber >= state.roundsToWin * 2 - 1) {
    if (state.p1RoundsWon > state.p2RoundsWon) state.winnerSlot = 0;
    else if (state.p2RoundsWon > state.p1RoundsWon) state.winnerSlot = 1;
    else state.winnerSlot = 'draw';
  } else {
    state.winnerSlot = null;
  }
}

function resetFighterForNextRound(f: FighterState): void {
  f.x = f.slot === 0 ? -2.4 : 2.4;
  f.y = GROUND_Y;
  f.vx = 0;
  f.vy = 0;
  f.facing = f.slot === 0 ? 1 : -1;
  f.hp = f.maxHp;
  f.action = 'idle';
  f.actionTimer = 0;
  f.actionDuration = 0;
  f.hasHitCurrentAttack = false;
  f.hitstunTimer = 0;
  f.blockstunTimer = 0;
  f.specialCooldown = 0;
  f.dharnaShieldTimer = 0;
  f.dharnaWaveFired = false;
  f.squashHoldTimer = 0;
  f.squashedTimer = 0;
  f.invulnTimer = 0;
  f.comboCount = 0;
  f.comboTimer = 0;
  f.comboStep = 0;
  f.comboChainTimer = 0;
  f.knockdownTimer = 0;
  f.grabTargetSlot = null;
  f.hitFlashTimer = 0;
  f.squashX = 1;
  f.squashY = 1;
  f.expression = 'idle';
  f.bufferedAction = null;
  f.bufferTimer = 0;
}

export function isHoldingBack(fighter: FighterState, input: FighterInput): boolean {
  return (fighter.facing === 1 && input.left && !input.right) ||
    (fighter.facing === -1 && input.right && !input.left);
}

function isBusyAttacking(action: FighterAction): boolean {
  return (
    action === 'punch' ||
    action === 'kick' ||
    action === 'sweep' ||
    action === 'grab' ||
    action === 'grab_hold' ||
    action === 'special' ||
    action === 'super'
  );
}

function isIncapacitated(action: FighterAction): boolean {
  return (
    action === 'grabbed' ||
    action === 'knockdown' ||
    action === 'getup' ||
    action === 'ko'
  );
}

function pickWord(list: string[], seed: number): string {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

export function getAttackTiming(fighter: FighterState): {
  windup: number;
  active: number;
  recovery: number;
  range: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  hitstop: number;
  stun: number;
  isHeavy: boolean;
  isGrab: boolean;
  isSpecial: boolean;
  isSuper: boolean;
  causesKnockdown: boolean;
  moveCallout?: string;
} {
  const cfg = FIGHTER_CONFIGS[fighter.id];
  const powerMult = cfg.attackPowerMultiplier ?? 1;
  switch (fighter.action) {
    case 'punch': {
      if (fighter.comboStep === 2) {
        // 3rd hit: Heavy Finisher Uppercut / Haymaker -> Launch & Knockdown!
        return {
          windup: 0.1,
          active: 0.12,
          recovery: 0.24,
          range: 2.02,
          damage: Math.round(cfg.punchDamage * 1.45 * powerMult),
          knockbackX: 7.4,
          knockbackY: 6.2,
          hitstop: 0.058,
          stun: 0.42,
          isHeavy: true,
          isGrab: false,
          isSpecial: false,
          isSuper: false,
          causesKnockdown: true,
          moveCallout: COMBO_FINISHER_CALLOUTS[fighter.id],
        };
      }
      if (fighter.comboStep === 1) {
        // 2nd hit: Snappy Cross
        return {
          windup: 0.07,
          active: 0.1,
          recovery: 0.16,
          range: 1.9,
          damage: Math.round(cfg.punchDamage * 1.15 * powerMult),
          knockbackX: 3.6,
          knockbackY: 1.4,
          hitstop: 0.046,
          stun: 0.28,
          isHeavy: false,
          isGrab: false,
          isSpecial: false,
          isSuper: false,
          causesKnockdown: false,
        };
      }
      // 1st hit: Crisp Jab
      return {
        windup: 0.06,
        active: 0.09,
        recovery: 0.14,
        range: 1.82,
        damage: Math.round(cfg.punchDamage * powerMult),
        knockbackX: 2.6,
        knockbackY: 0.8,
        hitstop: 0.04,
        stun: 0.25,
        isHeavy: false,
        isGrab: false,
        isSpecial: false,
        isSuper: false,
        causesKnockdown: false,
      };
    }
    case 'kick': {
      if (fighter.comboStep === 1) {
        // 2nd Kick Combo -> Side / Roundhouse Kick at chest/head height (chains cleanly into Jump Spinning Kick)
        return {
          windup: 0.09,
          active: 0.13,
          recovery: 0.21,
          range: 2.24,
          damage: Math.round(cfg.kickDamage * 1.08 * powerMult),
          knockbackX: 5.4,
          knockbackY: 1.8,
          hitstop: 0.052,
          stun: 0.38,
          isHeavy: true,
          isGrab: false,
          isSpecial: false,
          isSuper: false,
          causesKnockdown: false,
          moveCallout: 'ROUNDHOUSE!',
        };
      }
      const isFinisher = fighter.comboStep === 2;
      return {
        windup: 0.11,
        active: 0.13,
        recovery: isFinisher ? 0.26 : 0.20,
        range: isFinisher ? 2.34 : 2.18,
        damage: isFinisher
          ? Math.round(cfg.kickDamage * 1.28 * powerMult)
          : Math.round(cfg.kickDamage * powerMult),
        knockbackX: isFinisher ? 8.2 : 4.8,
        knockbackY: isFinisher ? 6.5 : 1.6,
        hitstop: isFinisher ? 0.06 : 0.048,
        stun: isFinisher ? 0.42 : 0.36,
        isHeavy: true,
        isGrab: false,
        isSpecial: false,
        isSuper: false,
        causesKnockdown: isFinisher,
        moveCallout: isFinisher ? COMBO_FINISHER_CALLOUTS[fighter.id] : undefined,
      };
    }
    case 'sweep':
      return {
        windup: 0.09,
        active: 0.13,
        recovery: 0.24,
        range: 2.16,
        damage: Math.round(cfg.kickDamage * 0.85 * powerMult),
        knockbackX: 5.0,
        knockbackY: 5.8,
        hitstop: 0.054,
        stun: 0.38,
        isHeavy: true,
        isGrab: false,
        isSpecial: false,
        isSuper: false,
        causesKnockdown: true,
        moveCallout: 'TANGDI SWEEP!',
      };
    case 'grab':
      return {
        windup: 0.07,
        active: 0.11,
        recovery: 0.26,
        range: 1.68,
        damage: Math.round(cfg.grabDamage * powerMult),
        knockbackX: 8.2,
        knockbackY: 6.4,
        hitstop: 0.056,
        stun: 0.44,
        isHeavy: true,
        isGrab: true,
        isSpecial: false,
        isSuper: false,
        causesKnockdown: true,
        moveCallout: GRAB_THROW_CALLOUTS[fighter.id],
      };
    case 'grab_hold':
      return {
        windup: 0.2,
        active: 0.08,
        recovery: 0.22,
        range: 1.8,
        damage: Math.round(cfg.grabDamage * powerMult),
        knockbackX: 8.2,
        knockbackY: 6.4,
        hitstop: 0.056,
        stun: 0.44,
        isHeavy: true,
        isGrab: true,
        isSpecial: false,
        isSuper: false,
        causesKnockdown: true,
        moveCallout: GRAB_THROW_CALLOUTS[fighter.id],
      };
    case 'special': {
      const sp = cfg.special;
      return {
        windup: sp.windup,
        active: sp.active,
        recovery: sp.recovery,
        range: sp.range,
        damage: Math.round(sp.damage * powerMult),
        knockbackX: sp.knockbackX,
        knockbackY: sp.knockbackY,
        hitstop: 0.056,
        stun: sp.stunDuration,
        isHeavy: true,
        isGrab: false,
        isSpecial: true,
        isSuper: false,
        causesKnockdown: false,
        moveCallout: `${sp.shortLabel}!`,
      };
    }
    case 'super':
      return {
        windup: 0.42,
        active: 0.22,
        recovery: 0.96,
        range: 3.1,
        damage: 26,
        knockbackX: 9.8,
        knockbackY: 6.6,
        hitstop: 0.06,
        stun: 0.52,
        isHeavy: true,
        isGrab: false,
        isSpecial: false,
        isSuper: true,
        causesKnockdown: true,
        moveCallout: `${cfg.superName}!`,
      };
    default:
      return {
        windup: 0,
        active: 0,
        recovery: 0,
        range: 0,
        damage: 0,
        knockbackX: 0,
        knockbackY: 0,
        hitstop: 0,
        stun: 0,
        isHeavy: false,
        isGrab: false,
        isSpecial: false,
        isSuper: false,
        causesKnockdown: false,
      };
  }
}

function startAction(
  state: MatchState,
  fighter: FighterState,
  action: 'punch' | 'kick' | 'sweep' | 'grab' | 'special' | 'super',
  events: CombatEvent[],
  forcedComboStep?: 0 | 1 | 2,
): void {
  const cfg = FIGHTER_CONFIGS[fighter.id];

  // Manage 3-hit Punch/Kick combo progression (Jab -> Cross -> Heavy Finisher)
  if (action === 'punch' || action === 'kick') {
    if (forcedComboStep !== undefined) {
      fighter.comboStep = forcedComboStep;
    } else if (fighter.comboChainTimer > 0 && fighter.comboStep < 2) {
      fighter.comboStep = (fighter.comboStep + 1) as 0 | 1 | 2;
    } else {
      fighter.comboStep = 0;
    }
    fighter.comboChainTimer = fighter.comboStep < 2 ? 0.52 : 0;
    // Slight forward step-in momentum on combos (+ brisk hop on 3rd-hit Jump-Kick Finisher)
    if (fighter.y <= GROUND_Y + 0.02) {
      fighter.vx = fighter.facing * (fighter.comboStep === 2 ? 3.4 : fighter.comboStep === 1 ? 2.2 : 1.4);
      if (action === 'kick' && fighter.comboStep === 2) {
        fighter.vy = 5.4;
        fighter.y = 0.04;
      }
    }
  } else {
    fighter.comboStep = 0;
    fighter.comboChainTimer = 0;
  }

  fighter.action = action;
  fighter.actionTimer = 0;
  fighter.hasHitCurrentAttack = false;
  fighter.expression = 'attack';
  const timing = getAttackTiming(fighter);
  fighter.actionDuration = timing.windup + timing.active + timing.recovery;

  if (action === 'special') {
    const opp = state.fighters[1 - fighter.slot];
    fighter.specialCooldown = cfg.special.cooldown;
    fighter.specialMaxCooldown = cfg.special.cooldown;
    fighter.hitFlashTimer = 0.09; // Crisp startup flash on all 5 Signature Moves
    fighter.dharnaWaveFired = false;
    fighter.squashHoldTimer = 0;

    if (cfg.special.id === 'dharna_shield') {
      fighter.dharnaShieldTimer = cfg.special.active; // ~0.9s translucent protest shield dome
      fighter.vx = 0;
      events.push({
        type: 'special',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.3,
        damage: 0,
        word: 'DHARNA!',
        moveCallout: 'DHARNA SHIELD!',
        color: '#F97316',
        headline: `${cfg.name.toUpperCase()} PROJECTS DHARNA SHIELD PROTEST DOME!`,
      });
    } else if (cfg.special.id === 'anda_squash') {
      // Hop forward cleanly onto opponent's position to flop completely flat on top of them!
      const rawDist = Math.abs(opp.x - fighter.x);
      const targetSpeed = Math.max(4.6, Math.min(8.8, rawDist * 2.15 + 1.4));
      fighter.vx = fighter.facing * targetSpeed;
      fighter.vy = 8.4;
      fighter.y = Math.max(fighter.y, 0.05);
      fighter.squashX = 0.84;
      fighter.squashY = 1.22;
      events.push({
        type: 'special',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.4,
        damage: 0,
        word: 'ANDA SQUASH!',
        moveCallout: 'ANDA SQUASH!',
        color: '#FFD426',
      });
    } else if (cfg.special.id === 'currency_burst') {
      // Cocky chest-puff flex burst forward with golden aura shockwave!
      fighter.vx = fighter.facing * 6.4;
      events.push({
        type: 'special',
        attackerSlot: fighter.slot,
        x: fighter.x + fighter.facing * 0.45,
        y: fighter.y + 1.35,
        damage: 0,
        word: 'PAISA FLEX!',
        moveCallout: 'PAISA FLEX!',
        color: '#FACC15',
      });
    } else {
      events.push({
        type: 'special',
        attackerSlot: fighter.slot,
        x: fighter.x + fighter.facing * 0.6,
        y: fighter.y + 1.4,
        damage: 0,
        word: cfg.special.shortLabel + '!',
        moveCallout: `${cfg.special.shortLabel}!`,
        color: cfg.special.accentColor,
      });
    }
  } else if (action === 'super') {
    const opp = state.fighters[1 - fighter.slot];
    const totalSuperDamage = computeTotalSuperDamage(opp.maxHp);
    fighter.shakti = 0;
    fighter.superDamageBudget = totalSuperDamage;
    fighter.superDamageDealt = 0;
    if (fighter.id === 'sheru') {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.y = GROUND_Y;
      fighter.actionDuration = SHERU_SUPER_DURATION;
      state.sheruSuper = createSheruSuperState(fighter, opp);
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = SHERU_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.5,
        damage: 0,
        color: '#FDE047',
        headline: `TRILLION DOLLAR BEATDOWN! ${cfg.name.toUpperCase()} DROPS THE GOLDEN SPOTLIGHT!`,
      });
    } else if (fighter.id === 'billa') {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.y = GROUND_Y;
      fighter.actionDuration = BILLA_SUPER_DURATION;
      state.billaSuper = createBillaSuperState(fighter, opp);
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = BILLA_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.65,
        damage: 0,
        color: '#4ADE80',
        headline: `CHIRKUT CHAOS! ${cfg.name.toUpperCase()} UNLEASHES THE 3 COCKROACHES!`,
      });
    } else if (fighter.id === 'neta') {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.y = GROUND_Y;
      fighter.actionDuration = NETA_SUPER_DURATION;
      state.netaSuper = createNetaSuperState(fighter, opp);
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = NETA_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.6,
        damage: 0,
        color: '#F97316',
        headline: `VANS, ATTACK! ${cfg.name.toUpperCase()} LEVITATES AND SUMMONS THE GARIB SENA CONVOY!`,
      });
    } else if (fighter.id === 'anda') {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.y = GROUND_Y;
      fighter.actionDuration = ANDA_SUPER_DURATION;
      state.andaSuper = createAndaSuperState(fighter, opp);
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = ANDA_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.6,
        damage: 0,
        color: '#38BDF8',
        headline: `THE GREAT WALL DROP! ${cfg.name.toUpperCase()} TIPS HIS HAT AND SUMMONS THE RED BRICK WALL!`,
      });
    } else if (fighter.id === 'mausi') {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.y = GROUND_Y;
      fighter.actionDuration = MAUSI_SUPER_DURATION;
      state.mausiSuper = createMausiSuperState(fighter, opp);
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = MAUSI_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.65,
        damage: 0,
        color: '#FBBF24',
        headline: `GOL-GOL LADDOO BARRAGE! ${cfg.name.toUpperCase()} POWERS UP WITH THE GOLDEN LADDOO!`,
      });
    } else if (fighter.id === 'father') {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.y = GROUND_Y;
      fighter.actionDuration = FATHER_SUPER_DURATION;
      state.fatherSuper = createFatherSuperState(fighter, opp);
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = FATHER_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.65,
        damage: 0,
        color: '#EF4444',
        headline: `RUSTICATION ORDER! ${cfg.name.toUpperCase()} LEVITATES AND SUMMONS OFFICIAL NOTICES!`,
      });
    } else if (fighter.id === 'samyak') {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.vy = 0;
      fighter.y = GROUND_Y;
      fighter.actionDuration = SAMYAK_SUPER_DURATION;
      state.samyakSuper = createSamyakSuperState(fighter, opp);
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = SAMYAK_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.65,
        damage: 0,
        color: '#FACC15',
        headline: `MISSION IAS: BEAST MODE! ${cfg.name.toUpperCase()} FLEXES AND UNLEASHES THE UPSC BARRAGE!`,
      });
    } else {
      fighter.invulnTimer = 0.65;
      fighter.vx = 0;
      fighter.actionDuration = NON_SHERU_SUPER_DURATION;
      state.activeSuperSlot = fighter.slot;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = NON_SHERU_SUPER_DURATION;
      events.push({
        type: 'super',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.5,
        damage: 0,
        moveCallout: `${cfg.superName}!`,
        color: '#FDE047',
        headline: `SHAKTI METER EXPLODES! ${cfg.name.toUpperCase()} UNLEASHES ${cfg.superName}!`,
      });
    }
  } else {
    events.push({
      type: 'whiff',
      attackerSlot: fighter.slot,
      x: fighter.x + fighter.facing * 0.8,
      y: fighter.y + 1.2,
      damage: 0,
    });
  }
}

function applyHit(
  state: MatchState,
  attacker: FighterState,
  defender: FighterState,
  defenderInput: FighterInput,
  params: {
    damage: number;
    knockbackX: number;
    knockbackY: number;
    hitstop: number;
    stun: number;
    isHeavy: boolean;
    isGrab: boolean;
    isSpecial: boolean;
    isSuper: boolean;
    causesKnockdown?: boolean;
    moveCallout?: string;
    isProjectile?: boolean;
    hitX: number;
    hitY: number;
  },
  events: CombatEvent[],
): void {
  if (defender.invulnTimer > 0 || defender.hp <= 0) return;
  if (!params.isGrab && (defender.action === 'knockdown' || defender.action === 'getup')) {
    return;
  }

  const atkCfg = FIGHTER_CONFIGS[attacker.id];
  const defCfg = FIGHTER_CONFIGS[defender.id];

  // Global Super Power damage cap: never exceed 33% of opponent maxHp across an activation
  let effectiveDamage = params.damage;
  if (params.isSuper) {
    const budget =
      attacker.superDamageBudget > 0
        ? attacker.superDamageBudget
        : computeTotalSuperDamage(defender.maxHp);
    const remainingCap = Math.max(0, budget - attacker.superDamageDealt);
    effectiveDamage = Math.min(params.damage, remainingCap);
    if (effectiveDamage <= 0) return;
  }

  // Check Dharna Shield negate & sonic counter on defender!
  if (defender.dharnaShieldTimer > 0 && !params.isGrab) {
    // Negates incoming non-Super attacks during Dharna Shield startup/active window!
    const appliedReduced = params.isSuper
      ? Math.min(
          Math.max(1, Math.round(effectiveDamage * 0.3)),
          Math.max(0, attacker.superDamageBudget - attacker.superDamageDealt),
        )
      : 0;
    if (appliedReduced > 0) {
      defender.hp = Math.max(0, defender.hp - appliedReduced);
      attacker.superDamageDealt += appliedReduced;
    }
    defender.shakti = Math.min(100, defender.shakti + 12);
    defender.hitFlashTimer = 0.08;
    defender.dharnaWaveFired = true;

    // Push melee attacker back with 11%-13% maxHP sonic counter damage
    if (!params.isProjectile) {
      const counterDmg = Math.min(computeSignatureDamage(attacker.maxHp), attacker.hp);
      attacker.hp = Math.max(0, attacker.hp - counterDmg);
      attacker.vx = -attacker.facing * defCfg.special.knockbackX;
      attacker.vy = defCfg.special.knockbackY;
      attacker.hitstunTimer = defCfg.special.stunDuration;
      attacker.action = attacker.hp <= 0 ? 'ko' : 'hit';
      attacker.actionTimer = 0;
      attacker.expression = attacker.hp <= 0 ? 'ko' : 'hit';
      attacker.hitFlashTimer = 0.14;
      defender.damageDealt += counterDmg;
      defender.specialsLanded += 1;
    }

    state.hitstopTimer = Math.max(state.hitstopTimer, 0.055);
    events.push({
      type: 'dharna_counter',
      attackerSlot: defender.slot,
      x: params.hitX,
      y: params.hitY,
      damage: appliedReduced,
      word: 'DHARNA WAVE!',
      moveCallout: 'DHARNA SHIELD!',
      color: '#FB923C',
      headline: `${defCfg.name.toUpperCase()} NEGATED THE ATTACK WITH DHARNA SHIELD!`,
    });
    return;
  }

  // Check normal block (holding back while grounded and not attacking/stunned)
  const canBlock =
    !params.isGrab &&
    defender.y <= GROUND_Y + 0.02 &&
    defender.hitstunTimer <= 0 &&
    !isBusyAttacking(defender.action) &&
    isHoldingBack(defender, defenderInput);

  if (canBlock) {
    const rawChip = params.isSpecial || params.isSuper ? Math.max(2, Math.round(effectiveDamage * 0.25)) : 1;
    const chipDamage = params.isSuper
      ? Math.min(rawChip, Math.max(0, attacker.superDamageBudget - attacker.superDamageDealt))
      : rawChip;
    defender.hp = Math.max(1, defender.hp - chipDamage);
    if (params.isSuper) {
      attacker.superDamageDealt += chipDamage;
    }
    defender.action = 'block';
    defender.expression = 'block';
    defender.blockstunTimer = params.isHeavy ? 0.22 : 0.14;
    defender.vx = (attacker.x <= defender.x ? 1 : -1) * (params.knockbackX * 0.45);
    defender.shakti = Math.min(100, defender.shakti + 7);
    attacker.shakti = Math.min(100, attacker.shakti + 5);
    state.hitstopTimer = Math.max(state.hitstopTimer, 0.024);

    events.push({
      type: 'block',
      attackerSlot: attacker.slot,
      x: params.hitX,
      y: params.hitY,
      damage: chipDamage,
      word: 'BLOCKED!',
      color: '#38BDF8',
    });
    return;
  }

  // Detect COUNTER! interruption when attacker hits opponent during their attack startup
  const isCounterHit =
    !params.isSuper &&
    !params.isGrab &&
    isBusyAttacking(defender.action) &&
    defender.action !== 'super' &&
    defender.action !== 'grab_hold' &&
    defender.actionTimer <= getAttackTiming(defender).windup + 0.04;

  // Clean Hit!
  const dir = attacker.x <= defender.x ? 1 : -1;
  const counterBonus = isCounterHit ? 2 : 0;
  const actualDamage = Math.min(effectiveDamage + counterBonus, defender.hp);
  defender.hp = Math.max(0, defender.hp - actualDamage);
  defender.vx = dir * params.knockbackX;
  defender.vy = Math.max(defender.vy, params.knockbackY);
  defender.blockstunTimer = 0;
  defender.grabTargetSlot = null;

  if (defender.hp <= 0) {
    defender.action = 'ko';
    defender.expression = 'ko';
    defender.hitstunTimer = 0;
    defender.y = Math.max(defender.y, 0.08);
    defender.vy = Math.max(defender.vy, 5.4);
  } else if (params.causesKnockdown) {
    // True Launch -> Slam flat on back -> ~0.7s grounded -> 2-stage Get-up with 0.5s invincibility!
    defender.action = 'knockdown';
    defender.actionTimer = 0;
    defender.actionDuration = 0;
    defender.hitstunTimer = 0;
    defender.knockdownTimer = KNOCKDOWN_GROUND_DURATION;
    defender.y = Math.max(defender.y, 0.08);
    defender.vy = Math.max(defender.vy, 5.4);
    defender.expression = 'hit';
  } else {
    defender.hitstunTimer = params.stun + (isCounterHit ? 0.06 : 0);
    defender.action = 'hit';
    defender.actionTimer = 0;
    defender.expression = 'hit';
  }

  defender.hitFlashTimer = params.isHeavy || isCounterHit ? 0.14 : 0.09;
  defender.squashX = 1.22;
  defender.squashY = 0.8;

  attacker.damageDealt += actualDamage;
  if (params.isSuper) {
    attacker.superDamageDealt += actualDamage;
  }
  if (params.isSpecial) {
    attacker.specialsLanded += 1;
  }
  attacker.comboCount += 1;
  attacker.comboTimer = 1.95;
  if (attacker.comboCount > attacker.maxCombo) {
    attacker.maxCombo = attacker.comboCount;
  }

  // SHAKTI gain
  attacker.shakti = Math.min(100, attacker.shakti + (params.isSuper ? 0 : params.isHeavy ? 15 : 10));
  defender.shakti = Math.min(100, defender.shakti + (params.isHeavy ? 12 : 8));

  state.hitstopTimer = Math.max(state.hitstopTimer, params.hitstop + (isCounterHit ? 0.014 : 0));

  const seed = state.roundTime * 17 + attacker.damageDealt + defender.hp;
  let word = isCounterHit
    ? 'COUNTER!'
    : params.isGrab
      ? 'DHAKKA!'
      : params.isSuper
        ? 'SHAKTI BOOM!'
        : params.isHeavy
          ? pickWord(HIT_WORDS_HEAVY, seed)
          : pickWord(HIT_WORDS_LIGHT, seed);

  if (!isCounterHit && attacker.comboCount >= 3 && !params.isSuper) {
    word = `${attacker.comboCount} HITS!`;
  }

  let headline: string | undefined;
  if (defender.hp <= 0) {
    headline = `BREAKING: ${atkCfg.name.toUpperCase()} KNOCKS OUT ${defCfg.name.toUpperCase()} LIVE ON AIR!`;
  } else if (defender.hp <= defender.maxHp * 0.25 && defender.hp + params.damage > defender.maxHp * 0.25) {
    headline = `DANGER ZONE: ${defCfg.name.toUpperCase()} ON LAST LEG — PUBLIC DEMANDS COMEBACK!`;
  } else if (params.isSpecial) {
    headline = `DIRECT HIT! ${atkCfg.name.toUpperCase()} LANDS ${atkCfg.special.name.toUpperCase()}!`;
  } else if (attacker.comboCount >= 3) {
    headline = `${attacker.comboCount}-HIT DHISHUM COMBO BY ${atkCfg.name.toUpperCase()}!`;
  }

  events.push({
    type:
      defender.hp <= 0
        ? 'ko'
        : params.isGrab
          ? 'grab_throw'
          : params.isHeavy
            ? 'heavy_hit'
            : 'hit',
    attackerSlot: attacker.slot,
    x: params.hitX,
    y: params.hitY,
    damage: actualDamage,
    word,
    moveCallout: params.moveCallout ?? (isCounterHit ? 'COUNTER HIT!' : undefined),
    color: isCounterHit ? '#FEF08A' : params.isSuper ? '#FDE047' : params.isHeavy ? '#FB7185' : '#FBBF24',
    headline,
  });
}

export const SIGNATURE_MOVE_COOLDOWN = 3.5;

/**
 * Computes mid-tier Signature Move damage strictly within 11%-13% of opponent's maxHP
 * across all roster maxHP values (100..120): noticeably stronger than normal attacks,
 * well below the 33% Super Power cap.
 */
export function computeSignatureDamage(
  opponentMaxHp: number,
  attackerPowerMultiplier = 1,
): number {
  return Math.round(opponentMaxHp * 0.125 * attackerPowerMultiplier);
}

function spawnSpecialProjectileIfNeeded(
  state: MatchState,
  fighter: FighterState,
): void {
  const cfg = FIGHTER_CONFIGS[fighter.id];
  const opp = state.fighters[1 - fighter.slot];
  const sigDamage = computeSignatureDamage(opp.maxHp, cfg.attackPowerMultiplier ?? 1);

  if (cfg.special.id === 'currency_burst') {
    // 5 fanned 3D currency bills bursting forward with Sheru's golden aura flex!
    for (let i = 0; i < 5; i++) {
      const spread = i - 2;
      const proj: ProjectileState = {
        uid: state.nextProjectileUid++,
        ownerSlot: fighter.slot,
        kind: 'notes',
        x: fighter.x + fighter.facing * (0.7 + Math.abs(spread) * 0.12),
        y: fighter.y + 1.2 + spread * 0.16,
        vx: fighter.facing * (8.4 + (2 - Math.abs(spread)) * 0.75),
        vy: spread * 0.45,
        radius: 0.46,
        damage: sigDamage,
        stunDuration: cfg.special.stunDuration,
        knockbackX: cfg.special.knockbackX,
        knockbackY: cfg.special.knockbackY,
        life: 0,
        maxLife: 0.46,
        spin: i * 1.25,
        active: true,
      };
      state.projectiles.push(proj);
    }
  } else if (cfg.special.id === 'swatter_throw') {
    // Fast-spinning 3D cartoon fly-swatter mid-range projectile!
    const proj: ProjectileState = {
      uid: state.nextProjectileUid++,
      ownerSlot: fighter.slot,
      kind: 'swatter',
      x: fighter.x + fighter.facing * 0.85,
      y: fighter.y + 1.28,
      vx: fighter.facing * 11.2,
      vy: 0,
      radius: 0.52,
      damage: sigDamage,
      stunDuration: cfg.special.stunDuration,
      knockbackX: cfg.special.knockbackX,
      knockbackY: cfg.special.knockbackY,
      life: 0,
      maxLife: 0.7,
      spin: 0,
      active: true,
    };
    state.projectiles.push(proj);
  } else if (cfg.special.id === 'belan_throw') {
    // Fast-spinning 3D wooden rolling pin (belan) mid-range projectile!
    const proj: ProjectileState = {
      uid: state.nextProjectileUid++,
      ownerSlot: fighter.slot,
      kind: 'belan',
      x: fighter.x + fighter.facing * 0.85,
      y: fighter.y + 1.25,
      vx: fighter.facing * 10.6,
      vy: 0,
      radius: 0.5,
      damage: sigDamage,
      stunDuration: cfg.special.stunDuration,
      knockbackX: cfg.special.knockbackX,
      knockbackY: cfg.special.knockbackY,
      life: 0,
      maxLife: 0.72,
      spin: 0,
      active: true,
    };
    state.projectiles.push(proj);
  } else if (cfg.special.id === 'diary_note') {
    // Fast-spinning 3D red-stamped School Diary / Warning Slip mid-range projectile!
    const proj: ProjectileState = {
      uid: state.nextProjectileUid++,
      ownerSlot: fighter.slot,
      kind: 'diary',
      x: fighter.x + fighter.facing * 0.85,
      y: fighter.y + 1.32,
      vx: fighter.facing * 11.4,
      vy: 0,
      radius: 0.48,
      damage: sigDamage,
      stunDuration: cfg.special.stunDuration,
      knockbackX: cfg.special.knockbackX,
      knockbackY: cfg.special.knockbackY,
      life: 0,
      maxLife: 0.72,
      spin: 0,
      active: true,
    };
    state.projectiles.push(proj);
  } else if (cfg.special.id === 'laxmikant_slam') {
    // Fast-spinning heavy red 3D Indian Polity (Laxmikanth) textbook projectile!
    const proj: ProjectileState = {
      uid: state.nextProjectileUid++,
      ownerSlot: fighter.slot,
      kind: 'polity',
      x: fighter.x + fighter.facing * 0.88,
      y: fighter.y + 1.32,
      vx: fighter.facing * 11.2,
      vy: 0,
      radius: 0.5,
      damage: sigDamage,
      stunDuration: cfg.special.stunDuration,
      knockbackX: cfg.special.knockbackX,
      knockbackY: cfg.special.knockbackY,
      life: 0,
      maxLife: 0.72,
      spin: 0,
      active: true,
    };
    state.projectiles.push(proj);
  }
}

export function stepMatch(
  state: MatchState,
  inputs: [FighterInput, FighterInput],
  rawDt: number,
): CombatEvent[] {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const events: CombatEvent[] = [];

  // Decay visual timers even during hitstop
  for (const f of state.fighters) {
    if (f.hitFlashTimer > 0) f.hitFlashTimer = Math.max(0, f.hitFlashTimer - dt);
    f.squashX += (1 - f.squashX) * Math.min(1, dt * 14);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 14);
  }

  if (state.phase === 'finished') {
    return events;
  }

  if (state.phase === 'intro') {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = 'fighting';
      state.phaseTimer = 0;
    }
    return events;
  }

  if (state.phase === 'ko_freeze') {
    // Sub-phase 1: Dramatic 0.25x slow-motion KO impact while defeated fighter crashes onto floor
    // Sub-phase 2: Winner raised-arms celebration pose + gentle zoom-in before next round / Victory screen
    const physDt = state.koSubPhase === 'impact_slowmo' ? dt * 0.25 : dt;
    for (const f of state.fighters) {
      const wasAir = f.y > GROUND_Y + 0.02;
      if (f.y > GROUND_Y || f.vy !== 0) {
        f.vy += GRAVITY * physDt;
        f.y += f.vy * physDt;
        f.x += f.vx * physDt;
        if (f.y <= GROUND_Y) {
          f.y = GROUND_Y;
          f.vy = 0;
          f.vx *= 0.28;
          if (wasAir && f.action === 'ko') {
            events.push({
              type: 'knockdown_land',
              attackerSlot: f.slot,
              x: f.x,
              y: 0.08,
              damage: 0,
            });
          }
        }
      } else {
        f.vx *= Math.max(0, 1 - physDt * 8);
        f.x += f.vx * physDt;
      }
      f.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, f.x));
    }

    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      if (state.koSubPhase === 'impact_slowmo') {
        // Transition to Winner Celebration!
        state.koSubPhase = 'winner_celebration';
        state.phaseTimer = KO_CELEBRATION_DURATION;
        for (const f of state.fighters) {
          if (state.roundWinnerSlot === f.slot) {
            f.action = 'victory';
            f.expression = 'victory';
            f.vx = 0;
            f.vy = 0;
            f.y = GROUND_Y;
          } else if (state.roundWinnerSlot !== 'draw') {
            f.action = 'ko';
            f.expression = 'ko';
            f.y = GROUND_Y;
            f.vx = 0;
            f.vy = 0;
          }
        }
      } else if (state.winnerSlot !== null) {
        state.phase = 'finished';
        state.koSubPhase = 'none';
        for (const f of state.fighters) {
          if (state.winnerSlot === f.slot) {
            f.action = 'victory';
            f.expression = 'victory';
          } else if (state.winnerSlot !== 'draw') {
            f.action = 'ko';
            f.expression = 'ko';
            f.y = GROUND_Y;
            f.vx = 0;
            f.vy = 0;
          }
        }
      } else {
        // Start next round in Best-of-3 match
        state.roundNumber += 1;
        state.roundTime = ROUND_DURATION_SECONDS;
        state.roundWinnerSlot = null;
        state.finishReason = null;
        state.koSubPhase = 'none';
        state.projectiles = [];
        state.hitstopTimer = 0;
        state.sheruSuper = null;
        state.sheruSuperSignals = [];
        state.billaSuper = null;
        state.billaSuperSignals = [];
        state.netaSuper = null;
        state.netaSuperSignals = [];
        state.andaSuper = null;
        state.andaSuperSignals = [];
        state.mausiSuper = null;
        state.mausiSuperSignals = [];
        state.fatherSuper = null;
        state.fatherSuperSignals = [];
        state.samyakSuper = null;
        state.samyakSuperSignals = [];
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
        resetFighterForNextRound(state.fighters[0]);
        resetFighterForNextRound(state.fighters[1]);
        state.phase = 'intro';
        state.introDuration = NEXT_ROUND_INTRO_DURATION;
        state.phaseTimer = NEXT_ROUND_INTRO_DURATION;
      }
    }
    return events;
  }

  // Clear per-tick choreographed Super beat signals
  state.sheruSuperSignals = [];
  state.billaSuperSignals = [];
  state.netaSuperSignals = [];
  state.andaSuperSignals = [];
  state.mausiSuperSignals = [];
  state.fatherSuperSignals = [];
  state.samyakSuperSignals = [];

  // Hit-stop freezes simulation physics while camera shake / flashes still tick
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return events;
  }

  // Choreographed 7.5s Sheru Bhai Super sequence locks both fighters & pauses round clock
  if (state.sheruSuper) {
    if (state.sheruSuper.active) {
      state.sheruSuperSignals = stepSheruSuper(state, state.sheruSuper, dt, events);
      state.activeSuperSlot = state.sheruSuper.attackerSlot;
      state.activeSuperElapsed = state.sheruSuper.elapsed;
      state.activeSuperDuration = state.sheruSuper.duration;
      if (!state.sheruSuper.active) {
        state.sheruSuper = null;
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
      }
      return events;
    }
    state.sheruSuper = null;
  }

  // Choreographed 4.5s Blue Billa "CHIRKUT CHAOS" Super sequence locks both fighters & pauses round clock
  if (state.billaSuper) {
    if (state.billaSuper.active) {
      state.billaSuperSignals = stepBillaSuper(state, state.billaSuper, dt, events);
      state.activeSuperSlot = state.billaSuper.attackerSlot;
      state.activeSuperElapsed = state.billaSuper.elapsed;
      state.activeSuperDuration = state.billaSuper.duration;
      if (!state.billaSuper.active) {
        state.billaSuper = null;
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
      }
      return events;
    }
    state.billaSuper = null;
  }

  // Choreographed 4.8s Garib Sena Neta "VANS, ATTACK!" Super sequence locks both fighters & pauses round clock
  if (state.netaSuper) {
    if (state.netaSuper.active) {
      state.netaSuperSignals = stepNetaSuper(state, state.netaSuper, dt, events);
      state.activeSuperSlot = state.netaSuper.attackerSlot;
      state.activeSuperElapsed = state.netaSuper.elapsed;
      state.activeSuperDuration = state.netaSuper.duration;
      if (!state.netaSuper.active) {
        state.netaSuper = null;
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
      }
      return events;
    }
    state.netaSuper = null;
  }

  // Choreographed 4.5s Anda Bhai "THE GREAT WALL DROP!" Super sequence locks both fighters & pauses round clock
  if (state.andaSuper) {
    if (state.andaSuper.active) {
      state.andaSuperSignals = stepAndaSuper(state, state.andaSuper, dt, events);
      state.activeSuperSlot = state.andaSuper.attackerSlot;
      state.activeSuperElapsed = state.andaSuper.elapsed;
      state.activeSuperDuration = state.andaSuper.duration;
      if (!state.andaSuper.active) {
        state.andaSuper = null;
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
      }
      return events;
    }
    state.andaSuper = null;
  }

  // Choreographed 5.0s Laddoo Mausi "GOL-GOL LADDOO BARRAGE!" Super sequence locks both fighters & pauses round clock
  if (state.mausiSuper) {
    if (state.mausiSuper.active) {
      state.mausiSuperSignals = stepMausiSuper(state, state.mausiSuper, dt, events);
      state.activeSuperSlot = state.mausiSuper.attackerSlot;
      state.activeSuperElapsed = state.mausiSuper.elapsed;
      state.activeSuperDuration = state.mausiSuper.duration;
      if (!state.mausiSuper.active) {
        state.mausiSuper = null;
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
      }
      return events;
    }
    state.mausiSuper = null;
  }

  // Choreographed 5.2s Principal Man "RUSTICATION ORDER!" Super sequence locks both fighters & pauses round clock
  if (state.fatherSuper) {
    if (state.fatherSuper.active) {
      state.fatherSuperSignals = stepFatherSuper(state, state.fatherSuper, dt, events);
      state.activeSuperSlot = state.fatherSuper.attackerSlot;
      state.activeSuperElapsed = state.fatherSuper.elapsed;
      state.activeSuperDuration = state.fatherSuper.duration;
      if (!state.fatherSuper.active) {
        state.fatherSuper = null;
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
      }
      return events;
    }
    state.fatherSuper = null;
  }

  // Choreographed 4.8s Samyak "MISSION IAS: BEAST MODE!" Super sequence locks both fighters & pauses round clock
  if (state.samyakSuper) {
    if (state.samyakSuper.active) {
      state.samyakSuperSignals = stepSamyakSuper(state, state.samyakSuper, dt, events);
      state.activeSuperSlot = state.samyakSuper.attackerSlot;
      state.activeSuperElapsed = state.samyakSuper.elapsed;
      state.activeSuperDuration = state.samyakSuper.duration;
      if (!state.samyakSuper.active) {
        state.samyakSuper = null;
        state.activeSuperSlot = null;
        state.activeSuperElapsed = 0;
        state.activeSuperDuration = 0;
      }
      return events;
    }
    state.samyakSuper = null;
  }

  // Track active non-Sheru Super cutscene timer
  if (state.activeSuperSlot !== null) {
    const caster = state.fighters[state.activeSuperSlot];
    if (caster.action === 'super') {
      state.activeSuperElapsed = caster.actionTimer;
      state.activeSuperDuration = caster.actionDuration;
    } else {
      state.activeSuperSlot = null;
      state.activeSuperElapsed = 0;
      state.activeSuperDuration = 0;
    }
  }

  // Update Round Timer
  state.roundTime = Math.max(0, state.roundTime - dt);

  const [p1, p2] = state.fighters;

  // Update each fighter's timers, input buffers, movement, and actions
  for (let i = 0; i < 2; i++) {
    const f = state.fighters[i];
    const opp = state.fighters[1 - i];
    const input = inputs[i];
    const cfg = FIGHTER_CONFIGS[f.id];

    if (f.specialCooldown > 0) f.specialCooldown = Math.max(0, f.specialCooldown - dt);
    if (f.dharnaShieldTimer > 0) f.dharnaShieldTimer = Math.max(0, f.dharnaShieldTimer - dt);
    if (f.squashHoldTimer > 0) f.squashHoldTimer = Math.max(0, f.squashHoldTimer - dt);
    if (f.squashedTimer > 0) {
      f.squashedTimer = Math.max(0, f.squashedTimer - dt);
      f.squashX = 1.48;
      f.squashY = 0.36;
    }
    if (f.invulnTimer > 0) f.invulnTimer = Math.max(0, f.invulnTimer - dt);
    if (f.comboTimer > 0) {
      f.comboTimer -= dt;
      if (f.comboTimer <= 0) f.comboCount = 0;
    }
    if (f.comboChainTimer > 0) {
      f.comboChainTimer = Math.max(0, f.comboChainTimer - dt);
      if (f.comboChainTimer <= 0 && !isBusyAttacking(f.action)) {
        f.comboStep = 0;
      }
    }

    // Buffer one-shot actions (140ms window for crisp arcade chaining)
    if (input.superMove && f.shakti >= 100) {
      f.bufferedAction = 'super';
      f.bufferTimer = 0.14;
    } else if (input.special && f.specialCooldown <= 0) {
      f.bufferedAction = 'special';
      f.bufferTimer = 0.14;
    } else if (input.grab) {
      f.bufferedAction = 'grab';
      f.bufferTimer = 0.14;
    } else if (input.kick) {
      f.bufferedAction = input.down ? 'sweep' : 'kick';
      f.bufferTimer = 0.14;
    } else if (input.punch) {
      f.bufferedAction = 'punch';
      f.bufferTimer = 0.14;
    } else if (input.up) {
      f.bufferedAction = 'jump';
      f.bufferTimer = 0.14;
    } else if (f.bufferTimer > 0) {
      f.bufferTimer -= dt;
      if (f.bufferTimer <= 0) f.bufferedAction = null;
    }

    // Auto-face opponent when idle/walking/crouching/blocking on ground
    if (
      f.y <= GROUND_Y + 0.02 &&
      f.hitstunTimer <= 0 &&
      !isBusyAttacking(f.action) &&
      !isIncapacitated(f.action) &&
      Math.abs(opp.x - f.x) > 0.15
    ) {
      f.facing = opp.x >= f.x ? 1 : -1;
    }

    // State Machine: Grabbed / Knockdown / Get-up / Hitstun / Blockstun / Attacking / Free
    if (f.action === 'grabbed') {
      // Position driven by grabber's grab_hold state; safety timeout if grabber is interrupted
      f.actionTimer += dt;
      if (opp.action !== 'grab_hold' && f.actionTimer > 0.05) {
        f.action = f.y > GROUND_Y + 0.02 ? 'jump' : 'idle';
        f.expression = 'idle';
      }
    } else if (f.action === 'knockdown') {
      f.actionTimer += dt;
      if (f.y <= GROUND_Y + 0.02 && f.vy <= 0) {
        // Lying flat on back on arena floor for ~0.8s (invulnerable to infinite ground juggle)
        f.vx *= Math.max(0, 1 - dt * 11);
        f.invulnTimer = Math.max(f.invulnTimer, 0.08);
        f.knockdownTimer -= dt;
        if (f.knockdownTimer <= 0) {
          f.action = 'getup';
          f.actionTimer = 0;
          f.actionDuration = GETUP_DURATION;
          f.invulnTimer = WAKEUP_INVULN_DURATION;
          f.vx = 0;
          f.expression = 'idle';
        }
      }
    } else if (f.action === 'getup') {
      f.actionTimer += dt;
      f.vx = 0;
      if (f.actionTimer >= f.actionDuration) {
        f.action = 'idle';
        f.actionTimer = 0;
        f.expression = 'idle';
      }
    } else if (f.hitstunTimer > 0) {
      f.hitstunTimer -= dt;
      f.vx *= Math.max(0, 1 - dt * 5.5);
      if (f.hitstunTimer <= 0 && f.hp > 0) {
        f.action = f.y > GROUND_Y + 0.02 ? 'jump' : 'idle';
        f.expression = 'idle';
      }
    } else if (f.blockstunTimer > 0) {
      f.blockstunTimer -= dt;
      f.vx *= Math.max(0, 1 - dt * 9);
      if (f.blockstunTimer <= 0) {
        f.action = 'idle';
        f.expression = 'idle';
      }
    } else if (isBusyAttacking(f.action)) {
      const prevTime = f.actionTimer;
      f.actionTimer += dt;
      const timing = getAttackTiming(f);

      // Slow horizontal momentum during grounded attacks (except Anda Squash hop / Super lunge)
      const isAndaSquash = f.action === 'special' && cfg.special.id === 'anda_squash';
      if (f.action === 'super' && f.id !== 'sheru') {
        // Non-Sheru Super: hold dramatic pose during startup close-up, then lunge forward at windup!
        if (prevTime < timing.windup && f.actionTimer >= timing.windup) {
          f.vx = f.facing * 9.5;
        } else if (f.actionTimer > timing.windup + timing.active) {
          f.vx *= Math.max(0, 1 - dt * 8);
        }
      } else if (isAndaSquash) {
        if (f.y <= GROUND_Y + 0.04) {
          f.vx *= Math.max(0, 1 - dt * 16);
        }
      } else if (f.action !== 'super') {
        f.vx *= Math.max(0, 1 - dt * 10);
      }

      // Garib Sena Neta DHARNA SHIELD sonic pushback wave burst at peak pulse (~0.42s)
      if (
        f.action === 'special' &&
        cfg.special.id === 'dharna_shield' &&
        !f.dharnaWaveFired &&
        f.actionTimer >= 0.42
      ) {
        f.dharnaWaveFired = true;
        events.push({
          type: 'dharna_counter',
          attackerSlot: f.slot,
          x: f.x,
          y: f.y + 1.0,
          damage: 0,
          word: 'DHARNA WAVE!',
          moveCallout: 'DHARNA SHIELD!',
          color: '#FB923C',
        });
        const waveDist = Math.abs(opp.x - f.x);
        if (waveDist <= cfg.special.range && Math.abs(opp.y - f.y) <= 1.8) {
          applyHit(
            state,
            f,
            opp,
            inputs[1 - i],
            {
              damage: computeSignatureDamage(opp.maxHp),
              knockbackX: cfg.special.knockbackX,
              knockbackY: cfg.special.knockbackY,
              hitstop: 0.05,
              stun: cfg.special.stunDuration,
              isHeavy: true,
              isGrab: false,
              isSpecial: true,
              isSuper: false,
              causesKnockdown: false,
              moveCallout: 'DHARNA SHIELD!',
              hitX: (f.x + opp.x) * 0.5,
              hitY: opp.y + 1.15,
            },
            events,
          );
        }
      }

      // Active close-range Grab Hold & Throw choreography
      if (f.action === 'grab_hold') {
        f.vx = 0;
        const holdProgress = Math.min(1, f.actionTimer / Math.max(0.05, timing.windup));
        if (!f.hasHitCurrentAttack && opp.action === 'grabbed') {
          // 180° Kung-Fu Hip-Throw arc: hoist opponent off the ground across attacker's hip/shoulder!
          opp.x = Math.max(
            ARENA_MIN_X,
            Math.min(ARENA_MAX_X, f.x + f.facing * (0.72 - holdProgress * 0.95)),
          );
          opp.y = 0.25 + Math.sin(holdProgress * Math.PI) * 0.92;
          opp.vx = 0;
          opp.vy = 0;
        }
        if (f.actionTimer >= timing.windup && !f.hasHitCurrentAttack) {
          f.hasHitCurrentAttack = true;
          f.grabTargetSlot = null;
          opp.invulnTimer = 0;
          opp.action = 'hit';
          applyHit(
            state,
            f,
            opp,
            inputs[1 - i],
            {
              damage: timing.damage,
              knockbackX: timing.knockbackX,
              knockbackY: timing.knockbackY,
              hitstop: timing.hitstop,
              stun: timing.stun,
              isHeavy: true,
              isGrab: true,
              isSpecial: false,
              isSuper: false,
              causesKnockdown: true,
              moveCallout: timing.moveCallout,
              hitX: (f.x + opp.x) * 0.5,
              hitY: opp.y + 1.15,
            },
            events,
          );
        }
      } else {
        // Trigger projectile at start of active window (Paisa Flex, Swatter Throw, Belan Throw, Diary Note, Laxmikant Slam)
        if (
          f.action === 'special' &&
          (cfg.special.id === 'currency_burst' ||
            cfg.special.id === 'swatter_throw' ||
            cfg.special.id === 'belan_throw' ||
            cfg.special.id === 'diary_note' ||
            cfg.special.id === 'laxmikant_slam') &&
          prevTime < timing.windup &&
          f.actionTimer >= timing.windup
        ) {
          spawnSpecialProjectileIfNeeded(state, f);
          f.hasHitCurrentAttack = true; // Damage is delivered via projectile(s)
        }

        // Check melee active hitbox window
        const inActiveWindow =
          f.actionTimer >= timing.windup &&
          f.actionTimer <= timing.windup + timing.active;

        const isDharnaOnly = f.action === 'special' && cfg.special.id === 'dharna_shield';

        if (inActiveWindow && !f.hasHitCurrentAttack && !isDharnaOnly) {
          const dx = (opp.x - f.x) * f.facing;
          const dy = Math.abs(opp.y - f.y);
          const withinRange = isAndaSquash
            ? Math.abs(opp.x - f.x) <= timing.range && dy <= 1.95 && f.vy <= 1.2
            : dx >= -0.4 && dx <= timing.range && dy <= 1.35;

          if (withinRange) {
            if (f.action === 'grab') {
              // Close-range Grab breaks guard & locks onto opponent for lift-and-throw knockdown!
              if (opp.invulnTimer <= 0 && !isIncapacitated(opp.action) && opp.hp > 0) {
                f.action = 'grab_hold';
                f.actionTimer = 0;
                f.actionDuration = 0.5;
                f.hasHitCurrentAttack = false;
                f.grabTargetSlot = opp.slot;
                f.vx = 0;

                opp.action = 'grabbed';
                opp.actionTimer = 0;
                opp.actionDuration = 0.5;
                opp.hitstunTimer = 0;
                opp.blockstunTimer = 0;
                opp.dharnaShieldTimer = 0;
                opp.vx = 0;
                opp.vy = 0;
                opp.expression = 'hit';

                events.push({
                  type: 'grab',
                  attackerSlot: f.slot,
                  x: (f.x + opp.x) * 0.5,
                  y: Math.max(f.y, opp.y) + 1.25,
                  damage: 0,
                  word: 'PAKDA!',
                  color: '#4ADE80',
                });
              }
            } else {
              f.hasHitCurrentAttack = true;
              const contactX = f.x + (opp.x - f.x) * 0.62;
              const baseY = Math.max(f.y, opp.y);
              const contactY =
                f.action === 'sweep'
                  ? baseY + 0.34
                  : f.action === 'punch' && f.comboStep === 2
                    ? baseY + 1.62
                    : f.action === 'kick' && f.comboStep === 2
                      ? baseY + 1.56
                      : f.action === 'kick' && f.comboStep === 1
                        ? baseY + 1.5
                        : f.action === 'kick'
                          ? baseY + 1.48
                          : baseY + 1.42;
              applyHit(
                state,
                f,
                opp,
                inputs[1 - i],
                {
                  damage: timing.isSuper
                    ? computeTotalSuperDamage(opp.maxHp)
                    : timing.isSpecial
                      ? computeSignatureDamage(opp.maxHp)
                      : timing.damage,
                  knockbackX: isAndaSquash ? 1.6 : timing.knockbackX,
                  knockbackY: isAndaSquash ? 0 : timing.knockbackY,
                  hitstop: timing.hitstop,
                  stun: isAndaSquash ? 0.52 : timing.stun,
                  isHeavy: timing.isHeavy,
                  isGrab: false,
                  isSpecial: timing.isSpecial,
                  isSuper: timing.isSuper,
                  causesKnockdown: timing.causesKnockdown,
                  moveCallout: timing.moveCallout,
                  hitX: contactX,
                  hitY: isAndaSquash ? GROUND_Y + 0.55 : contactY,
                },
                events,
              );
              if (isAndaSquash && opp.hp > 0 && opp.action === 'hit') {
                // Comedic flat-squash beat: Anda flops right on top of the flattened opponent!
                f.x = opp.x;
                f.vx = 0;
                f.y = GROUND_Y;
                f.vy = 0;
                f.squashHoldTimer = 0.42;
                opp.vx = 0;
                opp.vy = 0;
                opp.y = GROUND_Y;
                opp.squashedTimer = 0.44;
                opp.squashX = 1.52;
                opp.squashY = 0.34;
                events.push({
                  type: 'land',
                  attackerSlot: f.slot,
                  x: f.x,
                  y: 0.15,
                  damage: 0,
                  word: 'SQUASH!',
                  color: '#FFD426',
                });
              }
            }
          }
        }

        // Crisp 3-hit Punch/Kick combo cancel window (Jab -> Cross -> Heavy Finisher!)
        const canComboCancel =
          (f.action === 'punch' || f.action === 'kick') &&
          f.comboStep < 2 &&
          f.actionTimer >= timing.windup + timing.active * 0.55 &&
          (f.bufferedAction === 'punch' || f.bufferedAction === 'kick');

        if (canComboCancel && f.bufferedAction) {
          const nextMove = f.bufferedAction as 'punch' | 'kick';
          const nextStep = (f.comboStep + 1) as 0 | 1 | 2;
          f.bufferedAction = null;
          f.bufferTimer = 0;
          startAction(state, f, nextMove, events, nextStep);
          continue;
        }
      }

      if (f.actionTimer >= f.actionDuration) {
        if (f.action === 'super' && state.activeSuperSlot === f.slot) {
          state.activeSuperSlot = null;
          state.activeSuperElapsed = 0;
          state.activeSuperDuration = 0;
        }
        f.action = f.y > GROUND_Y + 0.02 ? 'jump' : 'idle';
        f.actionTimer = 0;
        f.grabTargetSlot = null;
        f.expression = 'idle';
      }
    } else {
      // Free to move or start an action
      const grounded = f.y <= GROUND_Y + 0.02;

      if (f.bufferedAction && f.bufferedAction !== 'jump') {
        const chosen = f.bufferedAction;
        f.bufferedAction = null;
        f.bufferTimer = 0;
        if (chosen === 'super' && f.shakti >= 100) {
          startAction(state, f, 'super', events);
        } else if (chosen === 'special' && f.specialCooldown <= 0) {
          startAction(state, f, 'special', events);
        } else if (chosen === 'grab' && grounded) {
          startAction(state, f, 'grab', events);
        } else if (chosen === 'sweep' && grounded) {
          startAction(state, f, 'sweep', events);
        } else if (chosen === 'kick') {
          startAction(state, f, 'kick', events);
        } else if (chosen === 'punch') {
          startAction(state, f, 'punch', events);
        }
      } else if (f.bufferedAction === 'jump' && grounded) {
        f.bufferedAction = null;
        f.bufferTimer = 0;
        f.vy = cfg.jumpVelocity;
        f.y = 0.03;
        f.action = 'jump';
        f.squashX = 0.85;
        f.squashY = 1.18;
        events.push({
          type: 'jump',
          attackerSlot: f.slot,
          x: f.x,
          y: f.y,
          damage: 0,
        });
      } else if (grounded) {
        if (input.down) {
          f.vx = 0;
          f.action = 'crouch';
          f.expression = 'idle';
        } else if (input.left && !input.right) {
          f.vx = -cfg.walkSpeed;
          const oppAttacking = isBusyAttacking(opp.action) || state.projectiles.some((p) => p.ownerSlot !== f.slot);
          if (isHoldingBack(f, input) && oppAttacking) {
            f.action = 'block';
            f.expression = 'block';
            f.vx *= 0.45;
          } else {
            f.action = 'walk';
            f.expression = 'idle';
          }
        } else if (input.right && !input.left) {
          f.vx = cfg.walkSpeed;
          const oppAttacking = isBusyAttacking(opp.action) || state.projectiles.some((p) => p.ownerSlot !== f.slot);
          if (isHoldingBack(f, input) && oppAttacking) {
            f.action = 'block';
            f.expression = 'block';
            f.vx *= 0.45;
          } else {
            f.action = 'walk';
            f.expression = 'idle';
          }
        } else {
          f.vx = 0;
          f.action = 'idle';
          f.expression = 'idle';
        }
      } else {
        // Air steering (subtle)
        if (input.left && !input.right) f.vx = Math.max(-cfg.walkSpeed * 0.9, f.vx - dt * 10);
        if (input.right && !input.left) f.vx = Math.min(cfg.walkSpeed * 0.9, f.vx + dt * 10);
      }
    }

    // Integrate physics (skip gravity for currently grabbed fighter held in mid-air)
    const wasAirborne = f.y > GROUND_Y + 0.02;
    if (f.action !== 'grabbed') {
      if (f.y > GROUND_Y || f.vy > 0) {
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
      }
      const prevX = f.x;
      f.x += f.vx * dt;
      f.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, f.x));

      // Distance-synced walk cycle (no skating!)
      if (f.y <= GROUND_Y + 0.02 && !isIncapacitated(f.action)) {
        f.walkCycle += Math.abs(f.x - prevX) * 4.2;
      }

      if (f.y <= GROUND_Y) {
        f.y = GROUND_Y;
        if (wasAirborne) {
          if (f.action === 'knockdown') {
            // Slammed flat onto the arena floor -> dust puff & micro-shake!
            f.vx *= 0.25;
            f.squashX = 1.32;
            f.squashY = 0.72;
            events.push({
              type: 'knockdown_land',
              attackerSlot: f.slot,
              x: f.x,
              y: 0.08,
              damage: 0,
            });
          } else {
            const isAndaSquashLand = f.id === 'anda' && f.action === 'special';
            f.squashX = isAndaSquashLand ? 1.38 : 1.22;
            f.squashY = isAndaSquashLand ? 0.66 : 0.78;
            if (isAndaSquashLand && f.squashHoldTimer <= 0) {
              f.squashHoldTimer = 0.36;
              f.vx = 0;
            }
            events.push({
              type: 'land',
              attackerSlot: f.slot,
              x: f.x,
              y: 0,
              damage: 0,
              word: isAndaSquashLand ? 'SQUASH!' : undefined,
              color: isAndaSquashLand ? '#FFD426' : undefined,
            });
            if (f.action === 'jump') {
              f.action = 'idle';
            }
          }
        }
        f.vy = 0;
      }
    }
  }

  // Pushbox separation (skip while locked in close-range grab hold or Anda Squash comedic beat)
  const inGrab =
    p1.action === 'grab_hold' ||
    p2.action === 'grab_hold' ||
    p1.squashHoldTimer > 0 ||
    p2.squashHoldTimer > 0;
  const dist = p2.x - p1.x;
  const absDist = Math.abs(dist);
  const yOverlap = Math.abs(p2.y - p1.y) < 1.25;
  if (!inGrab && absDist < MIN_FIGHTER_SEPARATION && yOverlap) {
    const push = (MIN_FIGHTER_SEPARATION - absDist) * 0.5;
    const sign = dist >= 0 ? 1 : -1;
    p1.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, p1.x - sign * push));
    p2.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, p2.x + sign * push));
  }

  // Update projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.life += dt;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.spin += dt * (proj.kind === 'swatter' ? 20 : 16);

    const attacker = state.fighters[proj.ownerSlot];
    const defender = state.fighters[1 - proj.ownerSlot];
    const defInput = inputs[1 - proj.ownerSlot];

    const dx = Math.abs(proj.x - defender.x);
    const dy = Math.abs(proj.y - (defender.y + (defender.action === 'crouch' ? 0.65 : 1.05)));

    if (proj.damage > 0 && dx <= proj.radius + 0.55 && dy <= proj.radius + 0.72) {
      const moveCallout =
        proj.kind === 'notes'
          ? 'PAISA FLEX!'
          : proj.kind === 'swatter'
            ? 'SWATTER THROW!'
            : proj.kind === 'belan'
              ? 'BELAN THROW!'
              : proj.kind === 'diary'
                ? 'DIARY NOTE!'
                : proj.kind === 'polity'
                  ? 'LAXMIKANT SLAM!'
                  : undefined;
      applyHit(
        state,
        attacker,
        defender,
        defInput,
        {
          damage: proj.damage,
          knockbackX: proj.knockbackX,
          knockbackY: proj.knockbackY,
          hitstop: 0.048,
          stun: proj.stunDuration,
          isHeavy: true,
          isGrab: false,
          isSpecial: true,
          isSuper: false,
          isProjectile: true,
          moveCallout,
          hitX: proj.x,
          hitY: proj.y,
        },
        events,
      );
      proj.active = false;
      // Prevent multi-bill Paisa Flex fan from double-dipping above the 11%-13% Signature damage tier,
      // while letting the remaining 3D bills flutter visibly past the target with 0 damage.
      if (proj.kind === 'notes') {
        for (const other of state.projectiles) {
          if (other.ownerSlot === proj.ownerSlot && other.kind === 'notes') {
            other.damage = 0;
          }
        }
      }
    }

    if (!proj.active || proj.life >= proj.maxLife || proj.x < ARENA_MIN_X - 1.5 || proj.x > ARENA_MAX_X + 1.5) {
      state.projectiles.splice(i, 1);
    }
  }

  // Check KO or Timeout
  if (p1.hp <= 0 || p2.hp <= 0) {
    const roundWinner: 0 | 1 | 'draw' =
      p1.hp <= 0 && p2.hp <= 0 ? 'draw' : p2.hp <= 0 ? 0 : 1;
    resolveRoundEnd(state, roundWinner, 'ko');
  } else if (state.roundTime <= 0) {
    const p1Ratio = p1.hp / p1.maxHp;
    const p2Ratio = p2.hp / p2.maxHp;
    const roundWinner: 0 | 1 | 'draw' =
      Math.abs(p1Ratio - p2Ratio) < 0.001 ? 'draw' : p1Ratio > p2Ratio ? 0 : 1;
    resolveRoundEnd(state, roundWinner, 'timeout');
  }

  return events;
}

export function computeCpuInput(
  state: MatchState,
  difficulty: Difficulty,
  dt: number,
  rng: () => number = Math.random,
): FighterInput {
  const input = createEmptyInput();
  if (state.phase !== 'fighting') return input;

  const cpu = state.fighters[1];
  const player = state.fighters[0];
  const dist = Math.abs(player.x - cpu.x);
  const playerRightOfCpu = player.x > cpu.x;

  // Difficulty knobs
  const params =
    difficulty === 'easy'
      ? {
          thinkMin: 0.34,
          thinkMax: 0.56,
          blockChance: 0.22,
          attackChance: 0.42,
          specialChance: 0.22,
          grabChance: 0.1,
          superChance: 0.5,
        }
      : difficulty === 'normal'
        ? {
            thinkMin: 0.2,
            thinkMax: 0.34,
            blockChance: 0.48,
            attackChance: 0.65,
            specialChance: 0.38,
            grabChance: 0.22,
            superChance: 0.8,
          }
        : {
            thinkMin: 0.1,
            thinkMax: 0.18,
            blockChance: 0.74,
            attackChance: 0.84,
            specialChance: 0.54,
            grabChance: 0.32,
            superChance: 0.95,
          };

  state.aiThinkTimer -= dt;
  state.aiIntentTimer -= dt;

  const incomingThreat =
    (isBusyAttacking(player.action) && dist < 2.9) ||
    state.projectiles.some((p) => p.ownerSlot === 0 && Math.abs(p.x - cpu.x) < 2.8);

  if (state.aiThinkTimer <= 0) {
    state.aiThinkTimer = params.thinkMin + rng() * (params.thinkMax - params.thinkMin);

    if (incomingThreat && rng() < params.blockChance) {
      // Defensive policy: block or Dharna Shield
      if (cpu.id === 'neta' && cpu.specialCooldown <= 0 && rng() < 0.65) {
        input.special = true;
      } else {
        state.aiCurrentIntent = 'block';
        state.aiIntentTimer = 0.28;
      }
    } else if (cpu.shakti >= 100 && dist < 2.8 && rng() < params.superChance) {
      input.superMove = true;
    } else if (dist > 2.65) {
      // Long-range policy: throw Belan / Swatter / Diary Note / Laxmikant Slam / Paisa Flex / Anda Squash or close gap
      const rangedSpecial =
        cpu.id === 'mausi' ||
        cpu.id === 'billa' ||
        cpu.id === 'sheru' ||
        cpu.id === 'anda' ||
        cpu.id === 'father' ||
        cpu.id === 'samyak';
      if (rangedSpecial && cpu.specialCooldown <= 0 && dist < 5.4 && rng() < params.specialChance) {
        input.special = true;
      } else if (rng() < 0.18) {
        state.aiCurrentIntent = 'jump_in';
        state.aiIntentTimer = 0.35;
        input.up = true;
      } else {
        state.aiCurrentIntent = 'approach';
        state.aiIntentTimer = 0.45;
      }
    } else if (dist <= 2.65) {
      // Close/mid combat policy
      const roll = rng();
      if (cpu.specialCooldown <= 0 && roll < params.specialChance * 0.55) {
        input.special = true;
      } else if (dist < 1.5 && roll < params.specialChance * 0.55 + params.grabChance) {
        input.grab = true;
      } else if (roll < params.attackChance) {
        if (dist < 1.7 && rng() < 0.55) {
          input.punch = true;
        } else {
          input.kick = true;
        }
      } else if (rng() < 0.35) {
        state.aiCurrentIntent = 'retreat';
        state.aiIntentTimer = 0.32;
      } else {
        state.aiCurrentIntent = 'idle';
        state.aiIntentTimer = 0.22;
      }
    }
  }

  // Apply continuous movement intent
  if (state.aiIntentTimer > 0) {
    if (state.aiCurrentIntent === 'approach' || state.aiCurrentIntent === 'jump_in') {
      if (playerRightOfCpu) input.right = true;
      else input.left = true;
    } else if (state.aiCurrentIntent === 'retreat' || state.aiCurrentIntent === 'block') {
      if (playerRightOfCpu) input.left = true;
      else input.right = true;
    }
  }

  return input;
}

const WINNER_SATIRE_HEADLINES: Record<FighterId, string[]> = {
  sheru: [
    'SHERU BHAI SWEEPS MOHALLA!',
    'BILLIONAIRE BEATDOWN SHAKES SENSEX!',
    'PAISA FLEX LANDSLIDE — OPPOSITION BANKRUPT!',
  ],
  billa: [
    'BLUE BILLA SWATTER SWEEP!',
    'TOON CAT CLEANS HOUSE WITH GIANT SWATTER!',
    'MOHALLA SHOOK AS BLUE BILLA STEALS THE SHOW!',
  ],
  neta: [
    'GARIB SENA NETA WINS BY DHARNA!',
    'JHOLA-CHAAP MANDATE STUNS PRIME-TIME PANEL!',
    'GRASSROOTS UPSET: NETA CLINCHES CHAI TROPHY!',
  ],
  anda: [
    'ANDA BHAI CRACKS THE COMPETITION!',
    'DEEWAR DROP SHATTERS ALL EXIT POLLS!',
    'UNBREAKABLE SHELL! ANDA BHAI RULES THE ARENA!',
  ],
  mausi: [
    'LADDOO MAUSI BELAN LANDSLIDE!',
    'SWEET-SHOP AUNTY FLATTENS OPPOSITION WITH BELAN!',
    'EXTRA DESI GHEE KO! MAUSI OWNS THE MOHALLA!',
  ],
  father: [
    'PRINCIPAL MAN RUSTICATES THE COMPETITION!',
    'STRICT PRINCIPAL ENFORCES PIN-DROP SILENCE IN ASSEMBLY!',
    'RED DIARY NOTE DELIVERED — OPPOSITION SENT TO DETENTION!',
  ],
  samyak: [
    'SAMYAK CRACKS OPPONENT IN FIRST ATTEMPT!',
    'AIR 1 BEAST MODE: SAMYAK BENCH-PRESSES THE ENTIRE ROSTER!',
    'POLITY BY MORNING, DEADLIFTS BY NIGHT — SAMYAK SWEEPS MOHALLA!',
  ],
};

const LOSER_CAMP_QUOTES: Record<FighterId, string[]> = {
  sheru: [
    '"This was clearly a hostile market correction, not a defeat!" — Sheru Bhai PR Desk',
    '"Our accountants are auditing that last combo immediately." — Team Sheru',
  ],
  billa: [
    '"The cockroaches tampered with my flyswatter grip!" — Blue Billa Spokesperson',
    '"Wait till I finish my fish curry, then we rematch!" — Blue Billa Camp',
  ],
  neta: [
    '"We demand an immediate recount and a fresh cup of cutting chai!" — Garib Sena Office',
    '"The stage floor was clearly biased against the common man!" — Neta Ji Camp',
  ],
  anda: [
    '"Minor hairline fracture only! I will bounce right back!" — Anda Bhai Medical Bulletin',
    '"Somebody greased the arena tiles — blatant foul play!" — Team Anda',
  ],
  mausi: [
    '"My belan slipped only because the laddoo batch was still on the stove!" — Mausi Sweet Mart',
    '"Wait until I bring the heavy iron tawa next round!" — Laddoo Mausi Camp',
  ],
  father: [
    '"The assembly bell rang early — report to my office at 8 AM sharp!" — Principal Man Office',
    '"Unacceptable indiscipline! Bring a signed diary note tomorrow." — Principal Man',
  ],
  samyak: [
    '"That was just my Prelims warm-up — wait for Mains and Interview!" — Samyak Study Circle',
    '"Forgot my pre-workout shake today, rematch after leg day!" — Team Samyak',
  ],
};

export function buildMatchResultSnapshot(
  state: MatchState,
  stageId: StageId,
  difficulty: Difficulty,
  seed: number = Date.now(),
): MatchResultSnapshot {
  const p1 = state.fighters[0];
  const p2 = state.fighters[1];
  const p1Cfg = FIGHTER_CONFIGS[p1.id];
  const p2Cfg = FIGHTER_CONFIGS[p2.id];
  const stageCfg = STAGE_CONFIGS[stageId];
  const winnerSlot = state.winnerSlot ?? 'draw';

  let headline: string;
  let subheadline: string;
  let reportParagraph: string;
  let stampText: string;
  let scoreSummary: string;
  let loserQuote: string;

  const finishReason = state.finishReason ?? 'ko';
  const winCfg = winnerSlot === 1 ? p2Cfg : p1Cfg;
  const loseCfg = winnerSlot === 1 ? p1Cfg : p2Cfg;

  const winRounds =
    winnerSlot === 0
      ? Math.max(state.p1RoundsWon, 1)
      : winnerSlot === 1
        ? Math.max(state.p2RoundsWon, 1)
        : state.p1RoundsWon;
  const loseRounds =
    winnerSlot === 0
      ? state.p2RoundsWon
      : winnerSlot === 1
        ? state.p1RoundsWon
        : state.p2RoundsWon;

  if (winnerSlot === 'draw') {
    stampText = 'DRAW!';
    headline = `HISTORIC TIE AT ${stageCfg.name.toUpperCase()}!`;
    scoreSummary = `DEADLOCK ${state.p1RoundsWon}-${state.p2RoundsWon} · Recount demanded`;
    subheadline = `Exit polls confused as ${p1Cfg.name} and ${p2Cfg.name} both claim 100% victory.`;
    loserQuote = '"Both sides have filed RTIs over the missing cutting-chai trophy." — Mohalla Bureau';
    reportParagraph = `Chaos erupted at ${stageCfg.name} after the timer hit zero with both fighters refusing to leave the stage. Local chai bhaiya has already filed a ₹420 invoice for six spilled cutting-chai glasses.`;
  } else {
    stampText = winnerSlot === 0 ? 'YOU WIN!' : 'YOU LOSE!';
    const winnerHeadlines = WINNER_SATIRE_HEADLINES[winCfg.id];
    headline = winnerHeadlines[Math.abs(Math.floor(seed)) % winnerHeadlines.length];

    scoreSummary =
      loseRounds === 0
        ? `LANDSLIDE ${winRounds}-${loseRounds} · Opposition in shock`
        : `NAIL-BITER ${winRounds}-${loseRounds} · Recount demanded`;

    const loserQuotes = LOSER_CAMP_QUOTES[loseCfg.id];
    loserQuote = loserQuotes[Math.abs(Math.floor(seed / 5)) % loserQuotes.length];

    subheadline = winCfg.victoryQuotes[Math.abs(Math.floor(seed / 3)) % winCfg.victoryQuotes.length];

    const reports = [
      `Eyewitnesses at ${stageCfg.name} confirmed ${winCfg.name} sealed the clash before the local chai bhaiya could even demand compensation for four shattered cutting-chai glasses. Meanwhile, all nine prime-time exit polls were immediately proved wrong live on air.`,
      `A passing stray cow briefly halted traffic outside ${stageCfg.name} as ${winCfg.name}'s ${winCfg.special.name} sent ${loseCfg.name} tumbling past the front row. Neighbours have demanded an instant rematch and free samosas for emotional recovery.`,
      `Following the dramatic finish at ${stageCfg.name}, ${loseCfg.name}'s spokesperson blamed studio AC drafts and weak Wi-Fi signals for the loss. ${winCfg.name} celebrated by declaring an unofficial public holiday for cutting-chai enthusiasts.`,
    ];
    reportParagraph = reports[Math.abs(Math.floor(seed / 7)) % reports.length];
  }

  return {
    winnerSlot,
    p1Id: p1.id,
    p2Id: p2.id,
    stageId,
    difficulty,
    finishReason,
    p1RoundsWon: state.p1RoundsWon,
    p2RoundsWon: state.p2RoundsWon,
    scoreSummary,
    loserQuote,
    timeRemaining: Math.ceil(state.roundTime),
    p1HpPercent: Math.round((p1.hp / p1.maxHp) * 100),
    p2HpPercent: Math.round((p2.hp / p2.maxHp) * 100),
    p1MaxCombo: p1.maxCombo,
    p1DamageDealt: Math.round(p1.damageDealt),
    p1SpecialsLanded: p1.specialsLanded,
    headline,
    subheadline,
    reportParagraph,
    stampText,
  };
}
