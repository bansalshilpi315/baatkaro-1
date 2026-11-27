import { useEffect, useState } from 'react';

export function PortraitGuard() {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      const isNarrowOrTouch =
        w < 900 ||
        (typeof window.matchMedia === 'function' &&
          window.matchMedia('(pointer: coarse)').matches);
      setIsPortraitMobile(isNarrowOrTouch && h > w);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    window.visualViewport?.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      window.visualViewport?.removeEventListener('resize', check);
    };
  }, []);

  if (!isPortraitMobile) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rotate to landscape for Dangal"
      data-testid="portrait-rotate-overlay"
      className="portrait-rotate-guard safe-pad-modal fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] flex-col items-center justify-center overflow-hidden bg-[#0b0807] text-center"
    >
      {/* Subtle Radial Arena Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(220,38,38,0.22)_0%,rgba(250,204,21,0.1)_34%,rgba(11,8,7,0.98)_74%)]"
      />

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center px-4">
        {/* Animated Glowing Smartphone + Curved Rotation Arrows Stage */}
        <div
          aria-hidden="true"
          className="relative mb-7 flex h-44 w-44 items-center justify-center"
        >
          {/* Outer Pulsing Halo Ring */}
          <div className="phone-halo-ring absolute inset-2 rounded-full border border-[#facc15]/30 bg-[#facc15]/5" />

          {/* Curved Animated Rotation Arrows */}
          <svg
            viewBox="0 0 180 180"
            className="phone-arrows-pulse absolute inset-0 h-full w-full"
            fill="none"
          >
            {/* Top-right clockwise arc */}
            <path
              d="M 112 24 A 66 66 0 0 1 156 82"
              stroke="#facc15"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 145 73 L 157 85 L 164 69"
              stroke="#facc15"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Bottom-left counter arc */}
            <path
              d="M 68 156 A 66 66 0 0 1 24 98"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 35 107 L 23 95 L 16 111"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Glowing Vector Smartphone Smoothly Tilting 90 Degrees (Portrait -> Landscape) */}
          <div className="phone-tilt-anim relative flex h-28 w-16 flex-col items-center justify-between rounded-[14px] border-[3px] border-[#facc15] bg-gradient-to-b from-[#231914] to-[#110c09] p-1.5 shadow-[0_0_24px_rgba(250,204,21,0.55),inset_0_0_10px_rgba(250,204,21,0.2)]">
            {/* Top earpiece notch */}
            <span className="h-1 w-5 rounded-full bg-[#facc15]/70" />

            {/* Pulsing Arena Screen Lines Inside Phone */}
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-1.5 px-1 py-2">
              <span className="phone-screen-line-1 h-1.5 w-full rounded-full bg-gradient-to-r from-[#facc15] to-[#ef4444]" />
              <span className="phone-screen-line-2 h-1.5 w-4/5 rounded-full bg-[#fde047]/80" />
              <span className="phone-screen-line-3 h-1.5 w-3/5 rounded-full bg-[#ef4444]/85" />
            </div>

            {/* Bottom gesture pill */}
            <span className="h-1 w-4 rounded-full bg-white/45" />
          </div>
        </div>

        {/* Bold Arcade Callout */}
        <div className="mb-2 inline-block bg-[#dc2626] px-3 py-0.5 font-display text-xs font-extrabold uppercase tracking-[0.22em] text-white shadow-[3px_3px_0_#0f0a06]">
          DESI DANGAL
        </div>
        <h2 className="font-display text-3xl font-extrabold uppercase italic leading-tight tracking-wider text-[#facc15] news-stroke">
          ROTATE TO LANDSCAPE FOR DANGAL
        </h2>
        <p className="mt-2.5 text-xs font-semibold leading-relaxed text-[#d6d3d1]">
          Turn your phone sideways for full-screen 3D arena action and ergonomic arcade controls.
        </p>
      </div>
    </div>
  );
}
