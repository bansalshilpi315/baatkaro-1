import { createEmptyInput } from './combat';
import type { AndaSuperBeatSignal, AndaSuperState } from './andaSuper';
import type { BillaSuperBeatSignal, BillaSuperState } from './billaSuper';
import type { FatherSuperBeatSignal, FatherSuperState } from './fatherSuper';
import type { MausiSuperBeatSignal, MausiSuperState } from './mausiSuper';
import type { NetaSuperBeatSignal, NetaSuperState } from './netaSuper';
import type { PrincipalSuperBeatSignal, PrincipalSuperState } from './principalSuper';
import type { SamyakSuperBeatSignal, SamyakSuperState } from './samyakSuper';
import type { SheruSuperBeatSignal, SheruSuperState } from './sheruSuper';
import type {
  CombatEvent,
  FaceExpression,
  FighterAction,
  FighterId,
  FighterInput,
  FighterState,
  MatchResultSnapshot,
  MatchState,
  ProjectileState,
  StageId,
} from './types';

export const PEER_ID_PREFIX = 'desishowdown-room-';

export const PEER_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type OnlineRole = 'offline' | 'host' | 'guest';

export type FriendRoomStatus =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type GuestActionName = 'up' | 'punch' | 'kick' | 'grab' | 'special' | 'superMove';

export interface SyncedFighterSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  shakti: number;
  action: FighterAction;
  actionTimer: number;
  actionDuration: number;
  comboCount: number;
  comboStep: 0 | 1 | 2;
  specialCooldown: number;
  specialMaxCooldown: number;
  hitFlashTimer: number;
  squashX: number;
  squashY: number;
  squashedTimer: number;
  dharnaShieldTimer: number;
  expression: FaceExpression;
  walkCycle: number;
}

export interface SyncedProjectileSnapshot {
  uid: number;
  ownerSlot: 0 | 1;
  kind: ProjectileState['kind'];
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  life: number;
  maxLife: number;
}

export interface SyncedSuperStates {
  sheru?: SheruSuperState | null;
  billa?: BillaSuperState | null;
  neta?: NetaSuperState | null;
  anda?: AndaSuperState | null;
  mausi?: MausiSuperState | null;
  father?: FatherSuperState | null;
  samyak?: SamyakSuperState | null;
  principal?: PrincipalSuperState | null;
}

export interface SyncedSuperSignals {
  sheru?: SheruSuperBeatSignal[];
  billa?: BillaSuperBeatSignal[];
  neta?: NetaSuperBeatSignal[];
  anda?: AndaSuperBeatSignal[];
  mausi?: MausiSuperBeatSignal[];
  father?: FatherSuperBeatSignal[];
  samyak?: SamyakSuperBeatSignal[];
  principal?: PrincipalSuperBeatSignal[];
}

export interface StateSnapshotPacket {
  type: 'STATE';
  seq: number;
  fighters: [SyncedFighterSnapshot, SyncedFighterSnapshot];
  projectiles: SyncedProjectileSnapshot[];
  phase: MatchState['phase'];
  phaseTimer: number;
  introDuration: number;
  koSubPhase: MatchState['koSubPhase'];
  koCalloutText: string;
  roundNumber: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundWinnerSlot: MatchState['roundWinnerSlot'];
  roundTime: number;
  activeSuperSlot: MatchState['activeSuperSlot'];
  activeSuperElapsed: number;
  activeSuperDuration: number;
  finishReason: MatchState['finishReason'];
  supers?: SyncedSuperStates;
}

export type FriendRoomPacket =
  | {
      type: 'LOBBY_STATE';
      p1Id: FighterId;
      p2Id: FighterId;
      stageId: StageId;
    }
  | {
      type: 'GUEST_SELECT';
      p2Id: FighterId;
    }
  | {
      type: 'START_MATCH';
      p1Id: FighterId;
      p2Id: FighterId;
      stageId: StageId;
      seed: number;
    }
  | {
      type: 'INPUT';
      moveDir: -1 | 0 | 1;
      down?: boolean;
      action?: GuestActionName;
    }
  | StateSnapshotPacket
  | {
      type: 'EVENTS';
      events?: CombatEvent[];
      superSignals?: SyncedSuperSignals;
      dialogues?: Array<{ slot: 0 | 1; text: string }>;
      koDahi?: boolean;
    }
  | {
      type: 'MATCH_END';
      result: MatchResultSnapshot;
    }
  | {
      type: 'SKIP_INTRO';
    }
  | {
      type: 'REMATCH_REQUEST';
    }
  | {
      type: 'BACK_TO_SELECT';
    }
  | {
      type: 'LEAVE_ROOM';
    };

export function generateRoomCode(rng: () => number = Math.random): string {
  const num = 1000 + Math.floor(rng() * 9000);
  return String(Math.min(9999, Math.max(1000, num)));
}

