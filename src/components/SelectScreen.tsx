import { HelpCircle, MapPin, Swords, Users } from 'lucide-react';
import { FIGHTER_CONFIGS, FIGHTER_LIST, getFighterPortraitDataUrl, STAGE_CONFIGS, STAGE_LIST } from '../game/characters';
import type { Difficulty, FighterId, StageId } from '../game/types';
import { FullscreenButton } from './FullscreenButton';

interface SelectScreenProps {
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  difficulty: Difficulty;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  onSelectP1: (id: FighterId) => void;
  onSelectP2: (id: FighterId) => void;
  onSelectStage: (id: StageId) => void;
  onSelectDifficulty: (d: Difficulty) => void;
  onToggleFullscreen: () => void;
  onOpenHowToPlay: () => void;
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
  neta: 'NETA',
  anda: 'ANDA',
  mausi: 'MAUSI',
};

export function SelectScreen({
  p1Id,
  p2Id,
  stageId,
  difficulty,
  isFullscreen,
  fullscreenSupported,
  onSelectP1,
  onSelectP2,
  onSelectStage,
  onSelectDifficulty,
  onToggleFullscreen,
  onOpenHowToPlay,
  onStartFight,
}: SelectScreenProps) {
  const p1Cfg = FIGHTER_CONFIGS[p1Id];
  const p2Cfg = FIGHTER_CONFIGS[p2Id];
  const activeStage = STAGE_CONFIGS[stageId];

  return (
    <div className="safe-pad-select pointer-events-none fixed inset-0 z-30 flex h-[100dvh] w-[100dvw] flex-col justify-between overflow-hidden select-none touch-none sm:px-5 sm:py-3.5">
      {/* TOP BROADCAST HEADER */}
      <header className="pointer-events-auto mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-2">
        <div className="select-header-badge flex items-center gap-2.5 border-2 border-[#facc15] bg-[#120d0a]/90 px-3 py-1.5 shadow-[4px_4px_0_#0f0a06]">
          <span className="flex items-center gap-1.5 bg-[#dc2626] px-2 py-0.5 font-display text-xs font-extrabold tracking-widest text-white">
            <span className="inline-block h-2 w-2 rounded-full bg-white" aria-hidden="true" />
            LIVE
          </span>
          <h1 className="select-header-title font-display text-xl font-extrabold uppercase italic tracking-wider text-[#facc15] sm:text-2xl">
            SELECT FIGHTERS
          </h1>
          <span className="hidden border-l border-white/20 pl-2.5 text-xs font-bold uppercase tracking-wide text-[#e7e5e4] md:inline">
            {p1Cfg.name} vs {p2Cfg.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="select-help-btn flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 border-2 border-[#facc15] bg-[#14100d]/92 px-3.5 py-1.5 font-display text-sm font-extrabold uppercase tracking-wider text-[#facc15] shadow-[3px_3px_0_#0f0a06] hover:bg-[#facc15] hover:text-[#0f0a06] sm:text-base"
          >
            <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            <span>? HOW TO PLAY</span>
          </button>

          <FullscreenButton
            isFullscreen={isFullscreen}
            isSupported={fullscreenSupported}
            onToggle={onToggleFullscreen}
            variant="select"
          />
        </div>
      </header>

      {/* MIDDLE OPEN-CENTER ARENA SHOWCASE — Left 1P Strip | Live 3D Face-Off | Right CPU Strip */}
      <div className="select-middle mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-between gap-2 py-2">
        {/* LEFT: 1P · YOU Portrait Strip */}
        <aside className="select-strip pointer-events-auto flex w-[132px] shrink-0 flex-col border-2 border-[#facc15] bg-[#120d0a]/90 p-2 shadow-[5px_5px_0_#0f0a06] sm:w-[168px]">
          <div className="select-strip-header mb-1.5 flex items-center justify-between border-b border-white/15 pb-1">
            <span className="bg-[#facc15] px-1.5 py-0.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#0f0a06]">
              1P · YOU
            </span>
            <span className="font-mono-num text-[11px] font-bold text-[#fde047]">
              HP {p1Cfg.maxHp}
            </span>
          </div>

          <div className="select-strip-list flex flex-col gap-1.5">
            {FIGHTER_LIST.map((f) => {
              const selected = f.id === p1Id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectP1(f.id)}
                  aria-label={`Select Player 1 ${f.name}`}
                  aria-pressed={selected}
                  className={`select-fighter-btn flex cursor-pointer items-center gap-2 border-2 px-1.5 py-1 text-left transition-transform focus-visible:outline-2 focus-visible:outline-white ${
                    selected
                      ? 'translate-x-1 border-[#facc15] bg-[#dc2626] shadow-[3px_3px_0_#facc15]'
                      : 'border-white/15 bg-[#1e1814] hover:border-white/55'
                  }`}
                >
                  <img
                    src={getFighterPortraitDataUrl(f.id)}
                    alt={f.name}
                    className="select-fighter-avatar h-9 w-9 shrink-0 border border-black/60 object-cover sm:h-10 sm:w-10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="select-fighter-name truncate font-display text-sm font-extrabold uppercase leading-none text-white sm:text-base">
                      {SHORT_NAMES[f.id]}
                    </div>
                    <div className="select-fighter-special mt-0.5 truncate text-[10px] font-semibold text-[#fef08a]">
                      {f.special.shortLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="select-strip-footer mt-2 border-t border-white/15 pt-1.5 text-[10px] leading-tight text-[#e7e5e4]">
            <div className="font-bold uppercase text-[#facc15]">{p1Cfg.name}</div>
            <div className="mt-0.5 text-[#d6d3d1]">
              <strong className="text-white">[B]</strong> {p1Cfg.special.name}
            </div>
          </div>
        </aside>

        {/* CENTER: Unobstructed Live 3D Stage & Fighters Face-Off */}
        <div className="select-center-col flex min-w-0 flex-1 flex-col items-center justify-between self-stretch py-2">
          <div className="select-vs-badge inline-block -skew-x-12 border-2 border-[#0f0a06] bg-[#dc2626] px-4 py-0.5 font-display text-2xl font-extrabold italic tracking-widest text-white shadow-[4px_4px_0_#facc15] sm:text-3xl">
            <span className="inline-block skew-x-12">VS</span>
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

        {/* RIGHT: CPU Portrait Strip */}
        <aside className="select-strip pointer-events-auto flex w-[132px] shrink-0 flex-col border-2 border-[#ef4444] bg-[#120d0a]/90 p-2 shadow-[5px_5px_0_#0f0a06] sm:w-[168px]">
          <div className="select-strip-header mb-1.5 flex items-center justify-between border-b border-white/15 pb-1">
            <span className="font-mono-num text-[11px] font-bold text-[#fda4af]">
              HP {p2Cfg.maxHp}
            </span>
            <span className="bg-[#dc2626] px-1.5 py-0.5 font-display text-xs font-extrabold uppercase tracking-wider text-white">
              CPU
            </span>
          </div>

          <div className="select-strip-list flex flex-col gap-1.5">
            {FIGHTER_LIST.map((f) => {
              const selected = f.id === p2Id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectP2(f.id)}
                  aria-label={`Select CPU Opponent ${f.name}`}
                  aria-pressed={selected}
                  className={`select-fighter-btn flex cursor-pointer flex-row-reverse items-center gap-2 border-2 px-1.5 py-1 text-right transition-transform focus-visible:outline-2 focus-visible:outline-white ${
                    selected
                      ? '-translate-x-1 border-[#ef4444] bg-[#991b1b] shadow-[-3px_3px_0_#ef4444]'
                      : 'border-white/15 bg-[#1e1814] hover:border-white/55'
                  }`}
                >
                  <img
                    src={getFighterPortraitDataUrl(f.id)}
                    alt={f.name}
                    className="select-fighter-avatar h-9 w-9 shrink-0 border border-black/60 object-cover sm:h-10 sm:w-10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="select-fighter-name truncate font-display text-sm font-extrabold uppercase leading-none text-white sm:text-base">
                      {SHORT_NAMES[f.id]}
                    </div>
                    <div className="select-fighter-special mt-0.5 truncate text-[10px] font-semibold text-[#fecdd3]">
                      {f.special.shortLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="select-strip-footer mt-2 border-t border-white/15 pt-1.5 text-right text-[10px] leading-tight text-[#e7e5e4]">
            <div className="font-bold uppercase text-[#fb7185]">{p2Cfg.name}</div>
            <div className="mt-0.5 text-[#d6d3d1]">{p2Cfg.special.name}</div>
          </div>
        </aside>
      </div>

      {/* BOTTOM DOCKED CONTROL BAR: Stage Pills (1-5) | Difficulty Pills | FIGHT! CTA */}
      <footer className="select-footer pointer-events-auto mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-2 border-2 border-white/20 bg-[#120d0a]/92 px-3 py-2 shadow-[0_6px_0_#0a0705]">
        {/* Stage 1-5 Compact Selector */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="flex shrink-0 items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-[#facc15]">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">STAGE:</span>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Select 3D Stage">
            {STAGE_LIST.map((st, idx) => {
              const selected = st.id === stageId;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSelectStage(st.id)}
                  aria-pressed={selected}
                  aria-label={`Stage ${idx + 1}: ${st.name}`}
                  title={`${st.name} — ${st.subtitle}`}
                  className={`select-stage-btn cursor-pointer border px-2.5 py-1 font-display text-xs font-extrabold uppercase tracking-wide transition-colors sm:text-sm ${
                    selected
                      ? 'border-[#facc15] bg-[#facc15] text-[#0f0a06]'
                      : 'border-white/25 bg-[#1f1915] text-white hover:border-[#facc15]'
                  }`}
                >
                  {idx + 1}
                  <span className="hidden xl:inline"> · {st.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
          <span className="hidden max-w-[160px] truncate text-xs font-bold text-[#fde68a] lg:inline">
            {activeStage.name}
          </span>
        </div>

        {/* CPU Difficulty Compact Selector */}
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="CPU Difficulty">
          <span className="font-display text-xs font-extrabold uppercase tracking-wider text-[#a8a29e]">
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
                className={`select-diff-btn cursor-pointer border px-2.5 py-1 font-display text-xs font-extrabold uppercase tracking-wider transition-colors sm:text-sm ${
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

        {/* Right Actions: Disabled 2P Coming Soon + Bold FIGHT! Button */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled
            title="Online / Local 2P coming in Phase 2"
            className="hidden cursor-not-allowed items-center gap-1.5 border border-white/15 bg-[#1c1917] px-2.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-[#78716c] lg:flex"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>2P SOON</span>
          </button>

          <button
            type="button"
            data-start="true"
            onClick={onStartFight}
            className="select-fight-btn flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 border-3 border-[#0f0a06] bg-[#dc2626] px-6 py-1.5 font-display text-2xl font-extrabold uppercase italic tracking-wider text-white shadow-[4px_4px_0_#facc15] transition-transform hover:-translate-y-0.5 hover:bg-[#ef4444] active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white sm:px-8"
          >
            <Swords className="h-4 w-4 text-[#facc15] sm:h-5 sm:w-5" aria-hidden="true" />
            <span>FIGHT!</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
