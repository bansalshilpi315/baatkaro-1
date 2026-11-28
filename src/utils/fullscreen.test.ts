import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkFullscreenSupport,
  enterFullscreen,
  exitFullscreen,
  hasUserManuallyExitedFullscreen,
  performManualFullscreenToggle,
  readIsFullscreen,
  resetFullscreenStateForTests,
  tryAutoMobileFullscreen,
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

test('checkFullscreenSupport detects standard, webkit, moz, and ms requestFullscreen APIs', () => {
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
  assert.equal(
    checkFullscreenSupport({
      mozFullScreenEnabled: true,
      documentElement: { mozRequestFullScreen: async () => {} },
    }),
    true,
  );
  assert.equal(
    checkFullscreenSupport({
      msFullscreenEnabled: true,
      documentElement: { msRequestFullscreen: async () => {} },
    }),
    true,
  );
});

test('readIsFullscreen checks standard, webkit, moz, and ms fullscreen elements', () => {
  assert.equal(readIsFullscreen(undefined), false);
  assert.equal(
    readIsFullscreen({
      fullscreenElement: null,
      webkitFullscreenElement: null,
      mozFullScreenElement: null,
      msFullscreenElement: null,
    }),
    false,
  );
  assert.equal(readIsFullscreen({ fullscreenElement: {} as Element }), true);
  assert.equal(readIsFullscreen({ webkitFullscreenElement: {} as Element }), true);
  assert.equal(readIsFullscreen({ mozFullScreenElement: {} as Element }), true);
  assert.equal(readIsFullscreen({ msFullscreenElement: {} as Element }), true);
});

test('enterFullscreen and exitFullscreen invoke cross-browser vendor fallbacks cleanly', async () => {
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

  let mozExited = false;
  const mozDoc: VendorFullscreenDocument = {
    mozFullScreenElement: {} as Element,
    exitFullscreen: () => {
      throw new Error('standard exit unavailable');
    },
    mozCancelFullScreen: () => {
      mozExited = true;
    },
  };
  assert.equal(await exitFullscreen(mozDoc), true);
  assert.equal(mozExited, true);

  let msExited = false;
  const msDoc: VendorFullscreenDocument = {
    msFullscreenElement: {} as Element,
    msExitFullscreen: () => {
      msExited = true;
    },
  };
  assert.equal(await exitFullscreen(msDoc), true);
  assert.equal(msExited, true);
});

test('manual exit sets userManuallyExitedFullscreen, blocks auto-fullscreen re-entry, and resets only on explicit enter', async () => {
  resetFullscreenStateForTests();
  const fakeEl = {} as Element;
  let enterCount = 0;
  let exitCount = 0;

  const doc: VendorFullscreenDocument = {
    fullscreenEnabled: true,
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: async () => {
        enterCount += 1;
        doc.fullscreenElement = fakeEl;
      },
    },
    exitFullscreen: async () => {
      exitCount += 1;
      doc.fullscreenElement = null;
    },
  };

  const mobileWin = {
    innerWidth: 844,
    innerHeight: 390,
    matchMedia: () => ({ matches: true }),
  };
  const mobileNav = {
    maxTouchPoints: 5,
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  };

  // 1. Initial auto-fullscreen works on mobile
  assert.equal(hasUserManuallyExitedFullscreen(), false);
  assert.equal(await tryAutoMobileFullscreen(doc, mobileWin, mobileNav), true);
  assert.equal(readIsFullscreen(doc), true);
  assert.equal(enterCount, 1);

  // 2. Clicking Exit Fullscreen exits cleanly and sets userManuallyExitedFullscreen = true
  const exitRes = await performManualFullscreenToggle(doc, true);
  assert.equal(exitRes.action, 'exited');
  assert.equal(exitRes.isFullscreen, false);
  assert.equal(readIsFullscreen(doc), false);
  assert.equal(exitCount, 1);
  assert.equal(hasUserManuallyExitedFullscreen(), true);

  // 3. Subsequent taps / transitions must NOT re-trigger auto-fullscreen
  assert.equal(await tryAutoMobileFullscreen(doc, mobileWin, mobileNav), false);
  assert.equal(readIsFullscreen(doc), false);
  assert.equal(enterCount, 1);

  // 4. Explicitly clicking Fullscreen button resets flag and re-enters fullscreen
  const enterRes = await performManualFullscreenToggle(doc, false);
  assert.equal(enterRes.action, 'entered');
  assert.equal(enterRes.isFullscreen, true);
  assert.equal(readIsFullscreen(doc), true);
  assert.equal(hasUserManuallyExitedFullscreen(), false);
  assert.equal(enterCount, 2);

  resetFullscreenStateForTests();
});
