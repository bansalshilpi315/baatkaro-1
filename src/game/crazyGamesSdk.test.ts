import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  AD_UNAVAILABLE_TOAST,
  CG_SDK,
  CrazyGamesSdkManager,
  MIDGAME_AD_COOLDOWN_MS,
  type CrazyGamesAdCallbacks,
  type CrazyGamesSdkV3,
  type CrazyGamesSettings,
} from './crazyGamesSdk';
import {
  FREE_COINS_AD_REWARD,
  grantRewardedCoins,
  loadActivePlayerProfile,
} from './playerAccount';
import {
  clearSafeStorageFallbackForTests,
  loadSelectionPrefs,
  saveSelectionPrefs,
  SaveStore,
} from '../utils/safeStorage';
import { checkFullscreenSupport } from '../utils/fullscreen';

const ROOT_DIR = process.cwd();

function installMockWindow(sdk?: CrazyGamesSdkV3, localStore?: Storage | null) {
  const prevWindow = (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { window: Record<string, unknown> }).window = {
    CrazyGames: sdk ? { SDK: sdk } : undefined,
    localStorage: localStore === null ? undefined : localStore,
  };
  return () => {
    if (prevWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }
  };
}

function createMemoryDataStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

test('CrazyGames Policy Audit: vite.config.ts uses base ./, zero root-absolute assets, zero mailto/window.open redirects', () => {
  const viteConfig = fs.readFileSync(path.join(ROOT_DIR, 'vite.config.ts'), 'utf8');
  assert.ok(viteConfig.includes("base: './'"), 'vite.config.ts must configure base: "./"');

  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  assert.ok(
    indexHtml.includes('<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'),
    'index.html must load CrazyGames SDK v3 script in <head>',
  );
  assert.equal(indexHtml.includes('href="/logo.png"'), false);
  assert.equal(indexHtml.includes('href="/manifest.json"'), false);

  const settingsSrc = fs.readFileSync(
    path.join(ROOT_DIR, 'src', 'components', 'SettingsModal.tsx'),
    'utf8',
  );
  assert.equal(settingsSrc.includes('mailto:'), false, 'SettingsModal must never use mailto:');
  assert.equal(settingsSrc.includes('window.open'), false, 'SettingsModal must never use window.open');
  assert.equal(
    settingsSrc.includes('window.location.href'),
    false,
    'SettingsModal must never redirect window.location.href',
  );
  assert.ok(settingsSrc.includes('Copy Email'), 'SettingsModal must retain one-tap Copy Email');

  const bugReportSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'utils', 'bugReport.ts'), 'utf8');
  assert.equal(bugReportSrc.includes('mailto:'), false, 'bugReport.ts must contain zero mailto links');
});

test('CG_SDK initializes safely without window.CrazyGames (disabled fallback) and never crashes', async () => {
  const manager = new CrazyGamesSdkManager();
  const restore = installMockWindow(undefined);
  try {
    const env = await manager.init();
    assert.equal(env, 'disabled');
    assert.equal(manager.isInitialized(), true);
    assert.equal(manager.isCrazyGamesHosted(), false);
    assert.equal(manager.getMuteAudioSetting(), null);

    // Lifecycle hooks safely no-op outside CrazyGames
    manager.loadingStart();
    manager.loadingStop();
    manager.gameplayStart();
    manager.gameplayStop();
    manager.happytime();

    // Rewarded ad runs clean simulated fallback in disabled environment
    let started = false;
    let finished = false;
    let rewarded = false;
    const res = await manager.requestRewardedAd({
      simulatedDurationMs: 25,
      onAdStarted: () => {
        started = true;
      },
      onAdFinished: () => {
        finished = true;
      },
      onRewardGranted: () => {
        rewarded = true;
      },
    });
    assert.equal(res.ok, true);
    assert.equal(res.simulated, true);
    assert.equal(started, true);
    assert.equal(finished, true);
    assert.equal(rewarded, true);

    // Midgame ad skips smoothly without blocking in disabled environment
    const midgameRan = await manager.requestMidgameAd();
    assert.equal(midgameRan, false);
  } finally {
    restore();
  }
});

