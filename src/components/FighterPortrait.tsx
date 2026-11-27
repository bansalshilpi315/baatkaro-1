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
 * Renders real face photos (/textures/faces/principal_man.png & /textures/faces/samyak.png)
 * with crisp framed cropping for Principal Man & Samyak, gracefully falling back
 * to their procedural Canvas portraits if the image fails to load. All other fighters
 * use their Canvas portraits directly.
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
