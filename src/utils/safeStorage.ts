/**
 * Unified `SaveStore` & sandbox-safe storage wrapper for CrazyGames QA compliance.
 *
 * - Prefers `window.CrazyGames.SDK.data.getItem / setItem / removeItem` whenever
 *   available inside CrazyGames's iframe sandbox.
 * - Safely mirrors every write to `try/catch window.localStorage` and an
 *   automatic in-memory fallback so private browsing or restricted iframes
 *   never throw SecurityError / QuotaExceededError.
 */

import { CG_SDK, type CrazyGamesDataApi } from '../game/crazyGamesSdk';
import type { Difficulty, FighterId, StageId } from '../game/types';

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

function resolveCrazyGamesData(): CrazyGamesDataApi | null {
  try {
    return CG_SDK.getDataApi();
  } catch {
    return null;
  }
}

export function safeGetItem(
  key: string,
  storage?: Pick<Storage, 'getItem'> | null,
): string | null {
  // Explicit storage override (used in unit tests)
  if (storage !== undefined) {
    if (storage) {
      try {
        const value = storage.getItem(key);
        if (value !== null) {
          memoryFallback[key] = value;
        }
        return value;
      } catch {
        // Fall through to memoryFallback
      }
    }
    return Object.prototype.hasOwnProperty.call(memoryFallback, key)
      ? memoryFallback[key]
      : null;
  }

  // 1. Primary: CrazyGames SDK.data cloud/sandbox storage
  const cgData = resolveCrazyGamesData();
  if (cgData) {
    try {
      const cgValue = cgData.getItem(key);
      if (cgValue !== null && cgValue !== undefined) {
        memoryFallback[key] = cgValue;
        const local = resolveBrowserStorage();
        if (local) {
          try {
            local.setItem(key, cgValue);
          } catch {
            // Mirror best-effort only
          }
        }
        return cgValue;
      }
    } catch {
      // Fall back safely to localStorage / memory
    }
  }

  // 2. Mirror: Browser localStorage
  const local = resolveBrowserStorage();
  if (local) {
    try {
      const localValue = local.getItem(key);
      if (localValue !== null) {
        memoryFallback[key] = localValue;
        // Hydrate CrazyGames SDK.data if local had an existing save
        if (cgData) {
          try {
            cgData.setItem(key, localValue);
          } catch {
            // Ignore write errors
          }
        }
        return localValue;
      }
    } catch {
      // Fall back to in-memory store
    }
  }

  // 3. Safe in-memory fallback
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

  if (storage !== undefined) {
    if (!storage) return false;
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  let wroteAny = false;

  // 1. Write to CrazyGames SDK.data
  const cgData = resolveCrazyGamesData();
  if (cgData) {
    try {
      cgData.setItem(key, value);
      wroteAny = true;
    } catch {
      // Continue mirroring to localStorage
    }
  }

  // 2. Mirror safely to localStorage
  const local = resolveBrowserStorage();
  if (local) {
    try {
      local.setItem(key, value);
      wroteAny = true;
    } catch {
      // Keep value safely in memoryFallback / SDK.data
    }
  }

  return wroteAny;
}

export function safeRemoveItem(
  key: string,
  storage?: Pick<Storage, 'removeItem'> | null,
): void {
  delete memoryFallback[key];

  if (storage !== undefined) {
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore restricted storage errors
      }
    }
    return;
  }

  const cgData = resolveCrazyGamesData();
  if (cgData) {
    try {
      cgData.removeItem(key);
    } catch {
      // Ignore restricted SDK.data errors
    }
  }

  const local = resolveBrowserStorage();
  if (local) {
    try {
      local.removeItem(key);
    } catch {
      // Ignore restricted localStorage errors
    }
  }
}

/**
 * Unified CrazyGames-ready storage facade (`SaveStore`) wrapping `SDK.data` + `localStorage`.
 */
export const SaveStore = {
  getItem: safeGetItem,
  setItem: safeSetItem,
  removeItem: safeRemoveItem,
} as const;

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
  const raw = SaveStore.getItem(AUDIO_PREFS_STORAGE_KEY, storage);
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
  SaveStore.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(prefs), storage);
}

export const SELECTION_PREFS_STORAGE_KEY = 'desi_dangal_selection_prefs_v1';

export interface StoredSelectionPrefs {
  p1Id: FighterId;
  p2Id: FighterId;
  stageId: StageId;
  difficulty: Difficulty;
}

const VALID_FIGHTERS = new Set<FighterId>([
  'sheru',
  'billa',
  'utkarsh',
  'anda',
  'krish',
  'adi',
  'mausi',
  'neta',
  'samyak',
  'father',
]);

const VALID_STAGES = new Set<StageId>([
  'mohalla',
  'school',
  'studio',
  'shaadi',
  'railway',
  'assembly',
]);

const VALID_DIFFICULTIES = new Set<Difficulty>(['easy', 'normal', 'hard']);

export function loadSelectionPrefs(
  storage?: Pick<Storage, 'getItem'> | null,
): StoredSelectionPrefs {
  const fallback: StoredSelectionPrefs = {
    p1Id: 'sheru',
    p2Id: 'billa',
    stageId: 'mohalla',
    difficulty: 'normal',
  };
  const raw = SaveStore.getItem(SELECTION_PREFS_STORAGE_KEY, storage);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSelectionPrefs> | null;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      p1Id:
        parsed.p1Id && VALID_FIGHTERS.has(parsed.p1Id) ? parsed.p1Id : fallback.p1Id,
      p2Id:
        parsed.p2Id && VALID_FIGHTERS.has(parsed.p2Id) ? parsed.p2Id : fallback.p2Id,
      stageId:
        parsed.stageId && VALID_STAGES.has(parsed.stageId) ? parsed.stageId : fallback.stageId,
      difficulty:
        parsed.difficulty && VALID_DIFFICULTIES.has(parsed.difficulty)
          ? parsed.difficulty
          : fallback.difficulty,
    };
  } catch {
    return fallback;
  }
}

export function saveSelectionPrefs(
  prefs: StoredSelectionPrefs,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  SaveStore.setItem(SELECTION_PREFS_STORAGE_KEY, JSON.stringify(prefs), storage);
}
