export const INTRO_DIALOGUE_HOLD_SECONDS = 2.0;
export const INTRO_ROUND1_CALLOUT_SECONDS = 0.85;
export const ROUND1_INTRO_TOTAL_SECONDS =
  INTRO_DIALOGUE_HOLD_SECONDS * 2 + INTRO_ROUND1_CALLOUT_SECONDS; // 4.85s total

export const MID_FIGHT_DIALOGUE_DURATION_MS = 2000;
export const DIALOGUE_POP_IN_MS = 150;
export const DIALOGUE_FADE_START_MS = 1400;
export const DIALOGUE_HUD_TOP_SAFE_PX = 92;
export const DIALOGUE_HUD_TOP_SAFE_COMPACT_PX = 68;
export const DIALOGUE_OUTWARD_NUDGE_PX = 28;
export const MID_FIGHT_RETRIGGER_COOLDOWN_MS = 2500;
export const DIALOGUE_VIEWPORT_PADDING = 12;
export const DIALOGUE_TAIL_HEIGHT = 10;

export function getDialogueHudTopSafePx(viewportH: number): number {
  return viewportH <= 520 ? DIALOGUE_HUD_TOP_SAFE_COMPACT_PX : DIALOGUE_HUD_TOP_SAFE_PX;
}

export interface ActiveFighterDialogue {
  id: number;
  slot: 0 | 1;
  text: string;
  startedAt: number;
  expiresAt: number;
  smoothX: number | null;
  smoothY: number | null;
}

export interface DialogueTracker {
  slots: [ActiveFighterDialogue | null, ActiveFighterDialogue | null];
  cooldownUntil: [number, number];
  nextId: number;
  pausedAt: number | null;
}

export interface IntroDialoguePhase {
  activeSlot: 0 | 1 | null;
  canSkipIntro: boolean;
  showRoundBanner: boolean;
  slotElapsedMs: number;
}

/**
 * Computes smooth opacity for a 2.0s comic speech bubble lifecycle:
 * - 0.0s .. 1.4s: fully opaque (1.0)
 * - 1.4s .. 2.0s: smooth fade-out (1.0 -> 0.0)
 * - >= 2.0s: 0.0
 */
export function computeDialogueBubbleOpacity(
  elapsedMs: number,
  durationMs = MID_FIGHT_DIALOGUE_DURATION_MS,
): number {
  if (elapsedMs < 0 || elapsedMs >= durationMs) return 0;
  const fadeStart = Math.min(DIALOGUE_FADE_START_MS, durationMs * 0.7);
  if (elapsedMs <= fadeStart) return 1;
  const fadeSpan = Math.max(1, durationMs - fadeStart);
  return Math.max(0, Math.min(1, 1 - (elapsedMs - fadeStart) / fadeSpan));
}

export function createDialogueTracker(): DialogueTracker {
  return {
    slots: [null, null],
    cooldownUntil: [0, 0],
    nextId: 1,
    pausedAt: null,
  };
}

/**
 * Pure Round 1 intro dialogue phase resolver:
 * - 0.0s .. 2.0s: Hold P1's intro dialogue box for 2.0 seconds (2000ms) with smooth fade-out at 1.4s..2.0s
 * - 2.0s .. 4.0s: Pan to CPU and hold CPU's intro dialogue box for 2.0 seconds (2000ms)
 * - 4.0s .. 4.85s: Hide intro bubbles, disable skip, slam "ROUND 1" center callout
 */
export function getIntroDialoguePhase(
  roundNumber: number,
  introElapsed: number,
): IntroDialoguePhase {
  if (roundNumber !== 1) {
    return { activeSlot: null, canSkipIntro: false, showRoundBanner: true, slotElapsedMs: 0 };
  }
  const t = Math.max(0, introElapsed);
  if (t < INTRO_DIALOGUE_HOLD_SECONDS) {
    return {
      activeSlot: 0,
      canSkipIntro: true,
      showRoundBanner: false,
      slotElapsedMs: t * 1000,
    };
  }
  if (t < INTRO_DIALOGUE_HOLD_SECONDS * 2) {
    return {
      activeSlot: 1,
      canSkipIntro: true,
      showRoundBanner: false,
      slotElapsedMs: (t - INTRO_DIALOGUE_HOLD_SECONDS) * 1000,
    };
  }
  return { activeSlot: null, canSkipIntro: false, showRoundBanner: true, slotElapsedMs: 0 };
}

