import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkFullscreenSupport,
  enterFullscreen,
  exitFullscreen,
  readIsFullscreen,
  type VendorFullscreenDocument,
} from './fullscreen';

test('checkFullscreenSupport returns false when document is missing or unsupported', () => {
  assert.equal(checkFullscreenSupport(undefined), false);
  assert.equal(checkFullscreenSupport({}), false);
  assert.equal(
    checkFullscreenSupport({
      fullscreenEnabled: false,
      documentElement: { requestFullscreen: async () => {} },
    }),
    false,
  );
});

test('checkFullscreenSupport detects standard and webkit requestFullscreen APIs', () => {
  assert.equal(
    checkFullscreenSupport({
      fullscreenEnabled: true,
      documentElement: { requestFullscreen: async () => {} },
    }),
    true,
  );
  assert.equal(
    checkFullscreenSupport({
      webkitFullscreenEnabled: true,
      documentElement: { webkitRequestFullscreen: async () => {} },
    }),
    true,
  );
});

test('readIsFullscreen checks both standard and webkit fullscreen elements', () => {
  assert.equal(readIsFullscreen(undefined), false);
  assert.equal(readIsFullscreen({ fullscreenElement: null, webkitFullscreenElement: null }), false);
  assert.equal(readIsFullscreen({ fullscreenElement: {} as Element }), true);
  assert.equal(readIsFullscreen({ webkitFullscreenElement: {} as Element }), true);
});

test('enterFullscreen and exitFullscreen invoke vendor fallbacks cleanly', async () => {
  let entered = false;
  let exited = false;
  const mockDoc: VendorFullscreenDocument = {
    webkitFullscreenEnabled: true,
    documentElement: {
      webkitRequestFullscreen: () => {
        entered = true;
      },
    },
    webkitExitFullscreen: () => {
      exited = true;
    },
  };

  assert.equal(await enterFullscreen(mockDoc), true);
  assert.equal(entered, true);

  assert.equal(await exitFullscreen(mockDoc), true);
  assert.equal(exited, true);
});
