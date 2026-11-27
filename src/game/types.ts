import type { AndaSuperBeatSignal, AndaSuperState } from './andaSuper';
import type { BillaSuperBeatSignal, BillaSuperState } from './billaSuper';
import type { FatherSuperBeatSignal, FatherSuperState } from './fatherSuper';
import type { MausiSuperBeatSignal, MausiSuperState } from './mausiSuper';
import type { NetaSuperBeatSignal, NetaSuperState } from './netaSuper';
import type { SamyakSuperBeatSignal, SamyakSuperState } from './samyakSuper';
import type { SheruSuperBeatSignal, SheruSuperState } from './sheruSuper';

export type FighterId = 'sheru' | 'billa' | 'neta' | 'anda' | 'mausi' | 'father' | 'samyak';

export type StageId = 'mohalla' | 'school' | 'studio' | 'shaadi' | 'railway' | 'assembly';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type GraphicsQuality = 'high' | 'low';

export type GameScreen =
  | 'notice'
  | 'loading'
  | 'title'
  | 'select'
  | 'super_preview'
  | 'playing'
  | 'paused'
  | 'victory';

export type FighterAction =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'crouch'
  | 'block'
  | 'punch'
  | 'kick'
  | 'sweep'
  | 'grab'
  | 'grab_hold'
  | 'grabbed'
  | 'special'
  | 'super'
  | 'hit'
  | 'knockdown'
  | 'getup'
  | 'ko'
  | 'victory';

export type FaceExpression = 'idle' | 'attack' | 'hit' | 'block' | 'ko' | 'victory';

export type SpecialMoveKind =
  | 'currency_burst'
  | 'swatter_throw'
  | 'dharna_shield'
  | 'anda_squash'
  | 'belan_throw'
  | 'diary_note'
  | 'laxmikant_slam';

export interface SpecialMoveConfig {
  id: SpecialMoveKind;
  name: string;
  shortLabel: string;
  iconKey: 'notes' | 'swatter' | 'shield' | 'drop' | 'belan' | 'diary' | 'polity';
  description: string;
  cooldown: number;
  damage: number;
  range: number;
  knockbackX: number;
  knockbackY: number;
  windup: number;
  active: number;
  recovery: number;
  stunDuration: number;
  accentColor: string;
}

export interface FighterConfig {
  id: FighterId;
  name: string;
  tagline: string;
  titleBadge: string;
  maxHp: number;
  attackPowerMultiplier?: number;
  walkSpeed: number;
  jumpVelocity: number;
  punchDamage: number;
  kickDamage: number;
  grabDamage: number;
  accentHex: string;
  secondaryHex: string;
  skinHex: string;
  special: SpecialMoveConfig;
  superName: string;
  victoryQuotes: string[];
}

export interface StageConfig {
  id: StageId;
  name: string;
  subtitle: string;
  accentHex: string;
  headlines: string[];
}

export interface FighterInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean;
  kick: boolean;
  grab: boolean;
  special: boolean;
  superMove: boolean;
}

export interface FighterState {
  slot: 0 | 1;
  id: FighterId;
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
  hasHitCurrentAttack: boolean;
  hitstunTimer: number;
  blockstunTimer: number;
  specialCooldown: number;
  specialMaxCooldown: number;
  dharnaShieldTimer: number;
  dharnaWaveFired: boolean;
  squashHoldTimer: number;
  squashedTimer: number;
  invulnTimer: number;
  comboCount: number;
  comboTimer: number;
  comboStep: 0 | 1 | 2;
  comboChainTimer: number;
  knockdownTimer: number;
  grabTargetSlot: 0 | 1 | null;
  maxCombo: number;
  damageDealt: number;
  superDamageBudget: number;
  superDamageDealt: number;
  specialsLanded: number;
  walkCycle: number;
  hitFlashTimer: number;
  squashX: number;
  squashY: number;
  expression: FaceExpression;
  bufferedAction: 'punch' | 'kick' | 'sweep' | 'grab' | 'special' | 'super' | 'jump' | null;
  bufferTimer: number;
}

export interface ProjectileState {
  uid: number;
  ownerSlot: 0 | 1;
  kind: 'notes' | 'swatter' | 'belan' | 'diary' | 'polity' | 'shockwave';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  stunDuration: number;
  knockbackX: number;
  knockbackY: number;
  life: number;
  maxLife: number;
  spin: number;
  active: boolean;
}

