import { Check, Volume2, VolumeX, Zap } from 'lucide-react';
import { FIGHTER_CONFIGS, FIGHTER_LIST } from '../game/characters';
import type { FighterId, FloatingCallout, SuperBannerInfo } from '../game/types';
import { FighterPortrait } from './FighterPortrait';

interface SuperPreviewBarProps {
  activeFighterId: FighterId;
  isSuperPlaying: boolean;
  globalMuted: boolean;
  superBanner: SuperBannerInfo | null;
  callouts: FloatingCallout[];
  onSwitchFighter: (id: FighterId) => void;
  onTriggerSuper: () => void;
  onToggleGlobalMute: () => void;
  onSelectAndBack: () => void;
}

const CHIP_SHORT_NAMES: Record<FighterId, string> = {
  sheru: 'SHERU',
  billa: 'BILLA',
  neta: 'NETA',
  anda: 'ANDA',
  mausi: 'MAUSI',
  father: 'PRINCIPAL',
  samyak: 'SAMYAK',
  adi: 'ADI',
  krish: 'KRISH',
};

export function SuperPreviewBar({
  activeFighterId,
  isSuperPlaying,
  globalMuted,
  superBanner,
  callouts,
  onSwitchFighter,
  onTriggerSuper,
  onToggleGlobalMute,
  onSelectAndBack,
}: SuperPreviewBarProps) {
  const cfg = FIGHTER_CONFIGS[activeFighterId];

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex h-[100dvh] w-[100dvw] flex-col justify-between overflow-hidden select-none touch-none">
      {/* TOP COMPACT PREVIEW HEADER (Auto-hides cleanly while Super cinematic plays) */}
      <header
        className={`safe-pad-hud-top flex w-full items-start justify-between px-3 pt-2 transition-all duration-250 sm:px-5 ${
          isSuperPlaying ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="flex items-center gap-2 border-2 border-[#facc15] bg-[#120d0a]/90 px-3 py-1 shadow-[4px_4px_0_#0a0705]">
          <span className="flex items-center gap-1 bg-[#facc15] px-1.5 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wider text-[#0f0a06]">
            <Zap className="h-3 w-3 fill-[#0f0a06]" aria-hidden="true" />
            SUPER LAB
          </span>
          <span className="font-display text-sm font-extrabold uppercase italic tracking-wide text-white sm:text-base">
            {cfg.name}
          </span>
          <span className="hidden border-l border-white/20 pl-2 font-display text-xs font-extrabold uppercase tracking-wider text-[#fde047] sm:inline">
            {cfg.superName}!
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden border border-white/20 bg-[#120d0a]/85 px-2.5 py-1 font-mono-num text-[11px] font-bold uppercase tracking-wider text-[#fde68a] sm:block">
            HP {cfg.maxHp} · MAX SUPER DMG 33%
          </div>
          <button
            type="button"
            data-testid="global-mute-btn"
            onClick={onToggleGlobalMute}
            aria-label={globalMuted ? 'Unmute All Audio' : 'Mute All Audio'}
            aria-pressed={globalMuted}
            title={globalMuted ? 'Audio Muted (Click to Unmute)' : 'Mute All Audio (M)'}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center border-2 transition-colors ${
              globalMuted
                ? 'border-[#ef4444]/85 bg-[#14100d]/90 text-[#f87171]'
                : 'border-[#facc15] bg-[#14100d]/90 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f0a06]'
            }`}
          >
            {globalMuted ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* FLOATING SIGNATURE SUPER POP-UPS DURING PREVIEW */}
      {callouts.map((c) => (
        <div
          key={c.id}
          style={{
            left: `${c.screenX}px`,
            top: `${c.screenY}px`,
            color: c.color,
          }}
          className={`pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-1/2 text-center font-display font-extrabold uppercase italic tracking-wider drop-shadow-[0_4px_0_#0f0a06] ${
            c.isSignature
              ? 'max-w-[92vw] px-3 text-xl leading-tight sm:text-3xl [-webkit-text-stroke:1.4px_#0f0a06]'
              : 'text-2xl sm:text-3xl [-webkit-text-stroke:1.2px_#0f0a06]'
          }`}
        >
          {c.text}
        </div>
      ))}

      {/* HORIZONTAL SUPER ACTIVATION BANNER DURING ACTIVE PREVIEW SUPER */}
      {superBanner && (
        <div
          data-testid="preview-super-banner"
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 border-y-2 border-[#facc15] bg-gradient-to-r from-[#0a0705]/95 via-[#1c1309]/92 to-[#0a0705]/95 px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.85)] sm:bottom-6 sm:px-8 sm:py-2.5"
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden border-2 border-[#facc15] bg-[#14100d] sm:h-14 sm:w-14">
              <FighterPortrait
                id={superBanner.fighterId}
                alt={superBanner.fighterName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#facc15] sm:text-xs">
                {superBanner.fighterName} · SUPER POWER
              </div>
              <div className="truncate font-display text-2xl font-extrabold uppercase italic leading-none tracking-wider text-white sm:text-3xl">
                {superBanner.superName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPACT BOTTOM SANDBOX BAR (Auto-hides smoothly while Super is playing) */}
      <footer
        data-testid="super-preview-bar"
        aria-hidden={isSuperPlaying}
        className={`safe-pad-select mx-auto w-full max-w-6xl px-2 pb-2 transition-all duration-250 sm:px-4 sm:pb-3 ${
          isSuperPlaying
            ? 'pointer-events-none translate-y-6 opacity-0'
            : 'pointer-events-auto translate-y-0 opacity-100'
        }`}
      >
        <div className="flex flex-col gap-1.5 border-2 border-[#facc15]/85 bg-[#120d0a]/92 px-2.5 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.8)] backdrop-blur-sm">
          {/* Row 1: All 9 Fighter Quick-Select Chips */}
          <div
            className="grid grid-cols-3 gap-1 sm:grid-cols-9"
            role="group"
            aria-label="Preview fighter selector"
          >
            {FIGHTER_LIST.map((f) => {
              const selected = f.id === activeFighterId;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={isSuperPlaying}
                  onClick={() => onSwitchFighter(f.id)}
                  aria-pressed={selected}
                  aria-label={`Preview ${f.name}`}
                  className={`flex cursor-pointer items-center justify-center gap-1 border px-1 py-1 transition-all sm:gap-1.5 sm:px-2 sm:py-1.5 ${
                    selected
                      ? 'border-[#facc15] bg-[#dc2626] text-white shadow-[2px_2px_0_#facc15]'
                      : 'border-white/20 bg-[#1e1814] text-[#e7e5e4] hover:border-[#facc15]/70'
                  }`}
                >
                  <FighterPortrait
                    id={f.id}
                    alt={f.name}
                    className="h-6 w-6 shrink-0 border border-black/60 object-cover sm:h-7 sm:w-7"
                  />
                  <span className="truncate font-display text-[10px] font-extrabold uppercase tracking-wide sm:text-xs">
                    {CHIP_SHORT_NAMES[f.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Glowing TRIGGER SUPER + SELECT THIS FIGHTER & BACK */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              data-testid="preview-trigger-super-btn"
              disabled={isSuperPlaying}
              onClick={onTriggerSuper}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-2 border-[#fef08a] bg-gradient-to-b from-[#fde047] via-[#f59e0b] to-[#d97706] px-3 py-1.5 font-display text-sm font-extrabold uppercase italic tracking-wider text-[#1a0f04] shadow-[0_0_20px_rgba(250,204,21,0.45),3px_3px_0_#0f0a06] transition hover:brightness-110 active:translate-y-0.5 sm:py-2 sm:text-lg"
            >
              <Zap className="h-4 w-4 fill-[#1a0f04] stroke-[#1a0f04] sm:h-5 sm:w-5" aria-hidden="true" />
              <span>TRIGGER SUPER</span>
            </button>

            <button
              type="button"
              data-testid="preview-select-back-btn"
              disabled={isSuperPlaying}
              onClick={onSelectAndBack}
              className="flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border-2 border-[#4ade80] bg-[#14532d]/90 px-3 py-1.5 font-display text-xs font-extrabold uppercase tracking-wider text-[#ecfdf5] shadow-[3px_3px_0_#0f0a06] transition hover:bg-[#166534] active:translate-y-0.5 sm:px-4 sm:py-2 sm:text-sm"
            >
              <Check className="h-4 w-4 stroke-[2.6] text-[#4ade80]" aria-hidden="true" />
              <span>SELECT THIS FIGHTER &amp; BACK</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
