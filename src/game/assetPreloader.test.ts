import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRELOADER_FALLBACK_TIMEOUT_MS,
  preloadStartupAssets,
  SPLASH_STAGE1_MIN_MS,
} from './assetPreloader';

test('startup preloader timing constants match 2.0s splash and 8.0s fallback spec', () => {
  assert.equal(SPLASH_STAGE1_MIN_MS, 2000);
  assert.equal(PRELOADER_FALLBACK_TIMEOUT_MS, 8000);
});

test('preloadStartupAssets drives THREE.LoadingManager progress up to 100% cleanly', async () => {
  const seenPercents: number[] = [];
  const res = await preloadStartupAssets({
    timeoutMs: 1000,
    onProgress: (info) => {
      seenPercents.push(info.percent);
    },
    runLoader: async (manager) => {
      manager.onStart?.('/models/father_head.glb', 0, 4);
      manager.onProgress?.('/models/father_head.glb', 1, 4);
      manager.onProgress?.('/models/samyak_head.glb', 2, 4);
      manager.onProgress?.('/textures/faces/principal_man.png', 3, 4);
      manager.onProgress?.('/textures/faces/samyak.png', 4, 4);
      manager.onLoad?.();
    },
  });

  assert.equal(res.timedOut, false);
  assert.equal(res.percent, 100);
  assert.equal(res.statusText, 'Arena Ready!');
  assert.ok(seenPercents.length >= 2);
  assert.equal(seenPercents[seenPercents.length - 1], 100);
});

test('preloadStartupAssets resolves safely via fallback timeout if an asset stalls', async () => {
  const res = await preloadStartupAssets({
    timeoutMs: 40,
    runLoader: () => new Promise<void>(() => {}),
  });

  assert.equal(res.timedOut, true);
  assert.equal(res.percent, 100);
  assert.equal(res.statusText, 'Arena Ready!');
});
