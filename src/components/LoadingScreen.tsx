import { useEffect, useRef, useState } from 'react';
import {
  PRELOADER_FALLBACK_TIMEOUT_MS,
  SPLASH_STAGE1_MIN_MS,
  preloadStartupAssets,
} from '../game/assetPreloader';

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [stage, setStage] = useState<'splash' | 'loading'>('splash');
  const [assetProgress, setAssetProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [statusText, setStatusText] = useState('Loading 3D Fighters & Arena...');
  const [fadingOut, setFadingOut] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;
    let splashDone = false;
    let stage2MinDone = false;
    let assetsDone = false;
    let completed = false;
    let stage2Timer = 0;
    let fadeTimer = 0;

    const tryFinish = () => {
      if (cancelled || completed) return;
      if (!splashDone || !stage2MinDone || !assetsDone) return;
      completed = true;
      setDisplayProgress(100);
      setStatusText('Arena Ready!');
      fadeTimer = window.setTimeout(() => {
        if (cancelled) return;
        setFadingOut(true);
        window.setTimeout(() => {
          if (!cancelled) onCompleteRef.current();
        }, 320);
      }, 220);
    };

    // Start preloading GLB heads, face textures & audio immediately via THREE.LoadingManager
    void preloadStartupAssets({
      timeoutMs: PRELOADER_FALLBACK_TIMEOUT_MS,
      onProgress: (info) => {
        if (cancelled) return;
        setAssetProgress(info.percent);
        setStatusText(info.statusText);
      },
    }).then(() => {
      if (cancelled) return;
      assetsDone = true;
      setAssetProgress(100);
      tryFinish();
    });

    // Stage 1: Exact minimum 2.0-second DESI DANGAL ARENA splash
    const splashTimer = window.setTimeout(() => {
      if (cancelled) return;
      splashDone = true;
      setStage('loading');
      // Allow Stage 2's 0-100% bar to visibly sweep smoothly before fading out
      stage2Timer = window.setTimeout(() => {
        if (cancelled) return;
        stage2MinDone = true;
        tryFinish();
      }, 600);
    }, SPLASH_STAGE1_MIN_MS);

    // Hard 8-second safety fallback so the preloader can never stall
    const hardFallbackTimer = window.setTimeout(() => {
      if (cancelled || completed) return;
      splashDone = true;
      stage2MinDone = true;
      assetsDone = true;
      setStage('loading');
      setAssetProgress(100);
      tryFinish();
    }, PRELOADER_FALLBACK_TIMEOUT_MS + 250);

    return () => {
      cancelled = true;
      window.clearTimeout(splashTimer);
      window.clearTimeout(stage2Timer);
      window.clearTimeout(hardFallbackTimer);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  // Smooth horizontal bar sweep once Stage 2 becomes visible
  useEffect(() => {
    if (stage !== 'loading') return;
    let rafId = 0;
    const tick = () => {
      setDisplayProgress((prev) => {
        if (prev >= assetProgress) return prev;
        const step = Math.max(2, Math.ceil((assetProgress - prev) * 0.28));
        return Math.min(assetProgress, prev + step);
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [stage, assetProgress]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="startup-preloader"
      data-stage={stage}
      className={`safe-pad-modal fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] flex-col items-center justify-center overflow-hidden bg-[#0a0807] transition-opacity duration-300 ${
        fadingOut ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Subtle Radial Arena Spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(220,38,38,0.22)_0%,rgba(250,204,21,0.08)_34%,rgba(10,8,7,0.98)_74%)]"
      />

      <div className="relative z-10 w-full max-w-xl px-4 text-center">
        {stage === 'splash' ? (
          <div
            data-testid="preloader-stage-1"
            className="preloader-fade-in flex flex-col items-center"
          >
            <div className="mb-3 border border-[#facc15]/50 bg-[#18110d]/90 px-4 py-1 font-display text-xs font-extrabold uppercase tracking-[0.34em] text-[#fde047]">
              PRESENTS
            </div>
            <h1
              className="font-display text-5xl font-extrabold uppercase italic tracking-[0.08em] text-[#facc15] sm:text-7xl"
              style={{
                textShadow:
                  '0 0 28px rgba(250, 204, 21, 0.45), 0 4px 0 #110b08, 0 8px 22px rgba(220, 38, 38, 0.45)',
                WebkitTextStroke: '2px #110b08',
                paintOrder: 'stroke fill',
              }}
            >
              DESI DANGAL ARENA
            </h1>
            <div
              aria-hidden="true"
              className="mt-5 h-1 w-44 bg-gradient-to-r from-transparent via-[#facc15] to-transparent shadow-[0_0_16px_rgba(250,204,21,0.8)]"
            />
          </div>
        ) : (
          <div
            data-testid="preloader-stage-2"
            className="preloader-fade-in mx-auto w-full max-w-md"
          >
            <div className="mb-2 inline-block bg-[#dc2626] px-3 py-0.5 font-display text-xs font-extrabold uppercase tracking-[0.22em] text-white shadow-[3px_3px_0_#0f0a06]">
              DESI DANGAL
            </div>
            <h2 className="font-display text-4xl font-extrabold uppercase italic tracking-wider text-[#facc15] news-stroke sm:text-5xl">
              DESI DANGAL ARENA
            </h2>

            {/* Modern Horizontal Asset Progress Bar (0% - 100%) */}
            <div className="mt-6 border-2 border-[#facc15] bg-[#16110e] p-1 shadow-[5px_5px_0_#dc2626]">
              <div className="relative h-6 w-full overflow-hidden bg-[#0b0907]">
                <div
                  data-testid="preloader-progress-fill"
                  className="h-full bg-gradient-to-r from-[#dc2626] via-[#f97316] to-[#facc15] transition-[width] duration-75"
                  style={{ width: `${displayProgress}%` }}
                />
                <span
                  data-testid="preloader-progress-pct"
                  className="absolute inset-0 flex items-center justify-center font-mono-num text-xs font-extrabold tracking-wider text-white news-stroke"
                >
                  {displayProgress}%
                </span>
              </div>
            </div>

            <p
              data-testid="preloader-status-text"
              className="mt-3 font-display text-sm font-bold uppercase tracking-[0.16em] text-[#fde68a]"
            >
              {statusText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
