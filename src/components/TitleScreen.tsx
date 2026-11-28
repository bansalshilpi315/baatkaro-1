import { useEffect } from 'react';
import { Music, Settings, Volume2, VolumeX } from 'lucide-react';
import { FullscreenButton } from './FullscreenButton';
import { GameLogoBadge } from './GameLogoBadge';

interface TitleScreenProps {
  globalMuted: boolean;
  musicMuted: boolean;
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  modalOpen?: boolean;
  onStart: () => void;
  onOpenSettings: () => void;
  onToggleGlobalMute: () => void;
  onToggleMusic: () => void;
  onToggleFullscreen: () => void;
  onOpenHowToPlay: () => void;
  onOpenSatireNotice: () => void;
  onOpenAbout: () => void;
}

export function TitleScreen({
  globalMuted,
  musicMuted,
  isFullscreen,
  fullscreenSupported,
  modalOpen = false,
  onStart,
  onOpenSettings,
  onToggleGlobalMute,
  onToggleMusic,
  onToggleFullscreen,
  onOpenHowToPlay,
  onOpenSatireNotice,
  onOpenAbout,
}: TitleScreenProps) {
  useEffect(() => {
    if (modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart, modalOpen]);

  const effectiveMusicMuted = globalMuted || musicMuted;

  return (
    <div className="safe-pad-screen pointer-events-none fixed inset-0 z-20 flex h-[100dvh] w-[100dvw] flex-col justify-between overflow-hidden select-none touch-none sm:p-7">
      {/* Top Bar: Official Logo Emblem + Live Arena Badge (Left) & Settings / Audio / Fullscreen Toggles (Right) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <GameLogoBadge
            testId="title-logo-emblem"
            shape="rounded"
            variant="corner"
            sizeClass="h-9 w-9 sm:h-11 sm:w-11"
          />
          <div className="flex items-center gap-2 bg-[#dc2626] px-3 py-1.5 text-xs font-extrabold tracking-widest text-white shadow-[3px_3px_0_#0f0a06]">
            <span className="inline-block h-2 w-2 rounded-full bg-white" aria-hidden="true" />
            <span>LIVE · DESI TV ARENA</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="title-settings-btn"
            onClick={onOpenSettings}
            aria-label="Settings and Account"
            title="Settings & Account Login"
            className="title-util-btn flex h-10 w-10 cursor-pointer items-center justify-center border-2 border-[#facc15] bg-[#14100d]/90 text-[#facc15] transition-colors hover:bg-[#facc15] hover:text-[#0f0a06]"
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            data-testid="global-mute-btn"
            onClick={onToggleGlobalMute}
            aria-label={globalMuted ? 'Unmute All Audio' : 'Mute All Audio'}
            aria-pressed={globalMuted}
            title={globalMuted ? 'Audio Muted (Click to Unmute)' : 'Mute All Audio (M)'}
            className={`title-util-btn flex h-10 w-10 cursor-pointer items-center justify-center border-2 transition-colors ${
              globalMuted
                ? 'border-[#ef4444]/80 bg-[#14100d]/90 text-[#f87171]'
                : 'border-[#facc15] bg-[#14100d]/90 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f0a06]'
            }`}
          >
            {globalMuted ? (
              <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            aria-label={effectiveMusicMuted ? 'Unmute Music' : 'Mute Music'}
            title={effectiveMusicMuted ? 'Music: OFF' : 'Music: ON'}
            className={`title-util-btn relative flex h-10 w-10 cursor-pointer items-center justify-center border-2 transition-colors ${
              effectiveMusicMuted
                ? 'border-white/30 bg-[#14100d]/90 text-[#a8a29e]'
                : 'border-[#facc15] bg-[#14100d]/90 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f0a06]'
            }`}
          >
            <Music className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            {effectiveMusicMuted && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-0.5 w-6 -rotate-45 bg-[#ef4444]"
              />
            )}
          </button>

          <FullscreenButton
            isFullscreen={isFullscreen}
            isSupported={fullscreenSupported}
            onToggle={onToggleFullscreen}
            variant="title"
          />
        </div>
      </div>

      {/* Hero Lockup & Pulsing CTA over Live Panning 3D Arena */}
      <div className="title-hero-wrap mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-between py-2 text-center">
        {/* Bold Skewed TV-News / Arcade SVG Crest */}
        <svg
          viewBox="0 0 740 205"
          className="title-crest-svg w-full max-w-[600px] shrink drop-shadow-[0_10px_0_rgba(15,10,6,0.95)]"
          role="img"
          aria-label="DESI DANGAL — The Great Multiverse Fight"
        >
          <polygon
            points="32,18 716,8 698,124 18,134"
            fill="#DC2626"
            stroke="#0F0A06"
            strokeWidth="8"
          />
          <polygon
            points="62,122 680,114 666,184 48,192"
            fill="#FACC15"
            stroke="#0F0A06"
            strokeWidth="6"
          />
          <polygon points="24,18 74,16 58,56 18,56" fill="#FACC15" />
          <polygon points="668,10 716,8 710,48 662,50" fill="#0F0A06" />

          <text
            x="370"
            y="98"
            textAnchor="middle"
            fontFamily="Barlow Condensed, Arial Narrow, Impact, sans-serif"
            fontWeight="800"
            fontStyle="italic"
            fontSize="88"
            letterSpacing="4"
            fill="#FFFFFF"
            stroke="#0F0A06"
            strokeWidth="12"
            paintOrder="stroke fill"
          >
            DESI DANGAL
          </text>

          <text
            x="365"
            y="162"
            textAnchor="middle"
            fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
            fontWeight="800"
            fontSize="26"
            letterSpacing="4.5"
            fill="#120D0A"
          >
            THE GREAT MULTIVERSE FIGHT
          </text>
        </svg>

        {/* Pulsing Arcade Start CTA */}
        <div className="title-cta-wrap mb-3 flex flex-col items-center gap-2">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="title-cta-btn cta-pulse pointer-events-auto cursor-pointer whitespace-nowrap shrink-0 border-4 border-[#0f0a06] bg-[#facc15] px-8 py-3.5 font-display text-2xl font-extrabold uppercase italic tracking-wider text-[#0f0a06] shadow-[6px_6px_0_#dc2626] hover:bg-[#fde047] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-10 sm:text-3xl"
          >
            TAP TO START · PRESS ENTER
          </button>
        </div>
      </div>

      {/* Clean Bottom Bar: How to Play · Satire Notice · About */}
      <div className="flex items-center justify-center">
        <div className="title-bottom-bar pointer-events-auto flex items-center gap-3 border border-white/15 bg-[#120d0a]/88 px-5 py-2">
          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="cursor-pointer font-display text-base font-extrabold uppercase tracking-wider text-[#facc15] hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            How to Play
          </button>
          <span className="text-white/35" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            onClick={onOpenSatireNotice}
            className="cursor-pointer font-display text-base font-extrabold uppercase tracking-wider text-[#e7e5e4] hover:text-[#facc15] focus-visible:outline-2 focus-visible:outline-white"
          >
            Satire Notice
          </button>
          <span className="text-white/35" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            onClick={onOpenAbout}
            className="cursor-pointer font-display text-base font-extrabold uppercase tracking-wider text-[#e7e5e4] hover:text-[#facc15] focus-visible:outline-2 focus-visible:outline-white"
          >
            About
          </button>
        </div>
      </div>
    </div>
  );
}