export type CombatEventType =
  | 'hit'
  | 'heavy_hit'
  | 'block'
  | 'grab'
  | 'grab_throw'
  | 'special'
  | 'super'
  | 'dharna_counter'
  | 'knockdown_land'
  | 'ko'
  | 'jump'
  | 'land'
  | 'whiff';

export interface CombatEvent {
  type: CombatEventType;
  attackerSlot: 0 | 1;
  x: number;
  y: number;
  damage: number;
  word?: string;
  isSuperSignature?: boolean;
  moveCallout?: string;
  color?: string;
  headline?: string;
}

export interface ComicSpeechBubble {
  id: number;
  slot: 0 | 1;
  speakerName: string;
  text: string;
  screenX: number;
  screenY: number;
  opacity: number;
  tailSide?: 'center' | 'left' | 'right';
}

export interface SuperBannerInfo {
  fighterId: FighterId;
  fighterName: string;
  superName: string;
  slot: 0 | 1;
}

export interface MatchState {
  fighters: [FighterState, FighterState];
  projectiles: ProjectileState[];
  roundNumber: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundsToWin: number;
  roundWinnerSlot: 0 | 1 | 'draw' | null;
  roundTime: number;
  hitstopTimer: number;
  phase: 'intro' | 'fighting' | 'ko_freeze' | 'finished';
  phaseTimer: number;
  introDuration: number;
  koSubPhase: 'none' | 'impact_slowmo' | 'winner_celebration';
  koCalloutText: string;
  activeSuperSlot: 0 | 1 | null;
  activeSuperElapsed: number;
  activeSuperDuration: number;
  winnerSlot: 0 | 1 | 'draw' | null;
  finishReason: 'ko' | 'timeout' | null;
  nextProjectileUid: number;
  aiThinkTimer: number;
  aiCurrentIntent: 'approach' | 'retreat' | 'idle' | 'block' | 'jump_in';
  aiIntentTimer: number;
  sheruSuper: SheruSuperState | null;
  sheruSuperSignals: SheruSuperBeatSignal[];
  billaSuper: BillaSuperState | null;
  billaSuperSignals: BillaSuperBeatSignal[];
  netaSuper: NetaSuperState | null;
  netaSuperSignals: NetaSuperBeatSignal[];
  andaSuper: AndaSuperState | null;
  andaSuperSignals: AndaSuperBeatSignal[];
  mausiSuper: MausiSuperState | null;
  mausiSuperSignals: MausiSuperBeatSignal[];
  fatherSuper: FatherSuperState | null;
  fatherSuperSignals: FatherSuperBeatSignal[];
  samyakSuper: SamyakSuperState | null;
  samyakSuperSignals: SamyakSuperBeatSignal[];
}

export interface FloatingCallout {
  id: number;
  text: string;
  color: string;
  screenX: number;
  screenY: number;
  isSignature?: boolean;
}

export interface MatchResultSnapshot {
  winnerSlot: 0 | 1 | 'draw';
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  difficulty: Difficulty;
  finishReason: 'ko' | 'timeout';
  p1RoundsWon: number;
  p2RoundsWon: number;
  scoreSummary: string;
  loserQuote: string;
  timeRemaining: number;
  p1HpPercent: number;
  p2HpPercent: number;
  p1MaxCombo: number;
  p1DamageDealt: number;
  p1SpecialsLanded: number;
  headline: string;
  subheadline: string;
  reportParagraph: string;
  stampText: string;
}

export interface HudSnapshot {
  p1Hp: number;
  p1MaxHp: number;
  p1Shakti: number;
  p1SpecialCd: number;
  p1SpecialMaxCd: number;
  p1Combo: number;
  p2Hp: number;
  p2MaxHp: number;
  p2Shakti: number;
  p2SpecialCd: number;
  p2SpecialMaxCd: number;
  p2Combo: number;
  roundNumber: number;
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundTime: number;
  phase: MatchState['phase'];
  isSuperCinematic: boolean;
  bannerText: string | null;
  bannerTone: 'round' | 'ko' | 'winner';
  superBanner: SuperBannerInfo | null;
  moveCallout: string | null;
  speechBubbles: ComicSpeechBubble[];
  canSkipIntro: boolean;
}