export function sanitizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}

export function isValidRoomCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

export function roomCodeToPeerId(code: string): string {
  return `${PEER_ID_PREFIX}${sanitizeRoomCode(code)}`;
}

export function isFriendRoomPacket(data: unknown): data is FriendRoomPacket {
  if (!data || typeof data !== 'object') return false;
  const t = (data as { type?: unknown }).type;
  return (
    t === 'LOBBY_STATE' ||
    t === 'GUEST_SELECT' ||
    t === 'START_MATCH' ||
    t === 'INPUT' ||
    t === 'STATE' ||
    t === 'EVENTS' ||
    t === 'MATCH_END' ||
    t === 'SKIP_INTRO' ||
    t === 'REMATCH_REQUEST' ||
    t === 'BACK_TO_SELECT' ||
    t === 'LEAVE_ROOM'
  );
}

/**
 * Host-side buffer holding Guest's current directional state + latched one-shot action taps.
 */
export interface RemoteInputBuffer {
  moveDir: -1 | 0 | 1;
  down: boolean;
  oneShots: Record<GuestActionName, boolean>;
}

export function createRemoteInputBuffer(): RemoteInputBuffer {
  return {
    moveDir: 0,
    down: false,
    oneShots: {
      up: false,
      punch: false,
      kick: false,
      grab: false,
      special: false,
      superMove: false,
    },
  };
}

export function resetRemoteInputBuffer(buf: RemoteInputBuffer): void {
  buf.moveDir = 0;
  buf.down = false;
  buf.oneShots.up = false;
  buf.oneShots.punch = false;
  buf.oneShots.kick = false;
  buf.oneShots.grab = false;
  buf.oneShots.special = false;
  buf.oneShots.superMove = false;
}

export function applyRemoteInputPacket(
  buf: RemoteInputBuffer,
  pkt: Extract<FriendRoomPacket, { type: 'INPUT' }>,
): void {
  buf.moveDir = pkt.moveDir === -1 ? -1 : pkt.moveDir === 1 ? 1 : 0;
  if (typeof pkt.down === 'boolean') {
    buf.down = pkt.down;
  }
  if (pkt.action && pkt.action in buf.oneShots) {
    buf.oneShots[pkt.action] = true;
  }
}

