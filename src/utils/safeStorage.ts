/**
 * Incognito- & sandbox-safe storage wrapper for Poki / CrazyGames QA compliance.
 * Wraps every localStorage.getItem / setItem / removeItem in try/catch with an
 * automatic in-memory fallback object so private browsing or restricted iframes
 * never throw SecurityError / QuotaExceededError.
 */

export interface SafeStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

const memoryFallback: Record<string, string> = Object.create(null);

function resolveBrowserStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Restricted iframe sandbox or private browsing blocked localStorage access
  }
  return null;
}

export function safeGetItem(
  key: string,
  storage?: Pick<Storage, 'getItem'> | null,
): string | null {
  const target = storage === undefined ? resolveBrowserStorage() : storage;
  if (target) {
    try {
      const value = target.getItem(key);
      if (value !== null) {
        memoryFallback[key] = value;
      }
      return value;
    } catch {
      // Fall back to in-memory store
    }
  }
  return Object.prototype.hasOwnProperty.call(memoryFallback, key)
    ? memoryFallback[key]
    : null;
}

export function safeSetItem(
  key: string,
  value: string,
  storage?: Pick<Storage, 'setItem'> | null,
): boolean {
  memoryFallback[key] = value;
  const target = storage === undefined ? resolveBrowserStorage() : storage;
  if (target) {
    try {
      target.setItem(key, value);
      return true;
    } catch {
      // Keep value safely in memoryFallback
      return false;
    }
  }
  return false;
}

export function safeRemoveItem(
  key: string,
  storage?: Pick<Storage, 'removeItem'> | null,
): void {
  delete memoryFallback[key];
  const target = storage === undefined ? resolveBrowserStorage() : storage;
  if (target) {
    try {
      target.removeItem(key);
    } catch {
      // Ignore restricted storage errors
    }
  }
}

export function clearSafeStorageFallbackForTests(): void {
  for (const key of Object.keys(memoryFallback)) {
    delete memoryFallback[key];
  }
}

export const AUDIO_PREFS_STORAGE_KEY = 'desi_showdown_audio_prefs_v1';

export interface StoredAudioPrefs {
  globalMuted: boolean;
  sfxMuted: boolean;
  musicMuted: boolean;
}

export function loadAudioPrefs(
  storage?: Pick<Storage, 'getItem'> | null,
): StoredAudioPrefs {
  const raw = safeGetItem(AUDIO_PREFS_STORAGE_KEY, storage);
  if (!raw) {
    return { globalMuted: false, sfxMuted: false, musicMuted: false };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAudioPrefs> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { globalMuted: false, sfxMuted: false, musicMuted: false };
    }
    return {
      globalMuted: Boolean(parsed.globalMuted),
      sfxMuted: Boolean(parsed.sfxMuted),
      musicMuted: Boolean(parsed.musicMuted),
    };
  } catch {
    return { globalMuted: false, sfxMuted: false, musicMuted: false };
  }
}

export function saveAudioPrefs(
  prefs: StoredAudioPrefs,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  safeSetItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(prefs), storage);
}
