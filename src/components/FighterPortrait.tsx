import { useEffect, useState } from 'react';
import {
  getFighterPortraitDataUrl,
  getRealFacePhotoUrl,
  hasPortraitPhotoFailed,
  markPortraitPhotoFailed,
} from '../game/characters';
import type { FighterId } from '../game/types';

interface FighterPortraitProps {
  id: FighterId;
  alt: string;
  className?: string;
}

/**
 * Renders real face photos (/textures/faces/principal_man.png, samyak.png, adi.png, krish.png)
 * with crisp framed cropping, gracefully falling back to procedural Canvas portraits if the
 * image fails to load or is empty. All other fighters use their Canvas portraits directly.
 */
export function FighterPortrait({ id, alt, className }: FighterPortraitProps) {
  const realUrl = getRealFacePhotoUrl(id);
  const [useFallback, setUseFallback] = useState<boolean>(
    () => !realUrl || hasPortraitPhotoFailed(realUrl),
  );

  useEffect(() => {
    setUseFallback(!realUrl || hasPortraitPhotoFailed(realUrl));
  }, [id, realUrl]);

  const src = !useFallback && realUrl ? realUrl : getFighterPortraitDataUrl(id);
  const cropClass = !useFallback && realUrl ? 'object-top' : '';

  return (
    <img
      src={src}
      alt={alt}
      onLoad={(e) => {
        if (realUrl && !useFallback && e.currentTarget.naturalWidth === 0) {
          markPortraitPhotoFailed(realUrl);
          setUseFallback(true);
        }
      }}
      onError={() => {
        if (realUrl && !useFallback) {
          markPortraitPhotoFailed(realUrl);
          setUseFallback(true);
        }
      }}
      className={`${className ?? ''} ${cropClass}`.trim()}
    />
  );
}
