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

/**
 * Crisp English subtitle translations for all Hindi/Hinglish intro taunts,
 * knockdown quips, mid-fight roasts, and victory lines so international players
 * immediately enjoy every 2.0-second dialogue popup.
 */
export const DIALOGUE_ENGLISH_SUBTITLES: Record<string, string> = {
  // Sheru Bhai
  'Tera budget khatam, meri entry shuru!': "Your budget's over — my grand entry begins!",
  'Aaj Sensex bhi neeche, tu bhi neeche!': 'Market is down today, and so are you!',
  'Suit dekh, attitude dekh — ab pitai dekh!': 'Check the suit, check the swagger — now face the beatdown!',
  'Arre mera Armani suit!': 'Hey, my Armani suit!',
  'Audit karwaunga iska!': "I'll get this audited!",
  'Ye le 18% GST ke saath pitai!': 'Take this beatdown with 18% tax included!',
  'Tera portfolio laal kar diya bhai!': 'Just turned your portfolio deep red, bro!',
  'Bill tera, swag mera — paisa vasool!': 'Your bill, my swagger — totally worth it!',
  'Full paisa vasool, bhai!': '100% money well spent, bro!',

  // Blue Billa
  'Aaj teri chhutti, swatter tayyar hai!': "Your day's over — the swatter is ready!",
  'Machhar samjha kya? Phatak se uda dunga!': "Think I'm a mosquito? I'll swat you flying!",
  'Chai garam, swatter kadak — aaja bhid le!': 'Tea is hot, swatter is crisp — bring it on!',
  'Meow!! Yeh cheating hai!': 'Meow!! That is totally cheating!',
  'Mera swatter kidhar gaya?!': 'Where did my swatter go?!',
  'Phatak! Machhar jaise uda diya!': 'Smack! Sent you flying like a bug!',
  'Meow! Swatter ka swaad kaisa laga?': 'Meow! How did that swatter taste?',
  'Aaj chai thandi, par thappad garam!': 'The tea is cold, but that slap is piping hot!',
  'Clean sweep — ekdum jhakaas!': 'Clean sweep — totally awesome!',

  // Garib Sena Neta
  'Aam aadmi ka gussa mat jaga beta!': "Don't wake the common man's fury, kid!",
  'Jhola halka hai, par jhatka bhari padega!': 'My tote bag is light, but my shock hits heavy!',
  'Seedha dharna aur full hisaab hoga aaj!': 'Full protest and full payback today!',
  'Yeh janta pe atyachaar hai!': 'This is injustice against the public!',
  'Chashma bach gaya!': 'My glasses survived!',
  'Janta ka faisla seedha mukke se!': "The people's verdict — delivered by fist!",
  'Dharna mode ON — ab bhaag mat!': "Protest mode ON — don't run now!",
  'Chanda nahi, seedha danda milega!': 'No donations — just a straight smackdown!',
  'Janta ki jeet! Cutting chai lao!': 'Victory for the people! Bring the tea!',
  'Jhola-chaap power zindabad!': 'Long live grassroots power!',

  // Anda Bhai
  'Crack mat bolna, hard-boiled hoon main!': "Don't call me cracked — I'm hard-boiled!",
  'Deewar se gira par akad nahi tooti!': 'Fell off the wall, but my pride never broke!',
  'Omelette tera banega, mera nahi!': "You're getting scrambled, not me!",
  'Arre shell bachao!': 'Hey, protect the shell!',
  'Kisi ne farsh pe tel giraya!': 'Someone spilled oil on the floor!',
  'Hard-boiled Power! Crack nahi hone dunga!': "Hard-boiled power! Won't let it crack!",
  'Omelette banne se pehle hi flat kar diya!': 'Flattened you before you could scramble me!',
  'Protein punch seedha muh pe!': 'Protein punch straight to the face!',

  // Laddoo Mausi
  'Laddoo khayega ya belan khayega beta?': 'Want sweet laddoos or the rolling pin, kid?',
  'Aaj full desi ghee wali sutai hogi!': 'Full homemade-ghee beatdown coming up!',
  'Dukaan band karwaunga? Pehle belan jhel!': 'Close my shop? Survive my rolling pin first!',
  'Haye meri kamar! Ab dekh!': 'Oh, my back! Now you are in for it!',
  'Belan se double badla lungi!': "I'll get double revenge with my rolling pin!",
  'Aaj belan ka VIP treatment milega!': "You're getting the VIP rolling-pin treatment!",
  'Meetha kam, sutai zyada — shabaash!': 'Less sweets, more beatdown — bravo!',
  'Aunty se panga? Seedha chappal-belan combo!': 'Messing with Aunty? Eat the slipper-pin combo!',
  'Ab ja aur garma-garam laddoo kha!': 'Now go enjoy some hot sweet laddoos!',
  'Belan ke aage koi tikta hai kya?': 'Can anyone stand up to the rolling pin?',

  // Principal Man
  'Uniform kahan hai?! Diary nikaal abhi!': 'Where is your uniform?! Take out your diary now!',
  'Line seedhi karo — discipline pehle, baaki baad mein!': 'Straighten the line — discipline first, everything else later!',

  // Samyak
  'Subah 5 baje deadlift, shaam ko Laxmikanth — ready hai kya?': '5 AM deadlifts, evening exam prep — are you ready?',
  'Body bhi hai aur dimaag bhi — ab dekh IAS ki power!': 'Got brawn and brains — now feel top-rank power!',
  '18 ghante padhai aur 2 ghante gym — aaj teri Prelims fail!': '18 hrs study, 2 hrs gym — you fail Round 1 today!',
  'Arre mera pre-workout gir gaya!': 'Hey, my pre-workout spilled!',
  'Prelims mein jhatka, Mains mein phod dunga!': 'Shaken in Round 1 — I will crush the finals!',
  'Ye le Laxmikanth 7th Edition seedha muh pe!': 'Take this heavy Polity textbook straight to the face!',
  'Article 21 tera defense suspend kar diya!': 'Article 21 just suspended your defense!',
  'First attempt mein hi knockout — AIR 1 confirmed!': 'Knockout on the very first attempt — Rank 1 confirmed!',
  'Gym pump bhi solid, Polity bhi solid!': 'Solid gym pump, solid exam prep!',
};

export function getEnglishSubtitle(text: string): string | undefined {
  return DIALOGUE_ENGLISH_SUBTITLES[text];
}
