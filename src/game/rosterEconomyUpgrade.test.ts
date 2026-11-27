import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPreloadStatusLabel,
  PRELOAD_AUDIO_URLS,
  PRELOAD_GLB_URLS,
  PRELOAD_PORTRAIT_URLS,
  TOTAL_STARTUP_PRELOAD_ASSETS,
} from './assetPreloader';
import {
  FIGHTER_CONFIGS,
  FIGHTER_LIST,
  ROSTER_SLOTS,
  UTKARSH_TEASER_SLOT,
} from './characters';
import { computeCpuInput, createMatchState, getStageAiProfile } from './combat';
import {
  createDialogueTracker,
  formatCompactDialogueLine,
  MAX_ONSCREEN_DIALOGUE_CHARS,
  triggerMidFightDialogue,
} from './dialogue';
import {
  createPlayerAccount,
  FIGHTER_UNLOCK_ADS,
  FIGHTER_UNLOCK_COSTS,
  getFighterAdProgress,
  loadActivePlayerProfile,
  recordRewardedAdWatch,
  STARTER_FIGHTERS,
  type AccountStorage,
} from './playerAccount';

function createMemoryStorage(): AccountStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

test('Exact 10-slot roster sequence, exact maxHp values, and Utkarsh #3 teaser slot isolation', () => {
  assert.equal(ROSTER_SLOTS.length, 10);
  assert.equal(FIGHTER_LIST.length, 9);

  const summary = ROSTER_SLOTS.map((slot) =>
    slot.kind === 'coming_future'
      ? { id: slot.id, maxHp: slot.maxHp, kind: slot.kind }
      : { id: slot.fighter.id, maxHp: slot.fighter.maxHp, kind: slot.kind },
  );

  assert.deepEqual(summary, [
    { id: 'sheru', maxHp: 155, kind: 'playable' },
    { id: 'billa', maxHp: 150, kind: 'playable' },
    { id: 'utkarsh', maxHp: 125, kind: 'coming_future' },
    { id: 'anda', maxHp: 145, kind: 'playable' },
    { id: 'krish', maxHp: 140, kind: 'playable' },
    { id: 'adi', maxHp: 160, kind: 'playable' },
    { id: 'mausi', maxHp: 165, kind: 'playable' },
    { id: 'neta', maxHp: 175, kind: 'playable' },
    { id: 'samyak', maxHp: 185, kind: 'playable' },
    { id: 'father', maxHp: 200, kind: 'playable' },
  ]);

  assert.equal(UTKARSH_TEASER_SLOT.badgeText, 'COMING IN FUTURE');
  assert.equal(UTKARSH_TEASER_SLOT.toastMessage, 'Utkarsh joins the Dangal in the next update!');
  assert.equal(
    FIGHTER_LIST.some((f) => (f.id as string) === 'utkarsh'),
    false,
    'Utkarsh teaser must never enter playable FIGHTER_LIST used by CPU/Friend Room/Super Lab',
  );
  assert.equal(FIGHTER_CONFIGS.father.maxHp, 200);
});

test('Dual Unlock System (Coins OR Ads) enforces exact costs/ad counts, persists ad progress, and auto-unlocks', async () => {
  assert.deepEqual(STARTER_FIGHTERS, ['sheru', 'billa', 'anda', 'krish']);
  assert.deepEqual(FIGHTER_UNLOCK_COSTS, {
    sheru: 0,
    billa: 0,
    anda: 0,
    krish: 0,
    adi: 150,
    mausi: 350,
    neta: 600,
    samyak: 900,
    father: 1500,
  });
  assert.deepEqual(FIGHTER_UNLOCK_ADS, {
    sheru: 0,
    billa: 0,
    anda: 0,
    krish: 0,
    adi: 2,
    mausi: 4,
    neta: 7,
    samyak: 12,
    father: 15,
  });

  const storage = createMemoryStorage();
  let guest = loadActivePlayerProfile(storage);
  assert.equal(guest.unlockedFighters.includes('adi'), false);

  // Watch 1st rewarded ad for Adi (1/2) — persists across reload
  const ad1 = recordRewardedAdWatch(guest, 'adi', storage, null);
  assert.equal(ad1.watched, 1);
  assert.equal(ad1.required, 2);
  assert.equal(ad1.unlockedNow, false);
  assert.equal(ad1.profile.unlockedFighters.includes('adi'), false);

  const reloadedGuest = loadActivePlayerProfile(storage);
  assert.deepEqual(getFighterAdProgress(reloadedGuest, 'adi'), {
    watched: 1,
    required: 2,
    remaining: 1,
  });

  // Creating a new account migrates Guest rewarded ad progress seamlessly
  const created = await createPlayerAccount('ad_watcher', 'secret123', storage, null);
  assert.equal(created.ok, true);
  assert.equal(created.migratedGuest, true);
  let accountProfile = created.profile!;
  assert.equal(getFighterAdProgress(accountProfile, 'adi').watched, 1);

  // Watch 2nd rewarded ad for Adi (2/2) — permanently unlocks Adi!
  const ad2 = recordRewardedAdWatch(accountProfile, 'adi', storage, null);
  assert.equal(ad2.watched, 2);
  assert.equal(ad2.required, 2);
  assert.equal(ad2.unlockedNow, true);
  assert.equal(ad2.profile.unlockedFighters.includes('adi'), true);

  accountProfile = loadActivePlayerProfile(storage);
  assert.equal(accountProfile.unlockedFighters.includes('adi'), true);
});

