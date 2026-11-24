import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

export function PortraitGuard() {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      setIsPortraitMobile(w < 768 && h > w);
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
      aria-label="Landscape orientation required"
      className="safe-pad-modal fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] flex-col items-center justify-center overflow-hidden bg-[#120d0a] text-center"
    >
      <div className="w-full max-w-sm border-4 border-[#facc15] bg-[#1c1410] p-6 shadow-[8px_8px_0_#dc2626]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border-2 border-[#facc15] bg-[#dc2626] text-white">
          <RotateCw className="h-9 w-9" aria-hidden="true" />
        </div>
        <h2 className="font-display text-4xl font-extrabold uppercase tracking-wide text-[#facc15]">
          ROTATE TO LANDSCAPE
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#f5f5f4]">
          Desi Showdown is a 2.5D side-scrolling arcade fighter. Please turn your phone sideways for full-screen arena action and touch controls.
        </p>
        <p className="mt-2 text-xs font-semibold text-[#fbbf24]">
          Phone ko aada (landscape) ghumaaiye, phir full dhishum-dhishum shuru hoga!
        </p>
      </div>
    </div>
  );
}
