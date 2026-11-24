import type { SheruSuperBeatSignal, SheruSuperState } from './sheruSuper';

export type FighterId = 'sheru' | 'billa' | 'neta' | 'anda' | 'mausi';

export type StageId = 'mohalla' | 'school' | 'studio' | 'shaadi' | 'railway';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type GraphicsQuality = 'high' | 'low';

export type GameScreen =
  | 'notice'
  | 'loading'
  | 'title'
  | 'select'
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
  | 'grab'
  | 'special'
  | 'super'
  | 'hit'
  | 'ko'
  | 'victory';

export type FaceExpression = 'idle' | 'attack' | 'hit' | 'block' | 'ko' | 'victory';

export type SpecialMoveKind =
  | 'currency_burst'
  | 'swatter_smash'
  | 'dharna_shield'
  | 'deewar_drop'
  | 'belan_throw';

export interface SpecialMoveConfig {
  id: SpecialMoveKind;
  name: string;
  shortLabel: string;
  iconKey: 'notes' | 'swatter' | 'shield' | 'drop' | 'belan';
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
  invulnTimer: number;
  comboCount: number;
  comboTimer: number;
  maxCombo: number;
  damageDealt: number;
  specialsLanded: number;
  walkCycle: number;
  hitFlashTimer: number;
  squashX: number;
  squashY: number;
  expression: FaceExpression;
  bufferedAction: 'punch' | 'kick' | 'grab' | 'special' | 'super' | 'jump' | null;
  bufferTimer: number;
}

export interface ProjectileState {
  uid: number;
  ownerSlot: 0 | 1;
  kind: 'notes' | 'belan' | 'shockwave';
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
  | 'special'
  | 'super'
  | 'dharna_counter'
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
  color?: string;
  headline?: string;
}

export interface MatchState {
  fighters: [FighterState, FighterState];
  projectiles: ProjectileState[];
  roundTime: number;
  hitstopTimer: number;
  phase: 'intro' | 'fighting' | 'ko_freeze' | 'finished';
  phaseTimer: number;
  winnerSlot: 0 | 1 | 'draw' | null;
  finishReason: 'ko' | 'timeout' | null;
  nextProjectileUid: number;
  aiThinkTimer: number;
  aiCurrentIntent: 'approach' | 'retreat' | 'idle' | 'block' | 'jump_in';
  aiIntentTimer: number;
  sheruSuper: SheruSuperState | null;
  sheruSuperSignals: SheruSuperBeatSignal[];
}

export interface FloatingCallout {
  id: number;
  text: string;
  color: string;
  screenX: number;
  screenY: number;
}

export interface MatchResultSnapshot {
  winnerSlot: 0 | 1 | 'draw';
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  difficulty: Difficulty;
  finishReason: 'ko' | 'timeout';
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
  roundTime: number;
  phase: MatchState['phase'];
  bannerText: string | null;
  superBannerText: string | null;
  showBroadcastIntro: boolean;
  introTagline: string;
}
