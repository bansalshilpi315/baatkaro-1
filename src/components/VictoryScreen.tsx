import { RotateCcw, Users } from 'lucide-react';
import { getWinRatePercent, type CareerStats } from '../game/careerStats';
import { FIGHTER_CONFIGS } from '../game/characters';
import type { MatchResultSnapshot } from '../game/types';
import { FighterPortrait } from './FighterPortrait';

interface VictoryScreenProps {
  result: MatchResultSnapshot;
  careerStats: CareerStats;
  onRematch: () => void;
  onCharacterSelect: () => void;
}

function formatTodayEditionDate(): string {
  const now = new Date();
  return now
    .toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();
}

export function VictoryScreen({
  result,
  careerStats,
  onRematch,
  onCharacterSelect,
}: VictoryScreenProps) {
  const winRate = getWinRatePercent(careerStats);
  const winnerCfg =
    result.winnerSlot === 0
      ? FIGHTER_CONFIGS[result.p1Id]
      : result.winnerSlot === 1
        ? FIGHTER_CONFIGS[result.p2Id]
        : FIGHTER_CONFIGS[result.p1Id];

  const isPlayerWin = result.winnerSlot === 0;
  const isDraw = result.winnerSlot === 'draw';
  const editionDate = formatTodayEditionDate();

  const announcementTitle = isDraw
    ? 'MATCH TIED!'
    : `${winnerCfg.name.toUpperCase()} WINS!`;

  const announcementEyebrow = isDraw
    ? 'FINAL VERDICT · DRAW'
    : isPlayerWin
      ? 'P1 VICTORY · BEST OF 3'
      : 'CPU VICTORY · BEST OF 3';

  const stampColorClass = isDraw
    ? 'border-[#b45309] text-[#b45309]'
    : isPlayerWin
      ? 'border-[#15803d] text-[#15803d]'
      : 'border-[#dc2626] text-[#dc2626]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="breaking-bakwas-masthead"
      data-testid="victory-screen"
      className="safe-pad-modal fixed inset-0 z-30 flex h-[100dvh] w-[100dvw] items-center justify-center overflow-hidden bg-black/62 backdrop-blur-[1.5px] select-none touch-none"
    >
      {/* 2-Column Arcade Victory / Game Over Layout over Darkened 3D Arena */}
      <div className="victory-layout mx-auto flex w-full max-w-5xl items-center justify-center gap-6 px-4 sm:gap-10 sm:px-6">
        {/* ===============================================================
            LEFT COLUMN: SLIGHTLY TILTED OFF-WHITE NEWSPAPER CARD
            =============================================================== */}
        <article
          data-testid="breaking-bakwas-paper"
          className="victory-paper relative w-full max-w-[430px] -rotate-[1.5deg] border-2 border-[#231d18] bg-[#f5efe0] px-5 py-4 text-[#191512] shadow-[0_18px_45px_rgba(0,0,0,0.75),6px_6px_0_rgba(17,11,8,0.85)]"
        >
          {/* Thin Double Rules + Bold Serif Masthead */}
          <header className="border-y-[3px] border-double border-[#1c1917] py-1.5 text-center">
            <h1
              id="breaking-bakwas-masthead"
              className="victory-masthead whitespace-nowrap font-serif-news text-[1.75rem] font-black uppercase tracking-[0.05em] text-[#14110e] sm:text-[2.1rem]"
            >
              BREAKING BAKWAS
            </h1>
          </header>

          {/* Sub-Header: Today's Date + PRICE ₹5 · SATIRE EDITION */}
          <div className="victory-submeta mt-1 flex items-center justify-between border-b border-[#1c1917]/75 pb-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#44403c] sm:text-[11px]">
            <span>{editionDate}</span>
            <span>PRICE ₹5 · SATIRE EDITION</span>
          </div>

          {/* Dynamic Satirical Headline + Best-of-3 Score */}
          <div className="mt-2.5">
            <h2
              data-testid="newspaper-headline"
              className="victory-headline font-serif-news text-xl font-black uppercase leading-tight text-[#120e0b] sm:text-2xl"
            >
              {result.headline}
            </h2>
            <p
              data-testid="newspaper-score"
              className="victory-score mt-1 font-display text-xs font-extrabold uppercase tracking-wider text-[#991b1b] sm:text-sm"
            >
              {result.scoreSummary}
            </p>
            <p
              data-testid="satirical-report"
              className="victory-quote mt-1.5 border-l-2 border-[#1c1917]/40 pl-2.5 text-xs italic leading-snug text-[#292524] sm:text-[13px]"
            >
              {result.loserQuote}
            </p>
          </div>

          {/* Bottom Row: Grayscale/Sepia Winner Portrait (Left) + Tilted Rubber Stamp (Right) */}
          <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#1c1917]/30 pt-2.5">
            <div className="flex items-end gap-2.5">
              <div className="shrink-0 bg-[#ebe2cc] p-1 shadow-[2px_2px_0_rgba(28,25,23,0.35)]">
                <FighterPortrait
                  id={winnerCfg.id}
                  alt={winnerCfg.name}
                  className="victory-portrait h-20 w-20 border border-[#1c1917] object-cover grayscale sepia-[0.38] contrast-[1.08]"
                />
              </div>
              <div className="pb-0.5">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#57534e]">
                  {isDraw ? 'FEATURED' : 'FRONT PAGE STAR'}
                </div>
                <div className="font-display text-sm font-extrabold uppercase tracking-wide text-[#191512]">
                  {winnerCfg.name}
                </div>
              </div>
            </div>

            {/* Tilted Bold Rubber Stamp: Green YOU WIN! / Red YOU LOSE! */}
            <div
              data-testid="newspaper-stamp"
              className={`victory-stamp shrink-0 -rotate-12 border-[3px] bg-[#f5efe0]/85 px-3 py-1 font-display text-2xl font-extrabold uppercase tracking-widest shadow-[inset_0_0_0_1px_currentColor] sm:text-3xl ${stampColorClass}`}
            >
              {result.stampText}
            </div>
          </div>
        </article>

        {/* ===============================================================
            RIGHT COLUMN: WINNER ANNOUNCEMENT + ACTION PANEL
            =============================================================== */}
        <aside className="victory-action-col flex w-full max-w-[300px] flex-col items-stretch gap-3.5 text-left">
          <div>
            <div className="font-display text-xs font-extrabold uppercase tracking-[0.22em] text-[#facc15] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] sm:text-sm">
              {announcementEyebrow}
            </div>
            <h2 className="victory-winner-title news-stroke mt-0.5 font-display text-4xl font-extrabold uppercase italic leading-[0.98] tracking-wide text-white sm:text-5xl">
              {announcementTitle}
            </h2>
            <div className="mt-1.5 flex items-center gap-2 font-mono-num text-xs font-bold uppercase tracking-wider text-white/80">
              <span>
                ROUNDS {result.p1RoundsWon} - {result.p2RoundsWon}
              </span>
              <span className="text-[#facc15]">·</span>
              <span>{result.finishReason === 'ko' ? 'KNOCKOUT' : 'TIME UP'}</span>
            </div>

            {/* Subtle Persisted Career Stats Counter */}
            <div
              data-testid="career-stats-counter"
              aria-label={`Career stats: ${careerStats.wins} wins, ${careerStats.losses} losses${careerStats.draws > 0 ? `, ${careerStats.draws} draws` : ''}`}
              className="mt-2 flex items-center justify-between gap-2 rounded border border-white/15 bg-black/45 px-2.5 py-1 font-mono-num text-[11px] font-bold uppercase tracking-wider text-white/75 backdrop-blur-xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[#facc15]/85">CAREER</span>
                <span className="text-white/30">|</span>
                <span className="text-[#86efac]">{careerStats.wins}W</span>
                <span className="text-white/35">-</span>
                <span className="text-[#fca5a5]">{careerStats.losses}L</span>
                {careerStats.draws > 0 && (
                  <>
                    <span className="text-white/35">-</span>
                    <span className="text-[#fde68a]">{careerStats.draws}D</span>
                  </>
                )}
              </div>
              <span className="text-white/60">
                {careerStats.currentStreak >= 2
                  ? `${careerStats.currentStreak} STREAK`
                  : `${winRate}% WIN`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Glossy Vibrant Orange-Gold REMATCH Button */}
            <button
              type="button"
              data-start="true"
              data-testid="victory-rematch-btn"
              onClick={onRematch}
              className="victory-cta-btn relative flex w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-lg border-2 border-[#fef08a] bg-gradient-to-b from-[#fde047] via-[#f59e0b] to-[#d97706] px-6 py-3 font-display text-2xl font-extrabold uppercase italic tracking-wider text-[#1a0f04] shadow-[0_8px_24px_rgba(245,158,11,0.45),inset_0_2px_2px_rgba(255,255,255,0.65)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <RotateCcw className="h-5 w-5 stroke-[2.6]" aria-hidden="true" />
              <span>REMATCH</span>
            </button>

            {/* Dark Gold-Bordered CHARACTER SELECT Button */}
            <button
              type="button"
              data-testid="victory-select-btn"
              onClick={onCharacterSelect}
              className="victory-cta-btn flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border-2 border-[#facc15]/85 bg-[#14100c]/90 px-6 py-3 font-display text-xl font-extrabold uppercase tracking-wider text-[#fef3c7] shadow-[0_6px_18px_rgba(0,0,0,0.6)] backdrop-blur-sm transition hover:border-[#fef08a] hover:bg-[#231b13] active:scale-[0.98]"
            >
              <Users className="h-5 w-5 text-[#facc15]" aria-hidden="true" />
              <span>CHARACTER SELECT</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
