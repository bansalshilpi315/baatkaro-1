import { FIGHTER_CONFIGS, STAGE_CONFIGS } from './characters/configs';
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
    invulnTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    maxCombo: 0,
    damageDealt: 0,
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
    roundTime: ROUND_DURATION_SECONDS,
    hitstopTimer: 0,
    phase: skipIntro ? 'fighting' : 'intro',
    phaseTimer: skipIntro ? 0 : 2.2,
    winnerSlot: null,
    finishReason: null,
    nextProjectileUid: 1,
    aiThinkTimer: 0.25,
    aiCurrentIntent: 'idle',
    aiIntentTimer: 0.4,
  };
}

export function isHoldingBack(fighter: FighterState, input: FighterInput): boolean {
  return (fighter.facing === 1 && input.left && !input.right) ||
    (fighter.facing === -1 && input.right && !input.left);
}

function isBusyAttacking(action: FighterAction): boolean {
  return (
    action === 'punch' ||
    action === 'kick' ||
    action === 'grab' ||
    action === 'special' ||
    action === 'super'
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
} {
  const cfg = FIGHTER_CONFIGS[fighter.id];
  switch (fighter.action) {
    case 'punch':
      return {
        windup: 0.07,
        active: 0.11,
        recovery: 0.15,
        range: 1.78,
        damage: cfg.punchDamage,
        knockbackX: 3.4,
        knockbackY: 1.2,
        hitstop: 0.028,
        stun: 0.24,
        isHeavy: false,
        isGrab: false,
        isSpecial: false,
        isSuper: false,
      };
    case 'kick':
      return {
        windup: 0.12,
        active: 0.14,
        recovery: 0.22,
        range: 2.18,
        damage: cfg.kickDamage,
        knockbackX: 6.2,
        knockbackY: 3.1,
        hitstop: 0.052,
        stun: 0.34,
        isHeavy: true,
        isGrab: false,
        isSpecial: false,
        isSuper: false,
      };
    case 'grab':
      return {
        windup: 0.09,
        active: 0.12,
        recovery: 0.28,
        range: 1.58,
        damage: cfg.grabDamage,
        knockbackX: 7.4,
        knockbackY: 4.5,
        hitstop: 0.055,
        stun: 0.42,
        isHeavy: true,
        isGrab: true,
        isSpecial: false,
        isSuper: false,
      };
    case 'special': {
      const sp = cfg.special;
      return {
        windup: sp.windup,
        active: sp.active,
        recovery: sp.recovery,
        range: sp.range,
        damage: sp.damage,
        knockbackX: sp.knockbackX,
        knockbackY: sp.knockbackY,
        hitstop: 0.056,
        stun: sp.stunDuration,
        isHeavy: true,
        isGrab: false,
        isSpecial: true,
        isSuper: false,
      };
    }
    case 'super':
      return {
        windup: 0.16,
        active: 0.22,
        recovery: 0.32,
        range: 2.85,
        damage: 26,
        knockbackX: 9.8,
        knockbackY: 5.8,
        hitstop: 0.072,
        stun: 0.52,
        isHeavy: true,
        isGrab: false,
        isSpecial: false,
        isSuper: true,
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
      };
  }
}

function startAction(
  state: MatchState,
  fighter: FighterState,
  action: 'punch' | 'kick' | 'grab' | 'special' | 'super',
  events: CombatEvent[],
): void {
  const cfg = FIGHTER_CONFIGS[fighter.id];
  fighter.action = action;
  fighter.actionTimer = 0;
  fighter.hasHitCurrentAttack = false;
  fighter.expression = 'attack';
  const timing = getAttackTiming(fighter);
  fighter.actionDuration = timing.windup + timing.active + timing.recovery;

  if (action === 'special') {
    fighter.specialCooldown = cfg.special.cooldown;
    if (cfg.special.id === 'dharna_shield') {
      fighter.dharnaShieldTimer = cfg.special.active;
      fighter.vx = 0;
      events.push({
        type: 'special',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.3,
        damage: 0,
        word: 'DHARNA!',
        color: '#F97316',
        headline: `${cfg.name.toUpperCase()} SITS IN DHARNA PROTEST MID-MATCH!`,
      });
    } else if (cfg.special.id === 'deewar_drop') {
      fighter.vx = fighter.facing * 6.5;
      fighter.vy = 9.0;
      fighter.y = Math.max(fighter.y, 0.04);
      fighter.squashX = 0.84;
      fighter.squashY = 1.2;
      events.push({
        type: 'special',
        attackerSlot: fighter.slot,
        x: fighter.x,
        y: fighter.y + 1.4,
        damage: 0,
        word: 'DEEWAR DROP!',
        color: '#FFD426',
      });
    } else {
      events.push({
        type: 'special',
        attackerSlot: fighter.slot,
        x: fighter.x + fighter.facing * 0.6,
        y: fighter.y + 1.4,
        damage: 0,
        word: cfg.special.shortLabel + '!',
        color: cfg.special.accentColor,
      });
    }
  } else if (action === 'super') {
    fighter.shakti = 0;
    fighter.invulnTimer = 0.25;
    fighter.vx = fighter.facing * 7.5;
    events.push({
      type: 'super',
      attackerSlot: fighter.slot,
      x: fighter.x,
      y: fighter.y + 1.5,
      damage: 0,
      word: 'SHAKTI STRIKE!',
      color: '#FDE047',
      headline: `SHAKTI METER EXPLODES! ${cfg.name.toUpperCase()} UNLEASHES ${cfg.superName}!`,
    });
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
    isProjectile?: boolean;
    hitX: number;
    hitY: number;
  },
  events: CombatEvent[],
): void {
  if (defender.invulnTimer > 0 || defender.hp <= 0) return;

  const atkCfg = FIGHTER_CONFIGS[attacker.id];
  const defCfg = FIGHTER_CONFIGS[defender.id];

  // Check Dharna Shield counter on defender!
  if (defender.dharnaShieldTimer > 0 && !params.isGrab) {
    const reducedDamage = Math.max(1, Math.round(params.damage * 0.3));
    defender.hp = Math.max(0, defender.hp - reducedDamage);
    defender.shakti = Math.min(100, defender.shakti + 10);
    defender.hitFlashTimer = 0.08;

    // Push melee attacker back with counter damage
    if (!params.isProjectile) {
      const counterDmg = defCfg.special.damage;
      attacker.hp = Math.max(0, attacker.hp - counterDmg);
      attacker.vx = -attacker.facing * defCfg.special.knockbackX;
      attacker.vy = defCfg.special.knockbackY;
      attacker.hitstunTimer = defCfg.special.stunDuration;
      attacker.action = 'hit';
      attacker.actionTimer = 0;
      attacker.expression = 'hit';
      attacker.hitFlashTimer = 0.12;
      defender.damageDealt += counterDmg;
      defender.specialsLanded += 1;
    }

    state.hitstopTimer = Math.max(state.hitstopTimer, 0.055);
    events.push({
      type: 'dharna_counter',
      attackerSlot: defender.slot,
      x: params.hitX,
      y: params.hitY,
      damage: reducedDamage,
      word: 'DHARNA BLOCK!',
      color: '#FB923C',
      headline: `${defCfg.name.toUpperCase()} COUNTERED WITH PEACEFUL DHARNA!`,
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
    const chipDamage = params.isSpecial || params.isSuper ? Math.max(2, Math.round(params.damage * 0.25)) : 1;
    defender.hp = Math.max(1, defender.hp - chipDamage);
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

  // Clean Hit!
  const dir = attacker.x <= defender.x ? 1 : -1;
  defender.hp = Math.max(0, defender.hp - params.damage);
  defender.vx = dir * params.knockbackX;
  defender.vy = Math.max(defender.vy, params.knockbackY);
  defender.hitstunTimer = params.stun;
  defender.blockstunTimer = 0;
  defender.action = defender.hp <= 0 ? 'ko' : 'hit';
  defender.actionTimer = 0;
  defender.expression = defender.hp <= 0 ? 'ko' : 'hit';
  defender.hitFlashTimer = params.isHeavy ? 0.14 : 0.09;
  defender.squashX = 1.2;
  defender.squashY = 0.82;

  attacker.damageDealt += params.damage;
  if (params.isSpecial) {
    attacker.specialsLanded += 1;
  }
  attacker.comboCount += 1;
  attacker.comboTimer = 1.85;
  if (attacker.comboCount > attacker.maxCombo) {
    attacker.maxCombo = attacker.comboCount;
  }

  // SHAKTI gain
  attacker.shakti = Math.min(100, attacker.shakti + (params.isSuper ? 0 : params.isHeavy ? 15 : 10));
  defender.shakti = Math.min(100, defender.shakti + (params.isHeavy ? 12 : 8));

  state.hitstopTimer = Math.max(state.hitstopTimer, params.hitstop);

  const seed = state.roundTime * 17 + attacker.damageDealt + defender.hp;
  let word = params.isGrab
    ? 'DHAKKA!'
    : params.isSuper
      ? 'SHAKTI BOOM!'
      : params.isHeavy
        ? pickWord(HIT_WORDS_HEAVY, seed)
        : pickWord(HIT_WORDS_LIGHT, seed);

  if (attacker.comboCount >= 3 && !params.isSuper) {
    word = `${attacker.comboCount}x COMBO!`;
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
    type: defender.hp <= 0 ? 'ko' : params.isGrab ? 'grab' : params.isHeavy ? 'heavy_hit' : 'hit',
    attackerSlot: attacker.slot,
    x: params.hitX,
    y: params.hitY,
    damage: params.damage,
    word,
    color: params.isSuper ? '#FDE047' : params.isHeavy ? '#FB7185' : '#FBBF24',
    headline,
  });
}

function spawnSpecialProjectileIfNeeded(
  state: MatchState,
  fighter: FighterState,
): void {
  const cfg = FIGHTER_CONFIGS[fighter.id];
  if (cfg.special.id === 'currency_burst') {
    // 3 short-range flying notes fanned slightly
    for (let i = 0; i < 3; i++) {
      const proj: ProjectileState = {
        uid: state.nextProjectileUid++,
        ownerSlot: fighter.slot,
        kind: 'notes',
        x: fighter.x + fighter.facing * (0.75 + i * 0.16),
        y: fighter.y + 1.18 + (i - 1) * 0.22,
        vx: fighter.facing * (7.6 + i * 0.9),
        vy: (i - 1) * 0.55,
        radius: 0.42,
        damage: i === 1 ? cfg.special.damage : 5,
        stunDuration: cfg.special.stunDuration,
        knockbackX: cfg.special.knockbackX,
        knockbackY: cfg.special.knockbackY,
        life: 0,
        maxLife: 0.48,
        spin: i * 1.4,
        active: true,
      };
      state.projectiles.push(proj);
    }
  } else if (cfg.special.id === 'belan_throw') {
    const proj: ProjectileState = {
      uid: state.nextProjectileUid++,
      ownerSlot: fighter.slot,
      kind: 'belan',
      x: fighter.x + fighter.facing * 0.85,
      y: fighter.y + 1.25,
      vx: fighter.facing * 10.2,
      vy: 0,
      radius: 0.48,
      damage: cfg.special.damage,
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
    // Slow-motion dramatic finish
    const slowDt = dt * 0.35;
    for (const f of state.fighters) {
      if (f.y > GROUND_Y || f.vy !== 0) {
        f.vy += GRAVITY * slowDt;
        f.y += f.vy * slowDt;
        f.x += f.vx * slowDt;
        if (f.y <= GROUND_Y) {
          f.y = GROUND_Y;
          f.vy = 0;
          f.vx *= 0.4;
        }
      } else {
        f.vx *= Math.max(0, 1 - slowDt * 8);
        f.x += f.vx * slowDt;
      }
      f.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, f.x));
    }
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = 'finished';
      for (const f of state.fighters) {
        if (state.winnerSlot === f.slot) {
          f.action = 'victory';
          f.expression = 'victory';
        }
      }
    }
    return events;
  }

  // Hit-stop freezes simulation physics while camera shake / flashes still tick
  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return events;
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
    if (f.invulnTimer > 0) f.invulnTimer = Math.max(0, f.invulnTimer - dt);
    if (f.comboTimer > 0) {
      f.comboTimer -= dt;
      if (f.comboTimer <= 0) f.comboCount = 0;
    }

    // Buffer one-shot actions (120ms window)
    if (input.superMove && f.shakti >= 100) {
      f.bufferedAction = 'super';
      f.bufferTimer = 0.12;
    } else if (input.special && f.specialCooldown <= 0) {
      f.bufferedAction = 'special';
      f.bufferTimer = 0.12;
    } else if (input.grab) {
      f.bufferedAction = 'grab';
      f.bufferTimer = 0.12;
    } else if (input.kick) {
      f.bufferedAction = 'kick';
      f.bufferTimer = 0.12;
    } else if (input.punch) {
      f.bufferedAction = 'punch';
      f.bufferTimer = 0.12;
    } else if (input.up) {
      f.bufferedAction = 'jump';
      f.bufferTimer = 0.12;
    } else if (f.bufferTimer > 0) {
      f.bufferTimer -= dt;
      if (f.bufferTimer <= 0) f.bufferedAction = null;
    }

    // Auto-face opponent when idle/walking/crouching/blocking on ground
    if (
      f.y <= GROUND_Y + 0.02 &&
      f.hitstunTimer <= 0 &&
      !isBusyAttacking(f.action) &&
      Math.abs(opp.x - f.x) > 0.15
    ) {
      f.facing = opp.x >= f.x ? 1 : -1;
    }

    // Hitstun / Blockstun recovery
    if (f.hitstunTimer > 0) {
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

      // Slow horizontal momentum during grounded attacks (except Deewar Drop / Super lunge)
      const isDeewarDrop = f.action === 'special' && cfg.special.id === 'deewar_drop';
      if (!isDeewarDrop && f.action !== 'super') {
        f.vx *= Math.max(0, 1 - dt * 10);
      }

      // Trigger projectile at start of active window
      if (
        f.action === 'special' &&
        (cfg.special.id === 'currency_burst' || cfg.special.id === 'belan_throw') &&
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
        // For Deewar Drop, trigger either on contact or when landing nearby
        const withinRange =
          dx >= -0.35 &&
          dx <= timing.range &&
          dy <= (isDeewarDrop ? 1.85 : 1.35);

        if (withinRange) {
          f.hasHitCurrentAttack = true;
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
              isHeavy: timing.isHeavy,
              isGrab: timing.isGrab,
              isSpecial: timing.isSpecial,
              isSuper: timing.isSuper,
              hitX: (f.x + opp.x) * 0.5,
              hitY: Math.max(f.y, opp.y) + 1.25,
            },
            events,
          );
        }
      }

      if (f.actionTimer >= f.actionDuration) {
        f.action = f.y > GROUND_Y + 0.02 ? 'jump' : 'idle';
        f.actionTimer = 0;
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

    // Integrate physics
    const wasAirborne = f.y > GROUND_Y + 0.02;
    if (f.y > GROUND_Y || f.vy > 0) {
      f.vy += GRAVITY * dt;
      f.y += f.vy * dt;
    }
    const prevX = f.x;
    f.x += f.vx * dt;
    f.x = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, f.x));

    // Distance-synced walk cycle (no skating!)
    if (f.y <= GROUND_Y + 0.02) {
      f.walkCycle += Math.abs(f.x - prevX) * 4.2;
    }

    if (f.y <= GROUND_Y) {
      f.y = GROUND_Y;
      if (wasAirborne) {
        const isDeewarSlam = f.id === 'anda' && f.action === 'special';
        f.squashX = isDeewarSlam ? 1.38 : 1.22;
        f.squashY = isDeewarSlam ? 0.66 : 0.78;
        events.push({
          type: 'land',
          attackerSlot: f.slot,
          x: f.x,
          y: 0,
          damage: 0,
          word: isDeewarSlam ? 'CRACK!' : undefined,
          color: isDeewarSlam ? '#FFD426' : undefined,
        });
        if (f.action === 'jump') {
          f.action = 'idle';
        }
      }
      f.vy = 0;
    }
  }

  // Pushbox separation (prevent fighters from standing inside each other)
  const dist = p2.x - p1.x;
  const absDist = Math.abs(dist);
  const yOverlap = Math.abs(p2.y - p1.y) < 1.25;
  if (absDist < MIN_FIGHTER_SEPARATION && yOverlap) {
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
    proj.spin += dt * 16;

    const attacker = state.fighters[proj.ownerSlot];
    const defender = state.fighters[1 - proj.ownerSlot];
    const defInput = inputs[1 - proj.ownerSlot];

    const dx = Math.abs(proj.x - defender.x);
    const dy = Math.abs(proj.y - (defender.y + (defender.action === 'crouch' ? 0.65 : 1.05)));

    if (dx <= proj.radius + 0.55 && dy <= proj.radius + 0.72) {
      applyHit(
        state,
        attacker,
        defender,
        defInput,
        {
          damage: proj.damage,
          knockbackX: proj.knockbackX,
          knockbackY: proj.knockbackY,
          hitstop: 0.04,
          stun: proj.stunDuration,
          isHeavy: proj.kind === 'belan',
          isGrab: false,
          isSpecial: true,
          isSuper: false,
          isProjectile: true,
          hitX: proj.x,
          hitY: proj.y,
        },
        events,
      );
      proj.active = false;
    }

    if (!proj.active || proj.life >= proj.maxLife || proj.x < ARENA_MIN_X - 1.5 || proj.x > ARENA_MAX_X + 1.5) {
      state.projectiles.splice(i, 1);
    }
  }

  // Check KO or Timeout
  if (p1.hp <= 0 || p2.hp <= 0) {
    state.phase = 'ko_freeze';
    state.phaseTimer = 0.85;
    state.finishReason = 'ko';
    if (p1.hp <= 0 && p2.hp <= 0) {
      state.winnerSlot = 'draw';
    } else if (p2.hp <= 0) {
      state.winnerSlot = 0;
    } else {
      state.winnerSlot = 1;
    }
  } else if (state.roundTime <= 0) {
    state.phase = 'ko_freeze';
    state.phaseTimer = 0.7;
    state.finishReason = 'timeout';
    const p1Ratio = p1.hp / p1.maxHp;
    const p2Ratio = p2.hp / p2.maxHp;
    if (Math.abs(p1Ratio - p2Ratio) < 0.001) {
      state.winnerSlot = 'draw';
    } else {
      state.winnerSlot = p1Ratio > p2Ratio ? 0 : 1;
    }
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
      // Long-range policy: throw Belan / Paisa Flex / Deewar Drop or close gap
      const rangedSpecial =
        cpu.id === 'mausi' || cpu.id === 'sheru' || cpu.id === 'anda';
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

  const finishReason = state.finishReason ?? 'ko';
  const winCfg = winnerSlot === 1 ? p2Cfg : p1Cfg;
  const loseCfg = winnerSlot === 1 ? p1Cfg : p2Cfg;

  if (winnerSlot === 'draw') {
    stampText = 'DRAW!';
    headline = `HISTORIC TIE AT ${stageCfg.name.toUpperCase()}! BOTH SIDES CLAIM 100% VICTORY!`;
    subheadline = `Exit polls confused as ${p1Cfg.name} and ${p2Cfg.name} both demand recount over cutting chai.`;
    reportParagraph = `Chaos erupted at ${stageCfg.name} after the timer hit zero with both fighters refusing to leave the stage. Local chai bhaiya has already filed a ₹420 invoice for six spilled cutting-chai glasses.`;
  } else {
    stampText =
      winnerSlot === 0 ? 'YOU WIN!' : finishReason === 'timeout' ? 'TIME UP!' : 'K.O.!';
    const templates = [
      `${winCfg.name.toUpperCase()} FLOORS ${loseCfg.name.toUpperCase()} IN ${stageCfg.name.toUpperCase()}!`,
      `PAISA VASOOL KO! ${winCfg.name.toUpperCase()} DECLARED UNDISPUTED ${winCfg.titleBadge}!`,
      `EXCLUSIVE: ${loseCfg.name.toUpperCase()} FILES RTI AFTER ${winCfg.name.toUpperCase()}'S ${winCfg.special.name.toUpperCase()}!`,
      `SANSAD TO MOHALLA SHOCKED: ${winCfg.name.toUpperCase()} TAKES HOME THE CHAI TROPHY!`,
    ];
    headline = templates[Math.abs(Math.floor(seed)) % templates.length];
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
