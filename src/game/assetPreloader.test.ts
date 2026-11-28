import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatPreloadStatusLabel,
  PRELOAD_AUDIO_URLS,
  PRELOAD_GLB_URLS,
  PRELOAD_MAX_RETRIES,
  PRELOAD_PORTRAIT_URLS,
  PRELOAD_RETRY_BACKOFF_MS,
  preloadStartupAssets,
  SPLASH_STAGE1_MIN_MS,
  STARTUP_ASSET_MANIFEST,
  TOTAL_STARTUP_PRELOAD_ASSETS,
  withPreloadRetry,
} from './assetPreloader';

test('startup preloader manifest and retry constants cover all 27 assets with 2 retries', () => {
  assert.equal(SPLASH_STAGE1_MIN_MS, 2000);
  assert.equal(PRELOAD_MAX_RETRIES, 2);
  assert.equal(PRELOAD_RETRY_BACKOFF_MS, 300);
  assert.equal(STARTUP_ASSET_MANIFEST.glbModels.length, 5);
  assert.equal(STARTUP_ASSET_MANIFEST.portraits.length, 10);
  assert.equal(STARTUP_ASSET_MANIFEST.audioFiles.length, 12);
  assert.equal(TOTAL_STARTUP_PRELOAD_ASSETS, 27);
  assert.ok(PRELOAD_AUDIO_URLS.includes('/audio/bgm.mp3'));
  assert.ok(PRELOAD_AUDIO_URLS.includes('/audio/supers/utkarsh.mp3'));
  assert.ok(PRELOAD_GLB_URLS.includes('/models/father_head.glb'));
  assert.ok(PRELOAD_GLB_URLS.includes('/models/samyak_head.glb'));
  assert.ok(PRELOAD_GLB_URLS.includes('/models/adi_head.glb'));
  assert.ok(PRELOAD_GLB_URLS.includes('/models/krish_head.glb'));
  assert.ok(PRELOAD_GLB_URLS.includes('/models/utkarsh_head.glb'));
  assert.equal(PRELOAD_PORTRAIT_URLS.length, 10);
  assert.ok(PRELOAD_PORTRAIT_URLS.includes('/textures/faces/utkarsh.png'));
  assert.equal(
    formatPreloadStatusLabel(12, 27),
    'Loading 3D Models, Portraits & Audio (12 / 27)...',
  );
});

test('preloadStartupAssets strictly waits until 100% of assets complete without early timeout', async () => {
  const seenPercents: number[] = [];
  let releasePendingAsset: () => void = () => {};
  let resolvedEarly = false;

  const preloadPromise = preloadStartupAssets({
    onProgress: (info) => {
      seenPercents.push(info.percent);
    },
    runLoader: async (manager) => {
      manager.onStart?.('/models/father_head.glb', 0, 4);
      manager.onProgress?.('/models/father_head.glb', 1, 4);
      manager.onProgress?.('/models/samyak_head.glb', 2, 4);
      manager.onProgress?.('/audio/bgm.mp3', 3, 4);
      await new Promise<void>((resolve) => {
        releasePendingAsset = resolve;
      });
      manager.onProgress?.('/textures/faces/principal_man.png', 4, 4);
      manager.onLoad?.();
    },
  }).then((res) => {
    resolvedEarly = true;
    return res;
  });

  // Give microtasks & timers time to verify preloader does NOT resolve before the final asset finishes
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(resolvedEarly, false, 'Preloader must strictly wait for 100% asset completion');
  assert.equal(seenPercents[seenPercents.length - 1], 75);

  // Release final asset -> should immediately hit 100% and resolve
  releasePendingAsset();
  const res = await preloadPromise;

  assert.equal(res.timedOut, false);
  assert.equal(res.percent, 100);
  assert.equal(res.loadedItems, 4);
  assert.equal(res.totalItems, 4);
  assert.equal(res.statusText, 'Arena Ready!');
  assert.equal(seenPercents[seenPercents.length - 1], 100);
});

test('withPreloadRetry retries transient failures up to 2 times before succeeding or falling back cleanly', async () => {
  let attemptCount = 0;
  const recovered = await withPreloadRetry(
    async () => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error('transient network error');
      }
      return 'loaded-ok';
    },
    2,
    5,
  );
  assert.equal(recovered.ok, true);
  assert.equal(recovered.value, 'loaded-ok');
  assert.equal(recovered.attempts, 3);

  let failAttempts = 0;
  const failed = await withPreloadRetry(
    async () => {
      failAttempts += 1;
      throw new Error('permanent failure');
    },
    2,
    5,
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.attempts, 3);
  assert.equal(failAttempts, 3);
});
