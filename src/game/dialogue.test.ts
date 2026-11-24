import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIALOGUE_TAIL_HEIGHT,
  DIALOGUE_VIEWPORT_PADDING,
  INTRO_DIALOGUE_HOLD_SECONDS,
  MID_FIGHT_DIALOGUE_DURATION_MS,
  MID_FIGHT_RETRIGGER_COOLDOWN_MS,
  ROUND1_INTRO_TOTAL_SECONDS,
  clampDialogueScreenPosition,
  clearAllMidFightDialogues,
  createDialogueTracker,
  getIntroDialoguePhase,
  pauseDialogueTimers,
  pruneExpiredDialogues,
  resumeDialogueTimers,
  triggerMidFightDialogue,
} from './dialogue';

test('Pre-fight Round 1 intro holds P1 dialogue for full 4.0s, then CPU dialogue for full 4.0s, then ROUND 1', () => {
  assert.equal(INTRO_DIALOGUE_HOLD_SECONDS, 4.0);
  assert.equal(ROUND1_INTRO_TOTAL_SECONDS, 8.85);

  // P1 holds from 0.0s through 3.99s with Tap to Skip available
  const p1Start = getIntroDialoguePhase(1, 0.0);
  const p1End = getIntroDialoguePhase(1, 3.99);
  assert.deepEqual(p1Start, { activeSlot: 0, canSkipIntro: true, showRoundBanner: false });
  assert.deepEqual(p1End, { activeSlot: 0, canSkipIntro: true, showRoundBanner: false });

  // CPU holds from 4.0s through 7.99s with Tap to Skip available
  const cpuStart = getIntroDialoguePhase(1, 4.0);
  const cpuEnd = getIntroDialoguePhase(1, 7.99);
  assert.deepEqual(cpuStart, { activeSlot: 1, canSkipIntro: true, showRoundBanner: false });
  assert.deepEqual(cpuEnd, { activeSlot: 1, canSkipIntro: true, showRoundBanner: false });

  // At 8.0s+, intro bubbles end, skip hides, and ROUND 1 banner appears
  const roundBanner = getIntroDialoguePhase(1, 8.0);
  assert.deepEqual(roundBanner, { activeSlot: null, canSkipIntro: false, showRoundBanner: true });

  // Round 2+ skips pre-fight dialogue bubbles and shows round banner directly
  assert.deepEqual(getIntroDialoguePhase(2, 0.2), {
    activeSlot: null,
    canSkipIntro: false,
    showRoundBanner: true,
  });
});

test('Mid-fight dialogue locks for strict 4000ms per fighter independently and ignores overwrites while active', () => {
  const tracker = createDialogueTracker();
  const t0 = 10000;

  // Trigger P1 roast
  assert.equal(triggerMidFightDialogue(tracker, 0, 'First P1 roast!', t0), true);
  assert.equal(tracker.slots[0]?.text, 'First P1 roast!');
  assert.equal(tracker.slots[0]?.expiresAt, t0 + MID_FIGHT_DIALOGUE_DURATION_MS);

  // Attempting to overwrite P1 at 1000ms, 2500ms, or 3999ms MUST be ignored!
  assert.equal(triggerMidFightDialogue(tracker, 0, 'Overwrite attempt!', t0 + 1000), false);
  assert.equal(triggerMidFightDialogue(tracker, 0, 'Another attempt!', t0 + 3999), false);
  pruneExpiredDialogues(tracker, t0 + 3999);
  assert.equal(tracker.slots[0]?.text, 'First P1 roast!', 'P1 box must remain locked until full 4000ms');

  // CPU slot is completely independent and can trigger without clearing P1!
  assert.equal(triggerMidFightDialogue(tracker, 1, 'CPU counter roast!', t0 + 1500), true);
  assert.equal(tracker.slots[0]?.text, 'First P1 roast!');
  assert.equal(tracker.slots[1]?.text, 'CPU counter roast!');
  assert.equal(tracker.slots[1]?.expiresAt, t0 + 1500 + MID_FIGHT_DIALOGUE_DURATION_MS);

  // At t0 + 4000ms, ONLY P1 expires; CPU stays visible until t0 + 5500ms!
  pruneExpiredDialogues(tracker, t0 + 4000);
  assert.equal(tracker.slots[0], null);
  assert.equal(tracker.slots[1]?.text, 'CPU counter roast!');

  // Re-trigger for P1 respects post-expiry cooldown, then works cleanly
  assert.equal(triggerMidFightDialogue(tracker, 0, 'Too soon', t0 + 4100), false);
  assert.equal(
    triggerMidFightDialogue(tracker, 0, 'Fresh P1 roast', t0 + 4000 + MID_FIGHT_RETRIGGER_COOLDOWN_MS),
    true,
  );

  // Super cutscene / match restart clears all active bubbles cleanly
  clearAllMidFightDialogues(tracker);
  assert.equal(tracker.slots[0], null);
  assert.equal(tracker.slots[1], null);
});

test('Pausing and resuming preserves the remaining 4.0s dialogue window accurately', () => {
  const tracker = createDialogueTracker();
  triggerMidFightDialogue(tracker, 0, 'Hold through pause!', 5000);
  pauseDialogueTimers(tracker, 6500); // 2500ms remaining
  resumeDialogueTimers(tracker, 12500); // Paused for 6000ms
  assert.equal(tracker.slots[0]?.expiresAt, 15000);

  pruneExpiredDialogues(tracker, 14999);
  assert.ok(tracker.slots[0], 'Bubble must still be active right before shifted expiry');
  pruneExpiredDialogues(tracker, 15000);
  assert.equal(tracker.slots[0], null);
});

test('Viewport clamping strictly keeps floating speech boxes within 12px screen margins on mobile landscape', () => {
  const vw = 667;
  const vh = 375;
  const bw = 224;
  const bh = 78;

  // Far top-left fighter near edge
  const topLeft = clampDialogueScreenPosition(-40, 10, vw, vh, bw, bh, 110);
  assert.ok(topLeft.x - bw / 2 >= DIALOGUE_VIEWPORT_PADDING, 'Left edge must respect 12px margin');
  assert.ok(topLeft.y - bh >= DIALOGUE_VIEWPORT_PADDING, 'Top edge must respect 12px margin');

  // Far bottom-right fighter near edge
  const bottomRight = clampDialogueScreenPosition(vw + 90, vh + 40, vw, vh, bw, bh, 110);
  assert.ok(
    bottomRight.x + bw / 2 <= vw - DIALOGUE_VIEWPORT_PADDING,
    'Right edge must respect 12px margin',
  );
  assert.ok(
    bottomRight.y + DIALOGUE_TAIL_HEIGHT <= vh - DIALOGUE_VIEWPORT_PADDING,
    'Bottom edge including tail must respect 12px margin',
  );
});
