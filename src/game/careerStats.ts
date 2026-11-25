export const CAREER_STATS_STORAGE_KEY = 'desi_showdown_career_stats_v1';

export interface CareerStats {
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;
type ReadWriteStorage = ReadableStorage & WritableStorage;

export function createEmptyCareerStats(): CareerStats {
  return {
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
  };
}

function sanitizeNonNegativeInt(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return 0;
  return Math.floor(val);
}

export function parseCareerStats(raw: string | null): CareerStats {
  if (!raw) return createEmptyCareerStats();
  try {
    const parsed = JSON.parse(raw) as Partial<CareerStats> | null;
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyCareerStats();
    }
    const wins = sanitizeNonNegativeInt(parsed.wins);
    const losses = sanitizeNonNegativeInt(parsed.losses);
    const draws = sanitizeNonNegativeInt(parsed.draws);
    const currentStreak = sanitizeNonNegativeInt(parsed.currentStreak);
    const bestStreak = Math.max(currentStreak, sanitizeNonNegativeInt(parsed.bestStreak));
    return {
      wins,
      losses,
      draws,
      currentStreak,
      bestStreak,
    };
  } catch {
    return createEmptyCareerStats();
  }
}

export function applyMatchResult(
  stats: CareerStats,
  winnerSlot: 0 | 1 | 'draw',
): CareerStats {
  if (winnerSlot === 0) {
    const nextStreak = stats.currentStreak + 1;
    return {
      wins: stats.wins + 1,
      losses: stats.losses,
      draws: stats.draws,
      currentStreak: nextStreak,
      bestStreak: Math.max(stats.bestStreak, nextStreak),
    };
  }
  if (winnerSlot === 1) {
    return {
      wins: stats.wins,
      losses: stats.losses + 1,
      draws: stats.draws,
      currentStreak: 0,
      bestStreak: stats.bestStreak,
    };
  }
  return {
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws + 1,
    currentStreak: 0,
    bestStreak: stats.bestStreak,
  };
}

export function getWinRatePercent(stats: CareerStats): number {
  const total = stats.wins + stats.losses + stats.draws;
  if (total <= 0) return 0;
  return Math.round((stats.wins / total) * 100);
}

function getDefaultStorage(): ReadWriteStorage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore restricted/private-mode storage errors
  }
  return null;
}

export function loadCareerStats(storage?: ReadableStorage | null): CareerStats {
  const target = storage === undefined ? getDefaultStorage() : storage;
  if (!target) return createEmptyCareerStats();
  try {
    return parseCareerStats(target.getItem(CAREER_STATS_STORAGE_KEY));
  } catch {
    return createEmptyCareerStats();
  }
}

export function saveCareerStats(
  stats: CareerStats,
  storage?: WritableStorage | null,
): void {
  const target = storage === undefined ? getDefaultStorage() : storage;
  if (!target) return;
  try {
    target.setItem(CAREER_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota / private mode failures gracefully
  }
}

export function recordMatchCareerStats(
  winnerSlot: 0 | 1 | 'draw',
  storage?: ReadWriteStorage | null,
): CareerStats {
  const current = loadCareerStats(storage);
  const updated = applyMatchResult(current, winnerSlot);
  saveCareerStats(updated, storage);
  return updated;
}
