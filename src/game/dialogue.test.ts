import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIALOGUE_FADE_START_MS,
  DIALOGUE_HUD_TOP_SAFE_PX,
  DIALOGUE_TAIL_HEIGHT,
  DIALOGUE_VIEWPORT_PADDING,
  INTRO_DIALOGUE_HOLD_SECONDS,
  MID_FIGHT_DIALOGUE_DURATION_MS,
  MID_FIGHT_RETRIGGER_COOLDOWN_MS,
  ROUND1_INTRO_TOTAL_SECONDS,
  clampDialogueScreenPosition,
  clearAllMidFightDialogues,
  computeDialogueBubbleOpacity,
  createDialogueTracker,
  getIntroDialoguePhase,
  pauseDialogueTimers,
  pruneExpiredDialogues,
  resumeDialogueTimers,
  triggerMidFightDialogue,
} from './dialogue';

test('Pre-fight Round 1 intro holds P1 dialogue for 2.0s, then CPU dialogue for 2.0s, then ROUND 1', () => {
  assert.equal(INTRO_DIALOGUE_HOLD_SECONDS, 2.0);
  assert.equal(ROUND1_INTRO_TOTAL_SECONDS, 4.85);

  // P1 holds from 0.0s through 1.99s with Tap to Skip available
  const p1Start = getIntroDialoguePhase(1, 0.0);
  const p1End = getIntroDialoguePhase(1, 1.99);
  assert.equal(p1Start.activeSlot, 0);
  assert.equal(p1Start.canSkipIntro, true);
  assert.equal(p1Start.showRoundBanner, false);
  assert.equal(p1End.activeSlot, 0);
  assert.equal(p1End.canSkipIntro, true);
  assert.ok(Math.abs(p1End.slotElapsedMs - 1990) < 1);

  // CPU holds from 2.0s through 3.99s with Tap to Skip available
  const cpuStart = getIntroDialoguePhase(1, 2.0);
  const cpuEnd = getIntroDialoguePhase(1, 3.99);
  assert.equal(cpuStart.activeSlot, 1);
  assert.equal(cpuStart.canSkipIntro, true);
  assert.equal(cpuEnd.activeSlot, 1);
  assert.ok(Math.abs(cpuEnd.slotElapsedMs - 1990) < 1);

  // At 4.0s+, intro bubbles end, skip hides, and ROUND 1 banner appears
  const roundBanner = getIntroDialoguePhase(1, 4.0);
  assert.deepEqual(roundBanner, {
    activeSlot: null,
    canSkipIntro: false,
    showRoundBanner: true,
    slotElapsedMs: 0,
  });

  // Round 2+ skips pre-fight dialogue bubbles and shows round banner directly
  assert.deepEqual(getIntroDialoguePhase(2, 0.2), {
    activeSlot: null,
    canSkipIntro: false,
    showRoundBanner: true,
    slotElapsedMs: 0,
  });
});

test('Speech bubble opacity stays opaque from 0..1.4s and smoothly fades out from 1.4s..2.0s', () => {
  assert.equal(DIALOGUE_FADE_START_MS, 1400);
  assert.equal(computeDialogueBubbleOpacity(0), 1);
  assert.equal(computeDialogueBubbleOpacity(150), 1);
  assert.equal(computeDialogueBubbleOpacity(1400), 1);
  const midFade = computeDialogueBubbleOpacity(1700);
  assert.ok(Math.abs(midFade - 0.5) < 0.001, `Expected ~0.5 opacity at 1.7s, got ${midFade}`);
  const nearEnd = computeDialogueBubbleOpacity(1940);
  assert.ok(nearEnd > 0 && nearEnd < 0.15);
  assert.equal(computeDialogueBubbleOpacity(2000), 0);
  assert.equal(computeDialogueBubbleOpacity(2500), 0);
});