export function consumeRemoteInput(buf: RemoteInputBuffer): FighterInput {
  const input = createEmptyInput();
  input.left = buf.moveDir === -1;
  input.right = buf.moveDir === 1;
  input.down = buf.down;
  input.up = buf.oneShots.up;
  input.punch = buf.oneShots.punch;
  input.kick = buf.oneShots.kick;
  input.grab = buf.oneShots.grab;
  input.special = buf.oneShots.special;
  input.superMove = buf.oneShots.superMove;

  buf.oneShots.up = false;
  buf.oneShots.punch = false;
  buf.oneShots.kick = false;
  buf.oneShots.grab = false;
  buf.oneShots.special = false;
  buf.oneShots.superMove = false;
  return input;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function packFighter(f: FighterState): SyncedFighterSnapshot {
  return {
    x: round3(f.x),
    y: round3(f.y),
    vx: round3(f.vx),
    vy: round3(f.vy),
    facing: f.facing,
    hp: round3(f.hp),
    maxHp: f.maxHp,
    shakti: round3(f.shakti),
    action: f.action,
    actionTimer: round3(f.actionTimer),
    actionDuration: round3(f.actionDuration),
    comboCount: f.comboCount,
    comboStep: f.comboStep,
    specialCooldown: round3(f.specialCooldown),
    specialMaxCooldown: f.specialMaxCooldown,
    hitFlashTimer: round3(f.hitFlashTimer),
    squashX: round3(f.squashX),
    squashY: round3(f.squashY),
    squashedTimer: round3(f.squashedTimer),
    dharnaShieldTimer: round3(f.dharnaShieldTimer),
    expression: f.expression,
    walkCycle: round3(f.walkCycle),
  };
}

export function packMatchStateSnapshot(state: MatchState, seq: number): StateSnapshotPacket {
  let supers: SyncedSuperStates | undefined;
  if (
    state.sheruSuper ||
    state.billaSuper ||
    state.netaSuper ||
    state.andaSuper ||
    state.mausiSuper ||
    state.fatherSuper ||
    state.samyakSuper ||
    state.principalSuper
  ) {
    supers = {};
    if (state.sheruSuper) supers.sheru = state.sheruSuper;
    if (state.billaSuper) supers.billa = state.billaSuper;
    if (state.netaSuper) supers.neta = state.netaSuper;
    if (state.andaSuper) supers.anda = state.andaSuper;
    if (state.mausiSuper) supers.mausi = state.mausiSuper;
    if (state.fatherSuper) supers.father = state.fatherSuper;
    if (state.samyakSuper) supers.samyak = state.samyakSuper;
    if (state.principalSuper) supers.principal = state.principalSuper;
  }

  return {
    type: 'STATE',
    seq,
    fighters: [packFighter(state.fighters[0]), packFighter(state.fighters[1])],
    projectiles: state.projectiles
      .filter((p) => p.active)
      .map((p) => ({
        uid: p.uid,
        ownerSlot: p.ownerSlot,
        kind: p.kind,
        x: round3(p.x),
        y: round3(p.y),
        vx: round3(p.vx),
        vy: round3(p.vy),
        spin: round3(p.spin),
        life: round3(p.life),
        maxLife: round3(p.maxLife),
      })),
    phase: state.phase,
    phaseTimer: round3(state.phaseTimer),
    introDuration: state.introDuration,
    koSubPhase: state.koSubPhase,
    koCalloutText: state.koCalloutText,
    roundNumber: state.roundNumber,
    p1RoundsWon: state.p1RoundsWon,
    p2RoundsWon: state.p2RoundsWon,
    roundWinnerSlot: state.roundWinnerSlot,
    roundTime: round3(state.roundTime),
    activeSuperSlot: state.activeSuperSlot,
    activeSuperElapsed: round3(state.activeSuperElapsed),
    activeSuperDuration: round3(state.activeSuperDuration),
    finishReason: state.finishReason,
    supers,
  };
}

export interface GuestInterpolationTarget {
  x: number;
  y: number;
  initialized: boolean;
}

/**
 * Applies a Host state snapshot onto the Guest's local MatchState while storing target positions
 * for smooth 60 FPS visual interpolation (snapping immediately on large teleports/round resets).
 */
export function applyStateSnapshotToGuest(
  state: MatchState,
  snap: StateSnapshotPacket,
  targets: [GuestInterpolationTarget, GuestInterpolationTarget],
): void {
  const roundChanged = state.roundNumber !== snap.roundNumber;
  state.phase = snap.phase;
  state.phaseTimer = snap.phaseTimer;
  state.introDuration = snap.introDuration;
  state.koSubPhase = snap.koSubPhase;
  state.koCalloutText = snap.koCalloutText;
  state.roundNumber = snap.roundNumber;
  state.p1RoundsWon = snap.p1RoundsWon;
  state.p2RoundsWon = snap.p2RoundsWon;
  state.roundWinnerSlot = snap.roundWinnerSlot;
  state.roundTime = snap.roundTime;
  state.activeSuperSlot = snap.activeSuperSlot;
  state.activeSuperElapsed = snap.activeSuperElapsed;
  state.activeSuperDuration = snap.activeSuperDuration;
  state.finishReason = snap.finishReason;

  for (let i = 0; i < 2; i++) {
    const f = state.fighters[i];
    const s = snap.fighters[i];
    const tgt = targets[i];

    const jumpDist = Math.hypot(s.x - f.x, s.y - f.y);
    if (!tgt.initialized || roundChanged || jumpDist > 2.4) {
      f.x = s.x;
      f.y = s.y;
      tgt.initialized = true;
    }
    tgt.x = s.x;
    tgt.y = s.y;

    f.vx = s.vx;
    f.vy = s.vy;
    f.facing = s.facing;
    f.hp = s.hp;
    f.maxHp = s.maxHp;
    f.shakti = s.shakti;
    f.action = s.action;
    f.actionTimer = s.actionTimer;
    f.actionDuration = s.actionDuration;
    f.comboCount = s.comboCount;
    f.comboStep = s.comboStep;
    f.specialCooldown = s.specialCooldown;
    f.specialMaxCooldown = s.specialMaxCooldown;
    f.hitFlashTimer = s.hitFlashTimer;
    f.squashX = s.squashX;
    f.squashY = s.squashY;
    f.squashedTimer = s.squashedTimer;
    f.dharnaShieldTimer = s.dharnaShieldTimer;
    f.expression = s.expression;
    f.walkCycle = s.walkCycle;
  }

  state.projectiles = snap.projectiles.map((p) => ({
    uid: p.uid,
    ownerSlot: p.ownerSlot,
    kind: p.kind,
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    radius: 0.45,
    damage: 0,
    stunDuration: 0,
    knockbackX: 0,
    knockbackY: 0,
    life: p.life,
    maxLife: p.maxLife,
    spin: p.spin,
    active: true,
  }));

  state.sheruSuper = snap.supers?.sheru ?? null;
  state.billaSuper = snap.supers?.billa ?? null;
  state.netaSuper = snap.supers?.neta ?? null;
  state.andaSuper = snap.supers?.anda ?? null;
  state.mausiSuper = snap.supers?.mausi ?? null;
  state.fatherSuper = snap.supers?.father ?? null;
  state.samyakSuper = snap.supers?.samyak ?? null;
  state.principalSuper = snap.supers?.principal ?? null;
}
