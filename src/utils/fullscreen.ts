import { useCallback, useEffect, useRef, useState } from 'react';
import { CG_SDK } from '../game/crazyGamesSdk';

export interface VendorFullscreenDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  documentElement?: VendorFullscreenElement | null;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
}

export interface VendorFullscreenElement {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface LockableScreenOrientation {
  lock?: (orientation: string) => Promise<void>;
}

const FULLSCREEN_CHANGE_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
] as const;

/**
 * Tracks whether the user explicitly exited fullscreen so automatic mobile
 * fullscreen triggers do not force the game back into fullscreen until the
 * user explicitly clicks the Fullscreen button again.
 */
let userManuallyExitedFullscreen = false;

export function hasUserManuallyExitedFullscreen(): boolean {
  return userManuallyExitedFullscreen;
}

export function setUserManuallyExitedFullscreen(exited: boolean): void {
  userManuallyExitedFullscreen = exited;
}

export function resetFullscreenStateForTests(): void {
  userManuallyExitedFullscreen = false;
}

/**
 * Pure helper: determines whether Fullscreen API (standard or vendor-prefixed) is available.
 * Inside CrazyGames desktop iframe hosting, CrazyGames provides its own portal fullscreen
 * wrapper so we defer desktop fullscreen cleanly while keeping mobile touch fullscreen safe.
 */