test('Unified startup preloader covers all 4 GLB heads, 9 PNG portraits, and 10 MP3 audio files', () => {
  assert.equal(PRELOAD_GLB_URLS.length, 4);
  assert.equal(PRELOAD_PORTRAIT_URLS.length, 9);
  assert.equal(PRELOAD_AUDIO_URLS.length, 10);
  assert.equal(TOTAL_STARTUP_PRELOAD_ASSETS, 23);
  assert.equal(
    formatPreloadStatusLabel(11, TOTAL_STARTUP_PRELOAD_ASSETS),
    'Loading 3D Heads, Portraits & Audio (11/23)...',
  );
  assert.ok(PRELOAD_PORTRAIT_URLS.includes('/textures/faces/principal_man.png'));
  assert.ok(PRELOAD_PORTRAIT_URLS.includes('/textures/faces/adi.png'));
  assert.ok(PRELOAD_PORTRAIT_URLS.includes('/textures/faces/krish.png'));
  assert.ok(PRELOAD_AUDIO_URLS.includes('/audio/supers/dahi.mp3'));
});

test('Compact live dialogue formatter enforces single-line punchlines <= 48 chars with zero newlines', () => {
  const longParagraph =
    'This is a super long dialogue paragraph\nspanning multiple lines that should never clutter the 3D arena during live combat!';
  const formatted = formatCompactDialogueLine(longParagraph);
  assert.ok(formatted.length <= MAX_ONSCREEN_DIALOGUE_CHARS);
  assert.equal(formatted.includes('\n'), false);
  assert.ok(formatted.endsWith('…'));

  const tracker = createDialogueTracker();
  triggerMidFightDialogue(tracker, 0, longParagraph, 1000, false);
  assert.ok((tracker.slots[0]?.text.length ?? 0) <= MAX_ONSCREEN_DIALOGUE_CHARS);
});

test('Upgraded Normal Mode CPU AI has 0.18-0.28s decision cadence, ~50% reactive defense, active pursuit, corner escape, whiff punish & decisive Super', () => {
  const s1Normal = getStageAiProfile('mohalla', 'normal');
  assert.ok(s1Normal.thinkMin >= 0.18 && s1Normal.thinkMin <= 0.22);
  assert.ok(s1Normal.thinkMax >= 0.24 && s1Normal.thinkMax <= 0.28);
  const combinedDef = s1Normal.blockChance + s1Normal.dodgeChance;
  assert.ok(combinedDef >= 0.45 && combinedDef <= 0.55, `Expected ~45-55% reactive defense, got ${combinedDef}`);

  // Active pursuit when far across the arena (no idle stalling)
  const farState = createMatchState('sheru', 'billa', true);
  farState.fighters[0].x = -3.5;
  farState.fighters[1].x = 3.5;
  farState.aiThinkTimer = 0.2;
  farState.aiIntentTimer = 0;
  const farInput = computeCpuInput(farState, 'normal', 0.016, () => 0.9, 'mohalla');
  assert.equal(farInput.left, true, 'Normal CPU must close distance actively instead of standing idle');

  // Decisive Super execution at 100% Shakti in range
  const superState = createMatchState('sheru', 'billa', true);
  superState.fighters[0].x = -1.1;
  superState.fighters[1].x = 1.1;
  superState.fighters[1].shakti = 100;
  superState.aiThinkTimer = 0;
  const superInput = computeCpuInput(superState, 'normal', 0.016, () => 0.15, 'mohalla');
  assert.equal(superInput.superMove, true, 'Normal CPU must fire 100% Shakti Super decisively in range');

  // Corner trap escape when backed near wall against pressure
  const cornerState = createMatchState('sheru', 'billa', true);
  cornerState.fighters[0].x = 3.9;
  cornerState.fighters[0].action = 'kick';
  cornerState.fighters[0].actionTimer = 0.05;
  cornerState.fighters[0].actionDuration = 0.4;
  cornerState.fighters[1].x = 5.6;
  cornerState.fighters[1].y = 0;
  cornerState.aiThinkTimer = 0;
  const escapeInput = computeCpuInput(cornerState, 'normal', 0.016, () => 0.1, 'mohalla');
  assert.equal(escapeInput.up, true, 'Cornered Normal CPU should jump out of corner trap');
});
