import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const DESI_TIPS = [
  'Boiling cutting chai...',
  'Adjusting studio TRP meters...',
  'Polishing Sheru Bhai’s gold chain...',
  'Alerting Mohalla balcony aunties...',
  'Warming up Laddoo Mausi’s belan...',
  'Checking Railway platform announcement mic...',
];

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1250;
    let rafId = 0;
    let done = false;

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // Ease-out arcade loading feel
      const eased = 1 - Math.pow(1 - t, 2.2);
      const pct = Math.min(100, Math.round(eased * 100));
      setProgress(pct);
      setTipIndex(Math.min(DESI_TIPS.length - 1, Math.floor((elapsed / 320) % DESI_TIPS.length)));

      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else if (!done) {
        done = true;
        window.setTimeout(() => onComplete(), 160);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="safe-pad-modal fixed inset-0 z-40 flex h-[100dvh] w-[100dvw] flex-col items-center justify-center overflow-hidden bg-[#0f0b08]/95"
    >
      <div className="w-full max-w-md text-center">
        {/* Broadcast Tag */}
        <div className="mb-3 inline-flex items-center gap-2 bg-[#dc2626] px-3 py-1 font-display text-xs font-extrabold uppercase tracking-widest text-white shadow-[3px_3px_0_#0a0705]">
          <span className="inline-block h-2 w-2 rounded-full bg-white" aria-hidden="true" />
          <span>TUNING INTO DESI TV · LIVE</span>
        </div>

        <h1 className="font-display text-5xl font-extrabold uppercase italic tracking-wider text-[#facc15] news-stroke sm:text-6xl">
          DESI SHOWDOWN
        </h1>
        <p className="mt-1 font-display text-sm font-bold uppercase tracking-[0.28em] text-[#e7e5e4]">
          THE GREAT MULTIVERSE FIGHT
        </p>

        {/* Progress Bar */}
        <div className="mt-7 border-3 border-[#facc15] bg-[#1c1612] p-1 shadow-[5px_5px_0_#dc2626]">
          <div className="relative h-6 w-full overflow-hidden bg-[#0e0b09]">
            <div
              className="h-full bg-gradient-to-r from-[#dc2626] via-[#f97316] to-[#facc15] transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-mono-num text-xs font-extrabold tracking-wider text-white news-stroke">
              Loading desi assets... {progress}%
            </span>
          </div>
        </div>

        {/* Rotating Desi Tip */}
        <p
          data-testid="loading-tip"
          className="mt-4 min-h-[1.5rem] text-sm font-semibold italic text-[#fde68a]"
        >
          &ldquo;{DESI_TIPS[tipIndex]}&rdquo;
        </p>
      </div>
    </div>
  );
}
