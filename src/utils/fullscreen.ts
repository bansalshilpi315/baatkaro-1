import { useCallback, useEffect, useState } from 'react';

export interface VendorFullscreenDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  documentElement?: VendorFullscreenElement | null;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
}

export interface VendorFullscreenElement {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface LockableScreenOrientation {
  lock?: (orientation: string) => Promise<void>;
}

/**
 * Pure helper: determines whether Fullscreen API (standard or WebKit) is available.
 */
export function checkFullscreenSupport(doc: VendorFullscreenDocument | undefined): boolean {
  if (!doc || !doc.documentElement) return false;
  if (doc.fullscreenEnabled === false && doc.webkitFullscreenEnabled !== true) {
    return false;
  }
  const el = doc.documentElement;
  return (
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function'
  );
}

/**
 * Pure helper: reads whether any element is currently in fullscreen mode.
 */
export function readIsFullscreen(doc: VendorFullscreenDocument | undefined): boolean {
  if (!doc) return false;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/**
 * Enters fullscreen on document.documentElement and best-effort locks landscape orientation on mobile.
 */
export async function enterFullscreen(
  doc: VendorFullscreenDocument | undefined = typeof document !== 'undefined'
    ? (document as unknown as VendorFullscreenDocument)
    : undefined,
): Promise<boolean> {
  if (!doc?.documentElement) return false;
  const el = doc.documentElement;

  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
    } else {
      return false;
    }
  } catch {
    return false;
  }

  // Best-effort landscape orientation lock on mobile browsers
  try {
    if (typeof screen !== 'undefined' && screen.orientation) {
      const orient = screen.orientation as unknown as LockableScreenOrientation;
      if (typeof orient.lock === 'function') {
        await orient.lock('landscape').catch(() => {
          // Silently ignore browsers that disallow orientation locking
        });
      }
    }
  } catch {
    // Silently ignore unsupported orientation lock APIs
  }

  return true;
}

/**
 * Exits fullscreen via standard or WebKit API.
 */
export async function exitFullscreen(
  doc: VendorFullscreenDocument | undefined = typeof document !== 'undefined'
    ? (document as unknown as VendorFullscreenDocument)
    : undefined,
): Promise<boolean> {
  if (!doc) return false;
  try {
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
      return true;
    }
    if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Pure helper: detects touch-first mobile / tablet devices where auto-fullscreen
 * should engage upon landscape boot or first user tap.
 */
export function isMobileOrTouchDevice(
  win:
    | {
        innerWidth?: number;
        innerHeight?: number;
        matchMedia?: (query: string) => { matches: boolean };
      }
    | undefined = typeof window !== 'undefined' ? window : undefined,
  nav:
    | {
        maxTouchPoints?: number;
        userAgent?: string;
      }
    | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): boolean {
  if (!win && !nav) return false;
  const coarsePointer =
    typeof win?.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints = (nav?.maxTouchPoints ?? 0) > 0;
  const ua = nav?.userAgent ?? '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile/i.test(ua);
  const compactViewport =
    typeof win?.innerWidth === 'number' &&
    typeof win?.innerHeight === 'number' &&
    Math.min(win.innerWidth, win.innerHeight) <= 900;
  return mobileUa || (coarsePointer && compactViewport) || (hasTouchPoints && compactViewport);
}

/**
 * Attempts automatic fullscreen + landscape orientation lock on mobile/touch devices.
 * Safe against browser gesture restrictions (never throws).
 */
export async function tryAutoMobileFullscreen(
  doc: VendorFullscreenDocument | undefined = typeof document !== 'undefined'
    ? (document as unknown as VendorFullscreenDocument)
    : undefined,
  win?: {
    innerWidth?: number;
    innerHeight?: number;
    matchMedia?: (query: string) => { matches: boolean };
  },
  nav?: {
    maxTouchPoints?: number;
    userAgent?: string;
  },
): Promise<boolean> {
  if (!isMobileOrTouchDevice(win, nav)) return false;
  if (!checkFullscreenSupport(doc) || readIsFullscreen(doc)) return false;
  return enterFullscreen(doc);
}


/**
 * React hook managing fullscreen state across standard and WebKit events.
 */
export function useFullscreen(): {
  isFullscreen: boolean;
  isSupported: boolean;
  toggleFullscreen: () => void;
} {
  const getDoc = () =>
    typeof document !== 'undefined'
      ? (document as unknown as VendorFullscreenDocument)
      : undefined;

  const [isSupported, setIsSupported] = useState<boolean>(() =>
    checkFullscreenSupport(getDoc()),
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    readIsFullscreen(getDoc()),
  );

  useEffect(() => {
    const doc = getDoc();
    if (!doc) return;

    setIsSupported(checkFullscreenSupport(doc));
    setIsFullscreen(readIsFullscreen(doc));

    const handleChange = () => {
      setIsFullscreen(readIsFullscreen(doc));
    };

    doc.addEventListener?.('fullscreenchange', handleChange);
    doc.addEventListener?.('webkitfullscreenchange', handleChange);

    return () => {
      doc.removeEventListener?.('fullscreenchange', handleChange);
      doc.removeEventListener?.('webkitfullscreenchange', handleChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = getDoc();
    if (!doc || !checkFullscreenSupport(doc)) return;
    if (readIsFullscreen(doc)) {
      void exitFullscreen(doc);
    } else {
      void enterFullscreen(doc);
    }
  }, []);

  return { isFullscreen, isSupported, toggleFullscreen };
}
