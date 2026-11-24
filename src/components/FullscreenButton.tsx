import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenButtonProps {
  isFullscreen: boolean;
  isSupported: boolean;
  onToggle: () => void;
  variant: 'title' | 'select' | 'hud';
}

export function FullscreenButton({
  isFullscreen,
  isSupported,
  onToggle,
  variant,
}: FullscreenButtonProps) {
  if (!isSupported) return null;

  const label = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';

  if (variant === 'hud') {
    return (
      <button
        type="button"
        tabIndex={-1}
        data-testid="fullscreen-toggle"
        aria-label={label}
        aria-pressed={isFullscreen}
        title={label}
        onClick={(e) => {
          e.currentTarget.blur();
          onToggle();
        }}
        className={`hud-util-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
          isFullscreen
            ? 'border-[#facc15] bg-[#facc15] text-[#110b08]'
            : 'border-white/40 bg-[#14100d]/90 text-white hover:border-[#facc15] hover:text-[#facc15]'
        }`}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    );
  }

  if (variant === 'select') {
    return (
      <button
        type="button"
        data-testid="fullscreen-toggle"
        aria-label={label}
        aria-pressed={isFullscreen}
        title={label}
        onClick={onToggle}
        className={`select-util-btn flex h-9 w-9 cursor-pointer shrink-0 items-center justify-center border-2 shadow-[3px_3px_0_#0f0a06] transition-colors ${
          isFullscreen
            ? 'border-[#facc15] bg-[#facc15] text-[#0f0a06]'
            : 'border-[#facc15] bg-[#14100d]/92 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f0a06]'
        }`}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    );
  }

  // Title screen square utility button
  return (
    <button
      type="button"
      data-testid="fullscreen-toggle"
      aria-label={label}
      aria-pressed={isFullscreen}
      title={label}
      onClick={onToggle}
      className={`title-util-btn flex h-10 w-10 cursor-pointer shrink-0 items-center justify-center border-2 transition-colors ${
        isFullscreen
          ? 'border-[#facc15] bg-[#facc15] text-[#0f0a06]'
          : 'border-[#facc15] bg-[#14100d]/90 text-[#facc15] hover:bg-[#facc15] hover:text-[#0f0a06]'
      }`}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      )}
    </button>
  );
}