/**
 * Triggers a mid-fight dialogue box for a single fighter slot (0 = P1, 1 = CPU)
 * with a strict 2.0-second wall-clock lock (expiresAt = nowMs + 2000).
 *
 * Strictly ignores any new trigger for that fighter while their current 2.0s box
 * is still active (or inside post-expiry cooldown), completely decoupled from
 * combat/animation state changes.
 */
export function triggerMidFightDialogue(
  tracker: DialogueTracker,
  slot: 0 | 1,
  text: string,
  nowMs: number,
  respectCooldown = true,
): boolean {
  const existing = tracker.slots[slot];
  if (existing && nowMs < existing.expiresAt) {
    return false;
  }
  if (respectCooldown && nowMs < tracker.cooldownUntil[slot]) {
    return false;
  }
  tracker.slots[slot] = {
    id: tracker.nextId++,
    slot,
    text,
    startedAt: nowMs,
    expiresAt: nowMs + MID_FIGHT_DIALOGUE_DURATION_MS,
    smoothX: null,
    smoothY: null,
  };
  tracker.cooldownUntil[slot] =
    nowMs + MID_FIGHT_DIALOGUE_DURATION_MS + MID_FIGHT_RETRIGGER_COOLDOWN_MS;
  return true;
}

/**
 * Removes mid-fight dialogue entries ONLY once their full 2000ms timer has elapsed.
 */
export function pruneExpiredDialogues(tracker: DialogueTracker, nowMs: number): void {
  for (let i = 0; i < 2; i++) {
    const entry = tracker.slots[i];
    if (entry && nowMs >= entry.expiresAt) {
      tracker.slots[i] = null;
    }
  }
}

/**
 * Clears active mid-fight bubbles early ONLY when a cinematic Super Power cutscene starts,
 * the player restarts/exits the match, or a new round begins.
 */
export function clearAllMidFightDialogues(tracker: DialogueTracker): void {
  tracker.slots[0] = null;
  tracker.slots[1] = null;
  tracker.cooldownUntil[0] = 0;
  tracker.cooldownUntil[1] = 0;
  tracker.pausedAt = null;
}

export function pauseDialogueTimers(tracker: DialogueTracker, nowMs: number): void {
  if (tracker.pausedAt === null) {
    tracker.pausedAt = nowMs;
  }
}

export function resumeDialogueTimers(tracker: DialogueTracker, nowMs: number): void {
  if (tracker.pausedAt === null) return;
  const pausedMs = Math.max(0, nowMs - tracker.pausedAt);
  tracker.pausedAt = null;
  for (let i = 0; i < 2; i++) {
    const entry = tracker.slots[i];
    if (entry) {
      entry.startedAt += pausedMs;
      entry.expiresAt += pausedMs;
    }
    if (tracker.cooldownUntil[i] > 0) {
      tracker.cooldownUntil[i] += pausedMs;
    }
  }
}

/**
 * Clamps a comic speech bubble anchor (rendered with `transform: translate(-50%, -100%)`)
 * strictly inside the viewport with at least 12px horizontal margin and cleanly BELOW
 * the top HUD bar (`topEdge = y - bubbleH >= topSafeY`).
 */
export function clampDialogueScreenPosition(
  rawX: number,
  rawY: number,
  viewportW: number,
  viewportH: number,
  bubbleW: number,
  bubbleH: number,
  topSafeY = DIALOGUE_HUD_TOP_SAFE_PX,
): { x: number; y: number } {
  const pad = DIALOGUE_VIEWPORT_PADDING;
  const effectiveW = Math.min(bubbleW, Math.max(80, viewportW - pad * 2));
  const halfW = effectiveW * 0.5;
  const minX = pad + halfW;
  const maxX = viewportW - pad - halfW;
  const clampedX =
    minX > maxX ? viewportW * 0.5 : Math.max(minX, Math.min(maxX, rawX));

  const maxY = Math.max(pad + bubbleH, viewportH - pad - DIALOGUE_TAIL_HEIGHT);
  // Anchor is bottom-center (translate -50%, -100%), so bubble top edge is `y - bubbleH`.
  // Requiring `minY = max(pad, topSafeY) + bubbleH` guarantees `bubbleTop >= topSafeY` (e.g. 92px).
  const minY = Math.min(maxY, Math.max(pad, topSafeY) + bubbleH);
  const clampedY = Math.max(minY, Math.min(maxY, rawY));

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
  };
}
