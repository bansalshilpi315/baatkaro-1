import { useState } from 'react';

export const GAME_LOGO_URL = './logo.png';

export type GameLogoVariant = 'hero' | 'corner' | 'developer' | 'seal';

interface GameLogoBadgeProps {
  sizeClass?: string;
  shape?: 'circle' | 'rounded';
  variant?: GameLogoVariant;
  testId?: string;
  alt?: string;
  className?: string;
}

const VARIANT_FRAME_CLASS: Record<GameLogoVariant, string> = {
  hero: 'border-2 border-[#facc15] bg-[#140e0a] shadow-[0_0_28px_rgba(250,204,21,0.4),4px_4px_0_#dc2626]',
  corner: 'border-2 border-[#facc15] bg-[#140e0a] shadow-[3px_3px_0_#0f0a06]',
  developer: 'border-2 border-[#facc15]/80 bg-[#140e0a] shadow-[3px_3px_0_#0a0705]',
  seal: 'border-2 border-[#1c1917] bg-[#f5efe0] p-[2px] shadow-[1px_1px_0_rgba(28,25,23,0.45)] ring-1 ring-[#1c1917]/40',
};

/**
 * Displays the official 1:1 square `/logo.png` across preloader, menu, settings,
 * and newspaper surfaces, with a crisp arcade crest fallback if `/logo.png` is
 * absent in a local dev workspace.
 */
export function GameLogoBadge({
  sizeClass = 'h-12 w-12',
  shape = 'rounded',
  variant = 'corner',
  testId,
  alt = 'DESI DANGAL Official Logo',
  className = '',
}: GameLogoBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
  const innerRadiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-[10px]';
  const sealFilterClass = variant === 'seal' ? 'sepia-[0.22] contrast-[1.06]' : '';

  return (
    <div
      data-testid={testId}
      data-logo-src={GAME_LOGO_URL}
      className={`relative aspect-square shrink-0 overflow-hidden select-none ${radiusClass} ${VARIANT_FRAME_CLASS[variant]} ${sizeClass} ${className}`}
    >
      {!imgFailed ? (
        <img
          src={GAME_LOGO_URL}
          alt={alt}
          decoding="async"
          draggable={false}
          onError={() => setImgFailed(true)}
          className={`h-full w-full object-cover ${innerRadiusClass} ${sealFilterClass}`}
        />
      ) : (
        <svg
          viewBox="0 0 120 120"
          role="img"
          aria-label={alt}
          className={`h-full w-full ${innerRadiusClass} ${sealFilterClass}`}
        >
          <defs>
            <radialGradient id="ddLogoBg" cx="50%" cy="42%" r="65%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="58%" stopColor="#7f1d1d" />
              <stop offset="100%" stopColor="#140c08" />
            </radialGradient>
            <linearGradient id="ddLogoGold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <rect width="120" height="120" fill="url(#ddLogoBg)" />
          <circle
            cx="60"
            cy="60"
            r="51"
            fill="none"
            stroke="url(#ddLogoGold)"
            strokeWidth="4"
            strokeDasharray={variant === 'seal' ? '6 3' : undefined}
          />
          <polygon
            points="16,32 104,26 98,78 22,84"
            fill="#110a07"
            fillOpacity="0.55"
            stroke="#facc15"
            strokeWidth="2.5"
          />
          <text
            x="60"
            y="69"
            textAnchor="middle"
            fontFamily="Barlow Condensed, Impact, Arial Narrow, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="44"
            letterSpacing="1"
            fill="url(#ddLogoGold)"
            stroke="#0f0a06"
            strokeWidth="5"
            paintOrder="stroke fill"
          >
            DD
          </text>
          <rect x="20" y="83" width="80" height="16" rx="2" fill="#facc15" stroke="#0f0a06" strokeWidth="2" />
          <text
            x="60"
            y="95"
            textAnchor="middle"
            fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
            fontWeight="900"
            fontSize="11.5"
            letterSpacing="1.1"
            fill="#140c08"
          >
            DESI DANGAL
          </text>
        </svg>
      )}
    </div>
  );
}
