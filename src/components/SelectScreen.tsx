import { useEffect, useRef, useState } from 'react';
import {
  Coins,
  HelpCircle,
  Lock,
  MapPin,
  Settings,
  Sparkles,
  Swords,
  Tv,
  Users,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import {
  FIGHTER_CONFIGS,
  ROSTER_SLOTS,
  STAGE_CONFIGS,
  STAGE_LIST,
} from '../game/characters';
import { STAGE_AI_TIER } from '../game/combat';
import type { OnlineRole } from '../game/friendRoomProtocol';
import {
  FIGHTER_UNLOCK_ADS,
  FIGHTER_UNLOCK_COSTS,
  getFighterAdProgress,
  STAGE_UNLOCK_COSTS,
  type PlayerProfile,
} from '../game/playerAccount';
import type { Difficulty, FighterId, StageId } from '../game/types';
import { FighterPortrait } from './FighterPortrait';
import { FullscreenButton } from './FullscreenButton';
import { UnlockFighterModal } from './UnlockFighterModal';

interface SelectScreenProps {
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  difficulty: Difficulty;
  onlineRole: OnlineRole;
  roomCode: string;
  playerProfile: PlayerProfile;
  globalMuted: boolean;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  onSelectP1: (id: FighterId) => void;
  onSelectP2: (id: FighterId) => void;
  onSelectStage: (id: StageId) => void;
  onSelectDifficulty: (d: Difficulty) => void;
  onUnlockFighter: (id: FighterId) => boolean;
  onWatchAdUnlock: (id: FighterId) => { watched: number; required: number; unlockedNow: boolean };
  onUnlockStage: (stageNumber: number) => void;
  onToggleGlobalMute: () => void;
  onToggleFullscreen: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onOpenFriendRoom: () => void;
  onStartFight: () => void;
}

const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: 'easy', label: 'EASY' },
  { id: 'normal', label: 'NORMAL' },
  { id: 'hard', label: 'HARD' },
];

const SHORT_NAMES: Record<FighterId, string> = {
  sheru: 'SHERU',
  billa: 'BILLA',
  anda: 'ANDA',
  krish: 'KRISH',
  adi: 'ADI',
  mausi: 'MAUSI',
  neta: 'NETA',
  samyak: 'SAMYAK',
  father: 'PRINCIPAL MAN',
};

function MysterySilhouetteAvatar() {
  return (
    <div
      aria-hidden="true"
      className="select-fighter-avatar relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-[#f59e0b]/70 bg-gradient-to-b from-[#2b1e0c] via-[#17110b] to-[#0b0806] sm:h-11 sm:w-11"
    >
      <svg viewBox="0 0 44 44" className="h-9 w-9 text-[#f59e0b]/55">
        <circle cx="22" cy="15" r="7.5" fill="currentColor" />
        <path d="M9 39c1.5-8.5 6.5-12.5 13-12.5S33.5 30.5 35 39H9Z" fill="currentColor" />
      </svg>
      <span className="absolute font-display text-lg font-extrabold text-[#fde047] drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
        ?
      </span>
    </div>
  );
}