test('CG_SDK wires v3 lifecycle hooks, muteAudio settings listener, rewarded ads, and 3-minute midgame cooldown', async () => {
  const events: string[] = [];
  const settingsHolder: { cb: ((s: CrazyGamesSettings) => void) | null } = { cb: null };
  let nextAdResult: 'finish' | 'error' = 'finish';

  const mockSdk: CrazyGamesSdkV3 = {
    environment: 'crazygames',
    init: async () => {
      events.push('init');
    },
    game: {
      settings: { muteAudio: true },
      sdkGameLoadingStart: () => events.push('loadingStart'),
      sdkGameLoadingStop: () => events.push('loadingStop'),
      gameplayStart: () => events.push('gameplayStart'),
      gameplayStop: () => events.push('gameplayStop'),
      happytime: () => events.push('happytime'),
      addSettingsChangeListener: (cb) => {
        settingsHolder.cb = cb;
      },
    },
    ad: {
      requestAd: (type, callbacks?: CrazyGamesAdCallbacks) => {
        events.push(`ad:${type}`);
        callbacks?.adStarted?.();
        if (nextAdResult === 'finish') {
          callbacks?.adFinished?.();
        } else {
          callbacks?.adError?.({ code: 'adblock' });
        }
      },
    },
  };

  const manager = new CrazyGamesSdkManager();
  const restore = installMockWindow(mockSdk);
  try {
    const env = await manager.init();
    assert.equal(env, 'crazygames');
    assert.equal(manager.isCrazyGamesHosted(), true);
    assert.equal(manager.getMuteAudioSetting(), true);

    // Portal muteAudio settings listener fires reliably
    const receivedMutes: boolean[] = [];
    const unsub = manager.onMuteAudioSettingChange((m) => receivedMutes.push(m));
    settingsHolder.cb?.({ muteAudio: false });
    settingsHolder.cb?.({ muteAudio: true });
    unsub();
    assert.deepEqual(receivedMutes, [false, true]);

    // Deduplicated lifecycle hooks
    manager.loadingStart();
    manager.loadingStart();
    manager.loadingStop();
    manager.loadingStop();
    manager.gameplayStart();
    manager.gameplayStart();
    manager.gameplayStop();
    manager.gameplayStop();
    manager.happytime();

    assert.deepEqual(events, [
      'init',
      'loadingStart',
      'loadingStop',
      'gameplayStart',
      'gameplayStop',
      'happytime',
    ]);

    // Rewarded ad success: mutes on adStarted, restores & grants on adFinished
    const adLog: string[] = [];
    nextAdResult = 'finish';
    const rewardOk = await manager.requestRewardedAd({
      onAdStarted: () => adLog.push('mute'),
      onAdFinished: () => adLog.push('restore'),
      onRewardGranted: () => adLog.push('grant'),
    });
    assert.equal(rewardOk.ok, true);
    assert.equal(rewardOk.simulated, false);
    assert.deepEqual(adLog, ['mute', 'restore', 'grant']);

    // Rewarded ad error: restores audio WITHOUT granting reward & surfaces toast message
    const errLog: string[] = [];
    nextAdResult = 'error';
    const rewardErr = await manager.requestRewardedAd({
      onAdStarted: () => errLog.push('mute'),
      onAdFinished: () => errLog.push('restore'),
      onRewardGranted: () => errLog.push('grant'),
      onAdError: (msg) => errLog.push(`err:${msg}`),
    });
    assert.equal(rewardErr.ok, false);
    assert.deepEqual(errLog, ['mute', 'restore', `err:${AD_UNAVAILABLE_TOAST}`]);

    // Midgame ad enforces strict 3-minute cooldown
    nextAdResult = 'finish';
    const t0 = 1_000_000;
    const mid1 = await manager.requestMidgameAd({ nowMs: t0 });
    assert.equal(mid1, true);
    const midTooSoon = await manager.requestMidgameAd({ nowMs: t0 + MIDGAME_AD_COOLDOWN_MS - 1000 });
    assert.equal(midTooSoon, false, 'Midgame ad must not fire again within 3 minutes');
    const midAfterCooldown = await manager.requestMidgameAd({
      nowMs: t0 + MIDGAME_AD_COOLDOWN_MS,
    });
    assert.equal(midAfterCooldown, true, 'Midgame ad may fire again after 3-minute cooldown');
  } finally {
    restore();
  }
});

test('SaveStore syncs with CrazyGames SDK.data, mirrors to localStorage, and persists Free +50 Coins & loadout', async () => {
  clearSafeStorageFallbackForTests();
  CG_SDK.resetForTests();

  const cgData = createMemoryDataStore();
  const localMirror = createMemoryDataStore();
  const mockSdk: CrazyGamesSdkV3 = {
    environment: 'crazygames',
    init: async () => {},
    data: cgData,
  };

  const restore = installMockWindow(mockSdk, localMirror as unknown as Storage);
  try {
    await CG_SDK.init();

    // Verify CrazyGames desktop iframe fullscreen guard
    const desktopDoc = {
      fullscreenEnabled: true,
      documentElement: { requestFullscreen: async () => {} },
    };
    assert.equal(
      checkFullscreenSupport(desktopDoc),
      false,
      'Desktop fullscreen button should defer to CrazyGames wrapper when hosted on CrazyGames',
    );

    // SaveStore writes to BOTH SDK.data and localStorage mirror
    SaveStore.setItem('test_cg_key', 'hello_arena');
    assert.equal(cgData.getItem('test_cg_key'), 'hello_arena');
    assert.equal(localMirror.getItem('test_cg_key'), 'hello_arena');
    assert.equal(SaveStore.getItem('test_cg_key'), 'hello_arena');

    // Selection preferences persist via SaveStore into SDK.data
    saveSelectionPrefs({
      p1Id: 'krish',
      p2Id: 'utkarsh',
      stageId: 'school',
      difficulty: 'hard',
    });
    assert.deepEqual(loadSelectionPrefs(), {
      p1Id: 'krish',
      p2Id: 'utkarsh',
      stageId: 'school',
      difficulty: 'hard',
    });

    // Grant Free +50 Coins via rewarded ad helper and verify SDK.data persistence
    const startProfile = loadActivePlayerProfile();
    const granted = grantRewardedCoins(startProfile, FREE_COINS_AD_REWARD);
    assert.equal(granted.coinsGranted, 50);
    assert.equal(granted.profile.coins, startProfile.coins + 50);

    // Reload from SaveStore (backed by SDK.data) and confirm coins persisted
    const reloaded = loadActivePlayerProfile();
    assert.equal(reloaded.coins, startProfile.coins + 50);

    SaveStore.removeItem('test_cg_key');
    assert.equal(cgData.getItem('test_cg_key'), null);
    assert.equal(localMirror.getItem('test_cg_key'), null);
  } finally {
    CG_SDK.resetForTests();
    clearSafeStorageFallbackForTests();
    restore();
  }
});