export function checkFullscreenSupport(doc: VendorFullscreenDocument | undefined): boolean {
  if (!doc || !doc.documentElement) return false;
  if (CG_SDK.isCrazyGamesHosted() && !isMobileOrTouchDevice()) {
    return false;
  }
  try {
    const anyExplicitlyEnabled =
      doc.fullscreenEnabled === true ||
      doc.webkitFullscreenEnabled === true ||
      doc.mozFullScreenEnabled === true ||
      doc.msFullscreenEnabled === true;
    const standardExplicitlyDisabled = doc.fullscreenEnabled === false;
    if (standardExplicitlyDisabled && !anyExplicitlyEnabled) {
      return false;
    }
    const el = doc.documentElement;
    return (
      typeof el.requestFullscreen === 'function' ||
      typeof el.webkitRequestFullscreen === 'function' ||
      typeof el.mozRequestFullScreen === 'function' ||
      typeof el.msRequestFullscreen === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Pure helper: reads whether any element is currently in fullscreen mode across
 * standard, WebKit, Mozilla, and MS fullscreen properties.
 */
export function readIsFullscreen(doc: VendorFullscreenDocument | undefined): boolean {
  if (!doc) return false;
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
  );
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
      await Promise.resolve(el.requestFullscreen());
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      await Promise.resolve(el.webkitRequestFullscreen());
    } else if (typeof el.mozRequestFullScreen === 'function') {
      await Promise.resolve(el.mozRequestFullScreen());
    } else if (typeof el.msRequestFullscreen === 'function') {
      await Promise.resolve(el.msRequestFullscreen());
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
 * Exits fullscreen reliably via cross-browser standard & vendor-prefixed APIs,
 * falling back cleanly if any individual exit method throws.
 */
export async function exitFullscreen(
  doc: VendorFullscreenDocument | undefined = typeof document !== 'undefined'
    ? (document as unknown as VendorFullscreenDocument)
    : undefined,
): Promise<boolean> {
  if (!doc) return false;

  const exitMethods: Array<(() => Promise<void> | void) | undefined> = [
    typeof doc.exitFullscreen === 'function' ? () => doc.exitFullscreen!() : undefined,
    typeof doc.webkitExitFullscreen === 'function' ? () => doc.webkitExitFullscreen!() : undefined,
    typeof doc.mozCancelFullScreen === 'function' ? () => doc.mozCancelFullScreen!() : undefined,
    typeof doc.msExitFullscreen === 'function' ? () => doc.msExitFullscreen!() : undefined,
  ];

  for (const invokeExit of exitMethods) {
    if (!invokeExit) continue;
    try {
      await Promise.resolve(invokeExit());
      return true;
    } catch {
      // Try next vendor fallback cleanly
    }
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
 * Respects `userManuallyExitedFullscreen` so auto-fullscreen never re-triggers after
 * a manual exit until the user explicitly clicks the Fullscreen button again.
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
  try {
    if (userManuallyExitedFullscreen) return false;
    if (!isMobileOrTouchDevice(win, nav)) return false;
    if (!checkFullscreenSupport(doc) || readIsFullscreen(doc)) return false;
    return await enterFullscreen(doc);
  } catch {
    return false;
  }
}

/**
 * Pure helper for button-triggered fullscreen toggles so logic is unit-testable.
 * - Always checks the real browser fullscreen element first (plus fallback state).
 * - Sets `userManuallyExitedFullscreen = true` on manual exit and resets it to
 *   `false` only when the user explicitly requests entering fullscreen.
 */
export async function performManualFullscreenToggle(
  doc: VendorFullscreenDocument | undefined,
  currentStateFallback = false,
): Promise<{ action: 'entered' | 'exited' | 'noop'; isFullscreen: boolean }> {
  if (!doc) {
    return { action: 'noop', isFullscreen: false };
  }

  const actuallyFullscreen = readIsFullscreen(doc);
  if (actuallyFullscreen || currentStateFallback) {
    userManuallyExitedFullscreen = true;
    if (actuallyFullscreen) {
      await exitFullscreen(doc);
    }
    return { action: 'exited', isFullscreen: readIsFullscreen(doc) };
  }

  userManuallyExitedFullscreen = false;
  if (!checkFullscreenSupport(doc)) {
    return { action: 'noop', isFullscreen: readIsFullscreen(doc) };
  }
  await enterFullscreen(doc);
  return { action: 'entered', isFullscreen: readIsFullscreen(doc) };
}

/**
 * React hook syncing fullscreen state with real browser events across standard,
 * WebKit, Mozilla, and MS fullscreen APIs.
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
  const isFullscreenRef = useRef<boolean>(isFullscreen);
  isFullscreenRef.current = isFullscreen;

  useEffect(() => {
    const doc = getDoc();
    if (!doc) return;

    const initialFullscreen = readIsFullscreen(doc);
    setIsSupported(checkFullscreenSupport(doc));
    setIsFullscreen(initialFullscreen);
    isFullscreenRef.current = initialFullscreen;

    const handleChange = () => {
      const nextFullscreen = readIsFullscreen(doc);
      if (isFullscreenRef.current && !nextFullscreen) {
        // Respect browser/Esc/back-gesture exits too so auto-fullscreen won't fight the user
        userManuallyExitedFullscreen = true;
      }
      isFullscreenRef.current = nextFullscreen;
      setIsFullscreen(nextFullscreen);
      setIsSupported(checkFullscreenSupport(doc));
    };

    for (const eventName of FULLSCREEN_CHANGE_EVENTS) {
      doc.addEventListener?.(eventName, handleChange);
    }

    return () => {
      for (const eventName of FULLSCREEN_CHANGE_EVENTS) {
        doc.removeEventListener?.(eventName, handleChange);
      }
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = getDoc();
    if (!doc) {
      setIsFullscreen(false);
      return;
    }

    const actuallyFullscreen = readIsFullscreen(doc);
    if (actuallyFullscreen || isFullscreenRef.current) {
      userManuallyExitedFullscreen = true;
      if (!actuallyFullscreen) {
        // Reset any stale/pseudo state immediately if browser is already out of fullscreen
        isFullscreenRef.current = false;
        setIsFullscreen(false);
        return;
      }
      void exitFullscreen(doc).finally(() => {
        const synced = readIsFullscreen(doc);
        isFullscreenRef.current = synced;
        setIsFullscreen(synced);
      });
      return;
    }

    userManuallyExitedFullscreen = false;
    if (!checkFullscreenSupport(doc)) return;
    void enterFullscreen(doc).finally(() => {
      const synced = readIsFullscreen(doc);
      isFullscreenRef.current = synced;
      setIsFullscreen(synced);
    });
  }, []);

  return { isFullscreen, isSupported, toggleFullscreen };
}