export function SelectScreen({
  p1Id,
  p2Id,
  stageId,
  difficulty,
  onlineRole,
  roomCode,
  playerProfile,
  globalMuted,
  isFullscreen,
  fullscreenSupported,
  onSelectP1,
  onSelectP2,
  onSelectStage,
  onSelectDifficulty,
  onUnlockFighter,
  onWatchAdUnlock,
  onUnlockStage,
  onToggleGlobalMute,
  onToggleFullscreen,
  onOpenHowToPlay,
  onOpenSettings,
  onOpenFriendRoom,
  onStartFight,
}: SelectScreenProps) {
  const p1Cfg = FIGHTER_CONFIGS[p1Id];
  const p2Cfg = FIGHTER_CONFIGS[p2Id];
  const activeStage = STAGE_CONFIGS[stageId];
  const stageAiTier = STAGE_AI_TIER[stageId] ?? 1;
  const activeStageNum = STAGE_LIST.findIndex((s) => s.id === stageId) + 1;

  const isOnline = onlineRole !== 'offline';
  const isHost = onlineRole === 'host';
  const isGuest = onlineRole === 'guest';

  const canPickP1 = !isGuest;
  const canPickP2 = !isHost;
  const canPickStage = !isGuest;
  const canStartFight = !isGuest;

  const localSelectedId = isGuest ? p2Id : p1Id;
  const isLocalFighterLocked = !isOnline && !playerProfile.unlockedFighters.includes(localSelectedId);
  const localFighterCost = FIGHTER_UNLOCK_COSTS[localSelectedId] ?? 150;
  const localFighterAds = getFighterAdProgress(playerProfile, localSelectedId);
  const isStageLocked = !isOnline && activeStageNum > playerProfile.highestStage;
  const activeStageCost = STAGE_UNLOCK_COSTS[activeStageNum] ?? 75;

  const [unlockModalFighterId, setUnlockModalFighterId] = useState<FighterId | null>(null);
  const [arcadeToast, setArcadeToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const p1CardRefs = useRef<Partial<Record<FighterId, HTMLButtonElement | null>>>({});
  const p2CardRefs = useRef<Partial<Record<FighterId, HTMLButtonElement | null>>>({});

  const showToast = (msg: string) => {
    setArcadeToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setArcadeToast(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    p1CardRefs.current[p1Id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [p1Id]);

  useEffect(() => {
    p2CardRefs.current[p2Id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [p2Id]);

  const leftTag = isHost ? '1P · YOU (HOST)' : isGuest ? '1P · HOST' : '1P · YOU';
  const rightTag = isGuest ? '2P · YOU' : isHost ? '2P · FRIEND' : 'CPU';

  return (
    <div className="safe-pad-select pointer-events-none fixed inset-0 z-30 flex h-[100dvh] w-[100dvw] flex-col justify-between overflow-hidden select-none touch-none sm:px-5 sm:py-3.5">
      {/* TOP BROADCAST HEADER */}
      <header className="pointer-events-auto mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-2">
        <div className="select-header-badge flex min-w-0 items-center gap-2 border-2 border-[#facc15] bg-[#120d0a]/90 px-3 py-1.5 shadow-[4px_4px_0_#0f0a06]">
          <span
            data-testid="select-mode-indicator"
            className={`flex shrink-0 items-center gap-1.5 px-2 py-0.5 font-display text-xs font-extrabold tracking-widest ${
              isOnline ? 'bg-[#16a34a] text-white' : 'bg-[#dc2626] text-white'
            }`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-white" aria-hidden="true" />
            {isOnline ? `ONLINE 2P · #${roomCode}` : 'VS CPU'}
          </span>
          <h1 className="select-header-title truncate font-display text-xl font-extrabold uppercase italic tracking-wider text-[#facc15] sm:text-2xl">
            SELECT FIGHTERS
          </h1>
          <span
            data-testid="select-coins-badge"
            className="hidden items-center gap-1 border-l border-white/20 pl-2.5 font-mono-num text-xs font-extrabold text-[#facc15] sm:inline-flex"
          >
            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{playerProfile.coins.toLocaleString()}</span>
          </span>
          <span className="hidden border-l border-white/20 pl-2.5 text-xs font-bold uppercase tracking-wide text-[#e7e5e4] lg:inline">
            {p1Cfg.name} vs {p2Cfg.name}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Prominent FRIEND ROOM Button */}
          <button
            type="button"
            data-testid="friend-room-btn"
            onClick={onOpenFriendRoom}
            className={`select-help-btn flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 border-2 px-3 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider shadow-[3px_3px_0_#0f0a06] transition-colors sm:text-base ${
              isOnline
                ? 'border-[#4ade80] bg-[#14532d]/92 text-[#bbf7d0] hover:bg-[#16a34a] hover:text-white'
                : 'border-[#fef08a] bg-[#dc2626] text-white hover:bg-[#ef4444]'
            }`}
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            ) : (
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            )}
            <span>{isOnline ? `ROOM #${roomCode}` : 'FRIEND ROOM'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="select-help-btn flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 border-2 border-[#facc15] bg-[#14100d]/92 px-3 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#facc15] shadow-[3px_3px_0_#0f0a06] hover:bg-[#facc15] hover:text-[#0f0a06] sm:text-base"
          >
            <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            <span className="hidden sm:inline">HOW TO PLAY</span>
            <span className="sm:hidden">HELP</span>
          </button>

          <button
            type="button"
            data-testid="select-settings-btn"
            aria-label="Settings"
            title="Settings & Test Supers"
            onClick={onOpenSettings}
            className="select-help-btn flex cursor-pointer items-center justify-center shrink-0 border-2 border-[#facc15] bg-[#14100d]/92 p-1.5 text-[#facc15] shadow-[3px_3px_0_#0f0a06] transition-colors hover:bg-[#facc15] hover:text-[#0f0a06] sm:p-2"
          >
            <Settings className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            data-testid="global-mute-btn"
            aria-label={globalMuted ? 'Unmute All Audio' : 'Mute All Audio'}
            aria-pressed={globalMuted}
            title={globalMuted ? 'Audio Muted (Click to Unmute)' : 'Mute All Audio (M)'}
            onClick={onToggleGlobalMute}
            className={`select-help-btn flex cursor-pointer items-center justify-center shrink-0 border-2 p-1.5 shadow-[3px_3px_0_#0f0a06] transition-colors sm:p-2 ${
              globalMuted
                ? 'border-[#ef4444]/85 bg-[#14100d]/92 text-[#f87171]'
                : 'border-[#facc15] bg-[#14100d]/92 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f0a06]'
            }`}
          >
            {globalMuted ? (
              <VolumeX className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
            )}
          </button>

          <FullscreenButton
            isFullscreen={isFullscreen}
            isSupported={fullscreenSupported}
            onToggle={onToggleFullscreen}
            variant="select"
          />
        </div>
      </header>

      {/* Arcade Toast Banner (e.g. Utkarsh Teaser Slot Notice) */}
      {arcadeToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="select-arcade-toast"
          className="pointer-events-none fixed top-16 left-1/2 z-40 -translate-x-1/2 border-2 border-[#facc15] bg-[#140d09]/95 px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wider text-[#fde047] shadow-[4px_4px_0_#dc2626] sm:text-base"
        >
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <Sparkles className="h-4 w-4 text-[#facc15]" aria-hidden="true" />
            <span>{arcadeToast}</span>
          </span>
        </div>
      )}

      {/* MIDDLE OPEN-CENTER ARENA SHOWCASE — Scrollable Left 1P Strip | Live 3D Face-Off | Scrollable Right CPU/2P Strip */}
      <div className="select-middle mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-stretch justify-between gap-2 py-2">
        {/* LEFT: 1P Portrait Strip (Exact 10-Slot Sequence, Vertically Scrollable) */}
        <aside
          data-testid="p1-roster-panel"
          className="select-strip pointer-events-auto flex h-full max-h-full min-h-0 w-[172px] shrink-0 flex-col border-2 border-[#facc15] bg-[#120d0a]/90 p-2 shadow-[5px_5px_0_#0f0a06] sm:w-[228px]"
        >
          <div className="select-strip-header mb-1.5 flex shrink-0 items-center justify-between gap-1 border-b border-white/15 pb-1">
            <span className="flex items-center gap-1 truncate bg-[#facc15] px-1.5 py-0.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#0f0a06]">
              {!canPickP1 && <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{leftTag}</span>
            </span>
            <span className="shrink-0 font-mono-num text-[11px] font-bold text-[#fde047]">
              HP {p1Cfg.maxHp}
            </span>
          </div>

          <div
            data-testid="p1-roster-scroll"
            className="select-strip-list select-roster-scroll flex min-h-0 flex-1 flex-col gap-1 pr-1"
          >
            {ROSTER_SLOTS.map((slot) => {
              if (slot.kind === 'coming_future') {
                return (
                  <button
                    key={slot.id}
                    type="button"
                    data-testid="p1-utkarsh-teaser-card"
                    onClick={() => showToast(slot.toastMessage)}
                    aria-label={`${slot.name} (${slot.maxHp} HP) — ${slot.badgeText}`}
                    className="select-fighter-btn flex min-h-[54px] shrink-0 cursor-pointer items-center gap-2 border-2 border-dashed border-[#f59e0b]/75 bg-gradient-to-r from-[#24190c]/95 to-[#16100b]/95 px-2 py-1 text-left transition hover:border-[#fde047]"
                  >
                    <MysterySilhouetteAvatar />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="select-fighter-name truncate font-display text-sm font-extrabold uppercase leading-tight text-[#fde047] sm:text-base">
                          {slot.shortName}
                        </span>
                        <span className="shrink-0 font-mono-num text-[9px] font-bold text-[#fcd34d]/85">
                          {slot.maxHp}
                        </span>
                      </div>
                      <div className="mt-0.5 inline-block whitespace-nowrap bg-[#f59e0b]/25 px-1 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wider text-[#fde047] sm:text-[10px]">
                        {slot.badgeText}
                      </div>
                    </div>
                  </button>
                );
              }

              const f = slot.fighter;
              const selected = f.id === p1Id;
              const locked = !isOnline && !playerProfile.unlockedFighters.includes(f.id);
              const unlockCost = FIGHTER_UNLOCK_COSTS[f.id] ?? 150;
              const requiredAds = FIGHTER_UNLOCK_ADS[f.id] ?? 0;
              const adProg = getFighterAdProgress(playerProfile, f.id);

              return (
                <button
                  key={f.id}
                  ref={(el) => {
                    p1CardRefs.current[f.id] = el;
                  }}
                  type="button"
                  data-testid={`p1-fighter-${f.id}`}
                  data-locked={locked ? 'true' : 'false'}
                  disabled={!canPickP1}
                  onClick={() => {
                    if (!canPickP1) return;
                    onSelectP1(f.id);
                    if (locked) {
                      setUnlockModalFighterId(f.id);
                    }
                  }}
                  aria-label={`Select Player 1 ${f.name} (${f.maxHp} HP)${
                    locked ? ` (Locked, ${unlockCost} coins or ${adProg.watched}/${requiredAds} ads)` : ''
                  }`}
                  aria-pressed={selected}
                  className={`select-fighter-btn flex min-h-[54px] shrink-0 items-center gap-2 border-2 px-2 py-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                    selected
                      ? 'border-[#facc15] bg-[#dc2626] shadow-[3px_3px_0_#facc15]'
                      : canPickP1
                        ? 'cursor-pointer border-white/15 bg-[#1e1814] hover:border-white/55'
                        : 'cursor-not-allowed border-white/10 bg-[#181310]/70 opacity-65'
                  }`}
                >
                  <div className="relative shrink-0">
                    <FighterPortrait
                      id={f.id}
                      alt={f.name}
                      className={`select-fighter-avatar h-10 w-10 shrink-0 border border-black/60 object-cover sm:h-11 sm:w-11 ${
                        locked ? 'grayscale opacity-70' : ''
                      }`}
                    />
                    {locked && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[#facc15]">
                        <Lock className="h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="select-fighter-name truncate font-display text-sm font-extrabold uppercase leading-tight text-white sm:text-base">
                        {SHORT_NAMES[f.id]}
                      </span>
                      <span className="shrink-0 font-mono-num text-[9px] font-bold text-[#fde047]/90">
                        {f.maxHp}
                      </span>
                    </div>
                    {locked ? (
                      <div className="select-fighter-special mt-0.5 flex items-center gap-1.5 truncate font-mono-num text-[9px] font-extrabold text-[#fef08a] sm:text-[10px]">
                        <span className="inline-flex items-center gap-0.5 text-[#facc15]">
                          <Coins className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          {unlockCost}
                        </span>
                        <span className="text-white/40">|</span>
                        <span className="inline-flex items-center gap-0.5 text-[#7dd3fc]">
                          <Tv className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          {adProg.watched}/{requiredAds}
                        </span>
                      </div>
                    ) : (
                      <div className="select-fighter-special mt-0.5 truncate text-[10px] font-semibold text-[#fef08a] sm:text-[11px]">
                        {f.special.shortLabel}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="select-strip-footer mt-1.5 shrink-0 border-t border-white/15 pt-1.5 text-[10px] leading-tight text-[#e7e5e4]">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate font-bold uppercase text-[#facc15]">{p1Cfg.name}</span>
              {!canPickP1 && (
                <span className="shrink-0 text-[9px] font-bold uppercase text-[#a8a29e]">
                  HOST PICKS
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-[#d6d3d1]">
              <strong className="text-white">[E]</strong> {p1Cfg.special.name}
            </div>
          </div>
        </aside>

        {/* CENTER: Unobstructed Live 3D Stage & Fighters Face-Off */}
        <div className="select-center-col flex min-w-0 flex-1 flex-col items-center justify-between self-stretch py-2">
          <div className="flex flex-col items-center gap-1">
            <div className="select-vs-badge inline-block -skew-x-12 border-2 border-[#0f0a06] bg-[#dc2626] px-4 py-0.5 font-display text-2xl font-extrabold italic tracking-widest text-white shadow-[4px_4px_0_#facc15] sm:text-3xl">
              <span className="inline-block skew-x-12">VS</span>
            </div>
            {isOnline && (
              <div className="border border-[#4ade80]/60 bg-[#0d1f14]/88 px-2.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#86efac] sm:text-xs">
                1P (HOST) VS 2P (FRIEND)
              </div>
            )}
          </div>

          {/* Live Nameplates sitting cleanly near the bottom of the 3D stage showcase */}
          <div className="flex w-full max-w-md items-center justify-between gap-2 px-1 sm:px-2">
            <div className="select-nameplate min-w-0 border-l-4 border-[#facc15] bg-[#120d0a]/85 px-2.5 py-1">
              <div className="select-nameplate-title truncate font-display text-base font-extrabold uppercase italic leading-none text-white sm:text-lg">
                {p1Cfg.name}
              </div>
              <div className="select-nameplate-sub truncate text-[10px] font-semibold text-[#facc15]">
                {p1Cfg.titleBadge}
              </div>
            </div>
            <div className="select-nameplate min-w-0 border-r-4 border-[#ef4444] bg-[#120d0a]/85 px-2.5 py-1 text-right">
              <div className="select-nameplate-title truncate font-display text-base font-extrabold uppercase italic leading-none text-white sm:text-lg">
                {p2Cfg.name}
              </div>
              <div className="select-nameplate-sub truncate text-[10px] font-semibold text-[#fda4af]">
                {p2Cfg.titleBadge}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CPU / 2P Portrait Strip (Exact 10-Slot Sequence, Vertically Scrollable) */}
        <aside
          data-testid="p2-roster-panel"
          className="select-strip pointer-events-auto flex h-full max-h-full min-h-0 w-[172px] shrink-0 flex-col border-2 border-[#ef4444] bg-[#120d0a]/90 p-2 shadow-[5px_5px_0_#0f0a06] sm:w-[228px]"
        >
          <div className="select-strip-header mb-1.5 flex shrink-0 items-center justify-between gap-1 border-b border-white/15 pb-1">
            <span className="shrink-0 font-mono-num text-[11px] font-bold text-[#fda4af]">
              HP {p2Cfg.maxHp}
            </span>
            <span className="flex items-center gap-1 truncate bg-[#dc2626] px-1.5 py-0.5 font-display text-xs font-extrabold uppercase tracking-wider text-white">
              {!canPickP2 && <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{rightTag}</span>
            </span>
          </div>

          <div
            data-testid="p2-roster-scroll"
            className="select-strip-list select-roster-scroll flex min-h-0 flex-1 flex-col gap-1 pr-1"
          >
            {ROSTER_SLOTS.map((slot) => {
              if (slot.kind === 'coming_future') {
                return (
                  <button
                    key={slot.id}
                    type="button"
                    data-testid="p2-utkarsh-teaser-card"
                    onClick={() => showToast(slot.toastMessage)}
                    aria-label={`${slot.name} (${slot.maxHp} HP) — ${slot.badgeText}`}
                    className="select-fighter-btn flex min-h-[54px] shrink-0 cursor-pointer flex-row-reverse items-center gap-2 border-2 border-dashed border-[#f59e0b]/75 bg-gradient-to-l from-[#24190c]/95 to-[#16100b]/95 px-2 py-1 text-right transition hover:border-[#fde047]"
                  >
                    <MysterySilhouetteAvatar />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="shrink-0 font-mono-num text-[9px] font-bold text-[#fcd34d]/85">
                          {slot.maxHp}
                        </span>
                        <span className="select-fighter-name truncate font-display text-sm font-extrabold uppercase leading-tight text-[#fde047] sm:text-base">
                          {slot.shortName}
                        </span>
                      </div>
                      <div className="mt-0.5 inline-block whitespace-nowrap bg-[#f59e0b]/25 px-1 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wider text-[#fde047] sm:text-[10px]">
                        {slot.badgeText}
                      </div>
                    </div>
                  </button>
                );
              }

              const f = slot.fighter;
              const selected = f.id === p2Id;
              return (
                <button
                  key={f.id}
                  ref={(el) => {
                    p2CardRefs.current[f.id] = el;
                  }}
                  type="button"
                  data-testid={`p2-fighter-${f.id}`}
                  disabled={!canPickP2}
                  onClick={() => {
                    if (canPickP2) onSelectP2(f.id);
                  }}
                  aria-label={`Select ${isOnline ? 'Player 2' : 'CPU Opponent'} ${f.name} (${f.maxHp} HP)`}
                  aria-pressed={selected}
                  className={`select-fighter-btn flex min-h-[54px] shrink-0 flex-row-reverse items-center gap-2 border-2 px-2 py-1 text-right transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                    selected
                      ? 'border-[#ef4444] bg-[#991b1b] shadow-[-3px_3px_0_#ef4444]'
                      : canPickP2
                        ? 'cursor-pointer border-white/15 bg-[#1e1814] hover:border-white/55'
                        : 'cursor-not-allowed border-white/10 bg-[#181310]/70 opacity-65'
                  }`}
                >
                  <FighterPortrait
                    id={f.id}
                    alt={f.name}
                    className="select-fighter-avatar h-10 w-10 shrink-0 border border-black/60 object-cover sm:h-11 sm:w-11"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="shrink-0 font-mono-num text-[9px] font-bold text-[#fda4af]/90">
                        {f.maxHp}
                      </span>
                      <span className="select-fighter-name truncate font-display text-sm font-extrabold uppercase leading-tight text-white sm:text-base">
                        {SHORT_NAMES[f.id]}
                      </span>
                    </div>
                    <div className="select-fighter-special mt-0.5 truncate text-[10px] font-semibold text-[#fecdd3] sm:text-[11px]">
                      {f.special.shortLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="select-strip-footer mt-1.5 shrink-0 border-t border-white/15 pt-1.5 text-right text-[10px] leading-tight text-[#e7e5e4]">
            <div className="flex items-center justify-between gap-1">
              {!canPickP2 ? (
                <span className="shrink-0 text-[9px] font-bold uppercase text-[#a8a29e]">
                  FRIEND PICKS
                </span>
              ) : (
                <span />
              )}
              <span className="truncate font-bold uppercase text-[#fb7185]">{p2Cfg.name}</span>
            </div>
            <div className="mt-0.5 truncate text-[#d6d3d1]">{p2Cfg.special.name}</div>
          </div>
        </aside>
      </div>

      {/* BOTTOM DOCKED CONTROL BAR: Stage Pills | CPU Difficulty (Offline only) | FIGHT! or UNLOCK CTA */}
      <footer className="select-footer pointer-events-auto mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-2 border-2 border-white/20 bg-[#120d0a]/92 px-3 py-2 shadow-[0_6px_0_#0a0705]">
        {/* Stage Compact Selector */}
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="flex shrink-0 items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-[#facc15]">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">STAGE:</span>
          </div>
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Select 3D Stage">
            {STAGE_LIST.map((st, idx) => {
              const selected = st.id === stageId;
              const stageLocked = !isOnline && idx + 1 > playerProfile.highestStage;
              return (
                <button
                  key={st.id}
                  type="button"
                  disabled={!canPickStage}
                  onClick={() => {
                    if (canPickStage) onSelectStage(st.id);
                  }}
                  aria-pressed={selected}
                  aria-label={`Stage ${idx + 1}: ${st.name}${stageLocked ? ' (Locked)' : ''}`}
                  title={`${st.name} — ${st.subtitle}`}
                  className={`select-stage-btn inline-flex shrink-0 items-center gap-1 border px-2 py-1 font-display text-xs font-extrabold uppercase tracking-wide transition-colors sm:px-2.5 sm:text-sm ${
                    selected
                      ? 'border-[#facc15] bg-[#facc15] text-[#0f0a06]'
                      : canPickStage
                        ? stageLocked
                          ? 'cursor-pointer border-white/15 bg-[#181310] text-white/60 hover:border-[#facc15]/60'
                          : 'cursor-pointer border-white/25 bg-[#1f1915] text-white hover:border-[#facc15]'
                        : 'cursor-not-allowed border-white/15 bg-[#181310] text-white/45'
                  }`}
                >
                  {stageLocked && <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  <span>{idx + 1}</span>
                </button>
              );
            })}
          </div>
          <span className="hidden max-w-[165px] truncate text-xs font-bold text-[#fde68a] xl:inline">
            {activeStage.name}
            {!isOnline && (
              <span className="ml-1.5 font-mono-num text-[10px] text-[#facc15]">
                (AI LV.{stageAiTier})
              </span>
            )}
          </span>
        </div>

        {/* CPU Difficulty Selector (Hidden in Friend Room 2P mode) */}
        {!isOnline && (
          <div
            data-testid="cpu-difficulty-selector"
            className="flex shrink-0 items-center gap-1"
            role="group"
            aria-label="CPU Difficulty"
          >
            <span className="hidden font-display text-xs font-extrabold uppercase tracking-wider text-[#a8a29e] md:inline">
              CPU:
            </span>
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDifficulty(d.id)}
                  aria-pressed={active}
                  className={`select-diff-btn cursor-pointer shrink-0 border px-2 py-1 font-display text-xs font-extrabold uppercase tracking-wider transition-colors sm:px-2.5 sm:text-sm ${
                    active
                      ? 'border-[#facc15] bg-[#facc15] text-[#0f0a06]'
                      : 'border-white/25 bg-[#1f1915] text-white hover:border-white/60'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Right Action: Dual Unlock Modal CTA (if locked) or FIGHT! Button */}
        <div className="flex shrink-0 items-center gap-2">
          {isLocalFighterLocked ? (
            <button
              type="button"
              data-testid="unlock-fighter-btn"
              onClick={() => setUnlockModalFighterId(localSelectedId)}
              aria-label={`Unlock ${p1Cfg.name} (${localFighterCost} coins or ${localFighterAds.watched}/${localFighterAds.required} ads)`}
              title={`Unlock ${p1Cfg.name} with Coins or Ads`}
              className="select-fight-btn flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 border-3 border-[#0f0a06] bg-[#facc15] px-4 py-1.5 font-display text-lg font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[4px_4px_0_#dc2626] hover:bg-[#fde047] sm:px-5 sm:text-xl"
            >
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>UNLOCK {SHORT_NAMES[localSelectedId]}</span>
            </button>
          ) : isStageLocked && canStartFight ? (
            <button
              type="button"
              data-testid="unlock-stage-btn"
              disabled={playerProfile.coins < activeStageCost}
              onClick={() => onUnlockStage(activeStageNum)}
              aria-label={`Unlock Stage ${activeStageNum} for ${activeStageCost} coins`}
              title={`Unlock Stage ${activeStageNum} for ${activeStageCost} coins`}
              className="select-fight-btn flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 border-3 border-[#0f0a06] bg-[#facc15] px-4 py-1.5 font-display text-lg font-extrabold uppercase tracking-wider text-[#0f0a06] shadow-[4px_4px_0_#dc2626] hover:bg-[#fde047] disabled:cursor-not-allowed disabled:opacity-55 sm:px-5 sm:text-xl"
            >
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>UNLOCK S{activeStageNum} ({activeStageCost})</span>
            </button>
          ) : canStartFight ? (
            <button
              type="button"
              data-start="true"
              onClick={onStartFight}
              className="select-fight-btn flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 border-3 border-[#0f0a06] bg-[#dc2626] px-6 py-1.5 font-display text-2xl font-extrabold uppercase italic tracking-wider text-white shadow-[4px_4px_0_#facc15] transition-transform hover:-translate-y-0.5 hover:bg-[#ef4444] active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white sm:px-8"
            >
              <Swords className="h-4 w-4 text-[#facc15] sm:h-5 sm:w-5" aria-hidden="true" />
              <span>FIGHT!</span>
            </button>
          ) : (
            <div
              data-testid="waiting-for-host-badge"
              className="flex items-center gap-2 whitespace-nowrap border-2 border-[#facc15]/60 bg-[#1a130e] px-4 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#fde047] sm:text-base"
            >
              <span>WAITING FOR HOST TO START...</span>
            </div>
          )}
        </div>
      </footer>

      {/* Sleek Dual Unlock Modal (Coins OR Rewarded Ads) */}
      {unlockModalFighterId && (
        <div className="pointer-events-auto">
          <UnlockFighterModal
            fighterId={unlockModalFighterId}
            playerProfile={playerProfile}
            onUnlockWithCoins={onUnlockFighter}
            onWatchRewardedAd={onWatchAdUnlock}
            onClose={() => setUnlockModalFighterId(null)}
          />
        </div>
      )}
    </div>
  );
}
