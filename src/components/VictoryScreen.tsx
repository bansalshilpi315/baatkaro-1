import { RotateCcw, Users } from 'lucide-react';
import { FIGHTER_CONFIGS, getFighterPortraitDataUrl, STAGE_CONFIGS } from '../game/characters';
import type { MatchResultSnapshot } from '../game/types';

interface VictoryScreenProps {
  result: MatchResultSnapshot;
  onRematch: () => void;
  onCharacterSelect: () => void;
}

export function VictoryScreen({
  result,
  onRematch,
  onCharacterSelect,
}: VictoryScreenProps) {
  const winnerCfg =
    result.winnerSlot === 0
      ? FIGHTER_CONFIGS[result.p1Id]
      : result.winnerSlot === 1
        ? FIGHTER_CONFIGS[result.p2Id]
        : null;
  const stageCfg = STAGE_CONFIGS[result.stageId];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-jumla-title"
      className="safe-pad-modal pointer-events-none fixed inset-0 z-30 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden select-none touch-none sm:justify-end sm:p-7"
    >
      {/* Authentic Indian Newspaper Front Page anchored right so 3D winner celebrates on left */}
      <article className="pointer-events-auto relative max-h-[92dvh] w-full max-w-lg overflow-y-auto touch-pan-y border-4 border-[#1c1917] bg-[#f6f0e1] text-[#1c1917] shadow-[10px_10px_0_#0f0a06]">
        {/* Newspaper Masthead */}
        <div className="border-b-4 border-double border-[#1c1917] px-5 pt-3 pb-2 text-center">
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#57534e]">
            <span>VOL. 99 · LATE NIGHT EDITION</span>
            <span>PRICE: 1 CUTTING CHAI</span>
          </div>
          <h1
            id="daily-jumla-title"
            className="mt-0.5 font-display text-4xl font-extrabold uppercase tracking-[0.14em] text-[#110b08] sm:text-5xl"
          >
            THE DAILY JUMLA
          </h1>
          <div className="mt-1 flex items-center justify-between border-t border-[#1c1917] pt-1 text-[10px] font-extrabold uppercase tracking-wider text-[#7f1d1d]">
            <span>{stageCfg.name} BUREAU</span>
            <span>{result.finishReason === 'ko' ? 'KNOCKOUT EXTRA' : 'TIME-UP VERDICT'}</span>
            <span>TRP: 999%</span>
          </div>
        </div>

        {/* Front Page Body with Bold Tilted Red Ink Stamp */}
        <div className="relative px-5 py-4">
          {/* Tilted Red Outcome Stamp */}
          <div
            data-testid="newspaper-stamp"
            className="pointer-events-none absolute right-4 top-2 -rotate-12 border-4 border-[#dc2626] bg-[#f6f0e1]/90 px-3 py-0.5 font-display text-2xl font-extrabold uppercase tracking-widest text-[#dc2626] sm:text-3xl"
          >
            {result.stampText}
          </div>

          <h2 className="pr-24 font-display text-2xl font-extrabold uppercase leading-tight text-[#110b08] sm:text-3xl">
            {result.headline}
          </h2>

          {/* Photo + 2-Sentence Satirical Match Report */}
          <div className="mt-3 flex items-start gap-3.5 border-y-2 border-[#1c1917]/30 py-3">
            {winnerCfg && (
              <div className="shrink-0">
                <img
                  src={getFighterPortraitDataUrl(winnerCfg.id)}
                  alt={winnerCfg.name}
                  className="h-20 w-20 border-2 border-[#1c1917] object-cover"
                />
                <div className="mt-1 bg-[#1c1917] px-1 py-0.5 text-center font-display text-[10px] font-extrabold uppercase tracking-wider text-[#f6f0e1]">
                  {winnerCfg.name}
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-[#b91c1c]">
                &ldquo;{result.subheadline}&rdquo;
              </p>
              <p
                data-testid="satirical-report"
                className="text-xs leading-relaxed text-[#292524] sm:text-[13px]"
              >
                {result.reportParagraph}
              </p>
            </div>
          </div>

          {/* Match Stats Strip */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="border border-[#1c1917]/35 bg-[#eae0c8] p-1.5">
              <div className="text-[10px] font-bold uppercase text-[#57534e]">Time Left</div>
              <div className="font-mono-num text-base font-bold text-[#110b08]">
                {result.timeRemaining}s
              </div>
            </div>
            <div className="border border-[#1c1917]/35 bg-[#eae0c8] p-1.5">
              <div className="text-[10px] font-bold uppercase text-[#57534e]">Max Combo</div>
              <div className="font-mono-num text-base font-bold text-[#110b08]">
                {result.p1MaxCombo}x
              </div>
            </div>
            <div className="border border-[#1c1917]/35 bg-[#eae0c8] p-1.5">
              <div className="text-[10px] font-bold uppercase text-[#57534e]">P1 Damage</div>
              <div className="font-mono-num text-base font-bold text-[#110b08]">
                {result.p1DamageDealt}
              </div>
            </div>
            <div className="border border-[#1c1917]/35 bg-[#eae0c8] p-1.5">
              <div className="text-[10px] font-bold uppercase text-[#57534e]">Specials</div>
              <div className="font-mono-num text-base font-bold text-[#110b08]">
                {result.p1SpecialsLanded}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onRematch}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border-2 border-[#110b08] bg-[#dc2626] px-5 py-2.5 font-display text-xl font-extrabold uppercase italic tracking-wider text-white shadow-[4px_4px_0_#110b08] hover:bg-[#b91c1c]"
            >
              <RotateCcw className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
              <span>REMATCH</span>
            </button>
            <button
              type="button"
              onClick={onCharacterSelect}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border-2 border-[#110b08] bg-[#facc15] px-5 py-2.5 font-display text-xl font-extrabold uppercase tracking-wider text-[#110b08] shadow-[4px_4px_0_#110b08] hover:bg-[#fde047]"
            >
              <Users className="h-5 w-5" aria-hidden="true" />
              <span>CHARACTER SELECT</span>
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
