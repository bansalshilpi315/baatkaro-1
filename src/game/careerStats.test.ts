import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMatchResult,
  CAREER_STATS_STORAGE_KEY,
  createEmptyCareerStats,
  getWinRatePercent,
  loadCareerStats,
  parseCareerStats,
  recordMatchCareerStats,
} from './careerStats';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('Career Stats starts empty and tracks wins, losses, draws, streaks, and win rate', () => {
  let stats = createEmptyCareerStats();
  assert.deepEqual(stats, { wins: 0, losses: 0, draws: 0, currentStreak: 0, bestStreak: 0 });
  assert.equal(getWinRatePercent(stats), 0);

  stats = applyMatchResult(stats, 0);
  stats = applyMatchResult(stats, 0);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 0);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(getWinRatePercent(stats), 100);

  stats = applyMatchResult(stats, 1);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.bestStreak, 2);
  assert.equal(getWinRatePercent(stats), 67);

  stats = applyMatchResult(stats, 'draw');
  assert.equal(stats.draws, 1);
  assert.equal(stats.currentStreak, 0);
  assert.equal(getWinRatePercent(stats), 50);
});

test('Career Stats persists win/loss history cleanly to localStorage and recovers from corrupted data', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadCareerStats(storage), createEmptyCareerStats());

  const afterWin = recordMatchCareerStats(0, storage);
  assert.equal(afterWin.wins, 1);
  assert.equal(afterWin.losses, 0);

  const afterLoss = recordMatchCareerStats(1, storage);
  assert.equal(afterLoss.wins, 1);
  assert.equal(afterLoss.losses, 1);

  const reloaded = loadCareerStats(storage);
  assert.deepEqual(reloaded, afterLoss);

  // Corrupted or malformed payloads fall back safely
  storage.setItem(CAREER_STATS_STORAGE_KEY, '{not-valid-json');
  assert.deepEqual(loadCareerStats(storage), createEmptyCareerStats());

  const sanitized = parseCareerStats(
    JSON.stringify({ wins: -4, losses: 3.9, draws: 'bad', currentStreak: 5, bestStreak: 2 }),
  );
  assert.deepEqual(sanitized, {
    wins: 0,
    losses: 3,
    draws: 0,
    currentStreak: 5,
    bestStreak: 5,
  });
});