test('Mid-fight dialogue locks for 2000ms per fighter independently and ignores overwrites while active', () => {
  const tracker = createDialogueTracker();
  const t0 = 10000;

  // Trigger P1 roast
  assert.equal(triggerMidFightDialogue(tracker, 0, 'First P1 roast!', t0), true);
  assert.equal(tracker.slots[0]?.text, 'First P1 roast!');
  assert.equal(tracker.slots[0]?.expiresAt, t0 + MID_FIGHT_DIALOGUE_DURATION_MS);

  // Attempting to overwrite P1 at 500ms or 1999ms MUST be ignored!
  assert.equal(triggerMidFightDialogue(tracker, 0, 'Overwrite attempt!', t0 + 500), false);
  assert.equal(triggerMidFightDialogue(tracker, 0, 'Another attempt!', t0 + 1999), false);
  pruneExpiredDialogues(tracker, t0 + 1999);
  assert.equal(tracker.slots[0]?.text, 'First P1 roast!', 'P1 box must remain locked until full 2000ms');

  // CPU slot is completely independent and can trigger without clearing P1!
  assert.equal(triggerMidFightDialogue(tracker, 1, 'CPU counter roast!', t0 + 800), true);
  assert.equal(tracker.slots[0]?.text, 'First P1 roast!');
  assert.equal(tracker.slots[1]?.text, 'CPU counter roast!');
  assert.equal(tracker.slots[1]?.expiresAt, t0 + 800 + MID_FIGHT_DIALOGUE_DURATION_MS);

  // At t0 + 2000ms, ONLY P1 expires; CPU stays visible until t0 + 2800ms!
  pruneExpiredDialogues(tracker, t0 + 2000);
  assert.equal(tracker.slots[0], null);
  assert.equal(tracker.slots[1]?.text, 'CPU counter roast!');

  // Re-trigger for P1 respects post-expiry cooldown, then works cleanly
  assert.equal(triggerMidFightDialogue(tracker, 0, 'Too soon', t0 + 2100), false);
  assert.equal(
    triggerMidFightDialogue(tracker, 0, 'Fresh P1 roast', t0 + 2000 + MID_FIGHT_RETRIGGER_COOLDOWN_MS),
    true,
  );

  // Super cutscene / match restart clears all active bubbles cleanly
  clearAllMidFightDialogues(tracker);
  assert.equal(tracker.slots[0], null);
  assert.equal(tracker.slots[1], null);
});

test('Pausing and resuming preserves the remaining 2.0s dialogue window accurately', () => {
  const tracker = createDialogueTracker();
  triggerMidFightDialogue(tracker, 0, 'Hold through pause!', 5000);
  pauseDialogueTimers(tracker, 5800); // 1200ms remaining
  resumeDialogueTimers(tracker, 11800); // Paused for 6000ms
  assert.equal(tracker.slots[0]?.expiresAt, 13000);

  pruneExpiredDialogues(tracker, 12999);
  assert.ok(tracker.slots[0], 'Bubble must still be active right before shifted expiry');
  pruneExpiredDialogues(tracker, 13000);
  assert.equal(tracker.slots[0], null);
});

test('Viewport clamping keeps speech bubbles strictly below top HUD bar (92px) and within 12px screen margins', () => {
  const vw = 844;
  const vh = 390;
  const bw = 196;
  const bh = 58;

  // Far top-left fighter projected above screen
  const topLeft = clampDialogueScreenPosition(-40, 10, vw, vh, bw, bh, DIALOGUE_HUD_TOP_SAFE_PX);
  assert.ok(topLeft.x - bw / 2 >= DIALOGUE_VIEWPORT_PADDING, 'Left edge must respect 12px margin');
  assert.ok(
    topLeft.y - bh >= DIALOGUE_HUD_TOP_SAFE_PX,
    `Bubble top edge (${topLeft.y - bh}) must stay strictly below HUD bar (${DIALOGUE_HUD_TOP_SAFE_PX}px)`,
  );

  // Far bottom-right fighter near edge
  const bottomRight = clampDialogueScreenPosition(vw + 90, vh + 40, vw, vh, bw, bh, DIALOGUE_HUD_TOP_SAFE_PX);
  assert.ok(
    bottomRight.x + bw / 2 <= vw - DIALOGUE_VIEWPORT_PADDING,
    'Right edge must respect 12px margin',
  );
  assert.ok(
    bottomRight.y + DIALOGUE_TAIL_HEIGHT <= vh - DIALOGUE_VIEWPORT_PADDING,
    'Bottom edge including tail must respect 12px margin',
  );
});
