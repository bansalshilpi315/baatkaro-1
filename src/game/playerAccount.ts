import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import type { FighterId } from './types';

export const ACCOUNT_REGISTRY_STORAGE_KEY = 'desi_dangal_account_registry_v1';
export const ACTIVE_SESSION_STORAGE_KEY = 'desi_dangal_active_session_v1';
export const GUEST_PROGRESS_STORAGE_KEY = 'desi_dangal_guest_progress_v1';
export const CREATOR_PROGRESS_STORAGE_KEY = 'desi_dangal_creator_progress_v1';

export const STARTER_FIGHTERS: FighterId[] = ['sheru', 'billa', 'neta', 'anda', 'adi', 'krish'];
export const ALL_FIGHTER_IDS: FighterId[] = [
  'sheru',
  'billa',
  'neta',
  'anda',
  'mausi',
  'father',
  'samyak',
  'adi',
  'krish',
];

export const FIGHTER_UNLOCK_COSTS: Record<FighterId, number> = {
  sheru: 0,
  billa: 0,
  neta: 0,
  anda: 0,
  mausi: 100,
  father: 150,
  samyak: 250,
  adi: 0,
  krish: 0,
};

export const STAGE_UNLOCK_COSTS: Record<number, number> = {
  1: 0,
  2: 50,
  3: 75,
  4: 100,
  5: 125,
  6: 150,
};

export const DEFAULT_GUEST_COINS = 100;
export const MATCH_WIN_COIN_REWARD = 75;
export const MATCH_LOSS_COIN_REWARD = 20;
export const STAGE_CLEAR_BONUS_COINS = 50;

export const CREATOR_ACCOUNT_ID = '@ansh_games';
export const CREATOR_COINS = 999999;
// Precomputed SHA-256 hex digest for reserved creator verification (never store plaintext)
const CREATOR_PASS_SHA256_DIGEST =
  '2babfc80344f5e6ae59232d62aa7ddc4271481705f576eb64efe57dd0e9d48b7';

const RESERVED_USERNAMES = new Set<string>([CREATOR_ACCOUNT_ID, 'guest']);
const USERNAME_PATTERN = /^[a-zA-Z0-9_@-]{3,16}$/;

export type PlayerSessionMode = 'guest' | 'account';

export interface PlayerAccountRecord {
  displayName: string;
  passwordHash: string;
  coins: number;
  unlockedFighters: FighterId[];
  highestStage: number;
  wins: number;
  updatedAt: number;
}

export interface GuestProgressRecord {
  coins: number;
  unlockedFighters: FighterId[];
  highestStage: number;
  wins: number;
  updatedAt: number;
}

export interface PlayerProfile {
  username: string;
  displayName: string;
  mode: PlayerSessionMode;
  coins: number;
  unlockedFighters: FighterId[];
  highestStage: number;
  allModesUnlocked: boolean;
  wins: number;
  updatedAt: number;
  isCreator: boolean;
}

export interface UsernameValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

export interface UsernameAvailabilityResult {
  available: boolean;
  normalized: string;
  reason: 'invalid' | 'taken' | 'available';
  message: string;
}

export interface AuthResult {
  ok: boolean;
  profile?: PlayerProfile;
  error?: string;
  migratedGuest?: boolean;
}

export interface PlayerCloudAdapter {
  getPlayer: (normalizedUsername: string) => Promise<PlayerAccountRecord | null>;
  savePlayer: (
    normalizedUsername: string,
    record: PlayerAccountRecord,
  ) => Promise<void>;
}

interface StoredSessionState {
  mode: PlayerSessionMode;
  username?: string;
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;
export type AccountStorage = ReadableStorage & WritableStorage;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsernameFormat(raw: string): UsernameValidationResult {
  const trimmed = raw.trim();
  const normalized = trimmed.toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 16) {
    return {
      valid: false,
      normalized,
      error: 'Username must be 3 to 16 characters.',
    };
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      normalized,
      error: 'Use only letters, numbers, @, _ or -.',
    };
  }
  return { valid: true, normalized };
}

export function isReservedUsername(raw: string): boolean {
  return RESERVED_USERNAMES.has(normalizeUsername(raw));
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sanitizeFighters(list: unknown, includeAll = false): FighterId[] {
  if (includeAll) return [...ALL_FIGHTER_IDS];
  const set = new Set<FighterId>(STARTER_FIGHTERS);
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === 'string' && (ALL_FIGHTER_IDS as string[]).includes(item)) {
        set.add(item as FighterId);
      }
    }
  }
  return ALL_FIGHTER_IDS.filter((id) => set.has(id));
}

function sanitizeStage(val: unknown, fallback = 1): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(1, Math.min(6, Math.floor(val)));
}

function sanitizeNonNegInt(val: unknown, fallback = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return fallback;
  return Math.floor(val);
}

export function createDefaultGuestProgress(): GuestProgressRecord {
  return {
    coins: DEFAULT_GUEST_COINS,
    unlockedFighters: [...STARTER_FIGHTERS],
    highestStage: 1,
    wins: 0,
    updatedAt: Date.now(),
  };
}

function createCreatorProfile(existing?: Partial<GuestProgressRecord> | null): PlayerProfile {
  return {
    username: CREATOR_ACCOUNT_ID,
    displayName: CREATOR_ACCOUNT_ID,
    mode: 'account',
    coins: Math.max(CREATOR_COINS, sanitizeNonNegInt(existing?.coins, CREATOR_COINS)),
    unlockedFighters: [...ALL_FIGHTER_IDS],
    highestStage: 6,
    allModesUnlocked: true,
    wins: sanitizeNonNegInt(existing?.wins, 0),
    updatedAt: Date.now(),
    isCreator: true,
  };
}

function recordToProfile(
  normalizedUsername: string,
  record: PlayerAccountRecord,
): PlayerProfile {
  const highestStage = sanitizeStage(record.highestStage, 1);
  return {
    username: normalizedUsername,
    displayName: record.displayName || normalizedUsername,
    mode: 'account',
    coins: sanitizeNonNegInt(record.coins, DEFAULT_GUEST_COINS),
    unlockedFighters: sanitizeFighters(record.unlockedFighters),
    highestStage,
    allModesUnlocked: highestStage >= 2,
    wins: sanitizeNonNegInt(record.wins, 0),
    updatedAt: sanitizeNonNegInt(record.updatedAt, Date.now()),
    isCreator: false,
  };
}

function guestToProfile(guest: GuestProgressRecord): PlayerProfile {
  const highestStage = sanitizeStage(guest.highestStage, 1);
  return {
    username: 'guest',
    displayName: 'Guest',
    mode: 'guest',
    coins: sanitizeNonNegInt(guest.coins, DEFAULT_GUEST_COINS),
    unlockedFighters: sanitizeFighters(guest.unlockedFighters),
    highestStage,
    allModesUnlocked: highestStage >= 2,
    wins: sanitizeNonNegInt(guest.wins, 0),
    updatedAt: sanitizeNonNegInt(guest.updatedAt, Date.now()),
    isCreator: false,
  };
}

function readRegistry(storage?: ReadableStorage | null): Record<string, PlayerAccountRecord> {
  if (storage === null) return {};
  const raw = safeGetItem(ACCOUNT_REGISTRY_STORAGE_KEY, storage);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, PlayerAccountRecord> | null;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeRegistry(
  registry: Record<string, PlayerAccountRecord>,
  storage?: WritableStorage | null,
): void {
  if (storage === null) return;
  safeSetItem(ACCOUNT_REGISTRY_STORAGE_KEY, JSON.stringify(registry), storage);
}

function readGuestProgress(storage?: ReadableStorage | null): GuestProgressRecord {
  if (storage === null) return createDefaultGuestProgress();
  const raw = safeGetItem(GUEST_PROGRESS_STORAGE_KEY, storage);
  if (!raw) return createDefaultGuestProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<GuestProgressRecord> | null;
    if (!parsed || typeof parsed !== 'object') return createDefaultGuestProgress();
    return {
      coins: sanitizeNonNegInt(parsed.coins, DEFAULT_GUEST_COINS),
      unlockedFighters: sanitizeFighters(parsed.unlockedFighters),
      highestStage: sanitizeStage(parsed.highestStage, 1),
      wins: sanitizeNonNegInt(parsed.wins, 0),
      updatedAt: sanitizeNonNegInt(parsed.updatedAt, Date.now()),
    };
  } catch {
    return createDefaultGuestProgress();
  }
}

function writeGuestProgress(
  guest: GuestProgressRecord,
  storage?: WritableStorage | null,
): void {
  if (storage === null) return;
  safeSetItem(GUEST_PROGRESS_STORAGE_KEY, JSON.stringify(guest), storage);
}

function readCreatorProgress(storage?: ReadableStorage | null): Partial<GuestProgressRecord> | null {
  if (storage === null) return null;
  const raw = safeGetItem(CREATOR_PROGRESS_STORAGE_KEY, storage);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GuestProgressRecord> | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCreatorProgress(
  profile: PlayerProfile,
  storage?: WritableStorage | null,
): void {
  if (storage === null) return;
  const payload: GuestProgressRecord = {
    coins: profile.coins,
    unlockedFighters: [...ALL_FIGHTER_IDS],
    highestStage: 6,
    wins: profile.wins,
    updatedAt: profile.updatedAt,
  };
  safeSetItem(CREATOR_PROGRESS_STORAGE_KEY, JSON.stringify(payload), storage);
}

function readSession(storage?: ReadableStorage | null): StoredSessionState {
  if (storage === null) return { mode: 'guest' };
  const raw = safeGetItem(ACTIVE_SESSION_STORAGE_KEY, storage);
  if (!raw) return { mode: 'guest' };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSessionState> | null;
    if (parsed?.mode === 'account' && typeof parsed.username === 'string' && parsed.username) {
      return { mode: 'account', username: normalizeUsername(parsed.username) };
    }
    return { mode: 'guest' };
  } catch {
    return { mode: 'guest' };
  }
}

function writeSession(
  session: StoredSessionState,
  storage?: WritableStorage | null,
): void {
  if (storage === null) return;
  safeSetItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session), storage);
}

interface FirestoreConfig {
  projectId: string;
  apiKey?: string;
}

function getConfiguredFirestore(): FirestoreConfig | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const projectId = env?.VITE_FIREBASE_PROJECT_ID?.trim();
    const apiKey = env?.VITE_FIREBASE_API_KEY?.trim();
    if (projectId) {
      return { projectId, apiKey };
    }
  } catch {
    // Node test environment without import.meta.env
  }
  return null;
}

function createDefaultCloudAdapter(): PlayerCloudAdapter | null {
  const cfg = getConfiguredFirestore();
  if (!cfg || typeof fetch !== 'function') return null;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents/players`;
  const keyParam = cfg.apiKey ? `?key=${encodeURIComponent(cfg.apiKey)}` : '';

  return {
    async getPlayer(normalizedUsername: string): Promise<PlayerAccountRecord | null> {
      try {
        const res = await fetch(`${baseUrl}/${encodeURIComponent(normalizedUsername)}${keyParam}`);
        if (!res.ok) return null;
        const json = (await res.json()) as {
          fields?: Record<string, { stringValue?: string; integerValue?: string; arrayValue?: { values?: Array<{ stringValue?: string }> } }>;
        };
        const f = json.fields;
        if (!f || !f.passwordHash?.stringValue) return null;
        return {
          displayName: f.displayName?.stringValue || normalizedUsername,
          passwordHash: f.passwordHash.stringValue,
          coins: Number(f.coins?.integerValue ?? DEFAULT_GUEST_COINS),
          unlockedFighters: sanitizeFighters(
            f.unlockedFighters?.arrayValue?.values?.map((v) => v.stringValue ?? '') ?? [],
          ),
          highestStage: Number(f.highestStage?.integerValue ?? 1),
          wins: Number(f.wins?.integerValue ?? 0),
          updatedAt: Number(f.updatedAt?.integerValue ?? Date.now()),
        };
      } catch {
        return null;
      }
    },
    async savePlayer(normalizedUsername: string, record: PlayerAccountRecord): Promise<void> {
      try {
        const url = `${baseUrl}/${encodeURIComponent(normalizedUsername)}${keyParam}`;
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              displayName: { stringValue: record.displayName },
              passwordHash: { stringValue: record.passwordHash },
              coins: { integerValue: String(record.coins) },
              unlockedFighters: {
                arrayValue: {
                  values: record.unlockedFighters.map((id) => ({ stringValue: id })),
                },
              },
              highestStage: { integerValue: String(record.highestStage) },
              wins: { integerValue: String(record.wins) },
              updatedAt: { integerValue: String(record.updatedAt) },
            },
          }),
        });
      } catch {
        // Offline / restricted fallback already stored locally
      }
    },
  };
}

export async function checkUsernameAvailability(
  rawUsername: string,
  storage?: AccountStorage | null,
  cloudAdapter?: PlayerCloudAdapter | null,
): Promise<UsernameAvailabilityResult> {
  const format = validateUsernameFormat(rawUsername);
  if (!format.valid) {
    return {
      available: false,
      normalized: format.normalized,
      reason: 'invalid',
      message: format.error ?? 'Invalid username.',
    };
  }

  if (isReservedUsername(format.normalized)) {
    return {
      available: false,
      normalized: format.normalized,
      reason: 'taken',
      message: 'Username already taken! Try another ID.',
    };
  }

  const registry = readRegistry(storage);
  if (Object.prototype.hasOwnProperty.call(registry, format.normalized)) {
    return {
      available: false,
      normalized: format.normalized,
      reason: 'taken',
      message: 'Username already taken! Try another ID.',
    };
  }

  const cloud = cloudAdapter === undefined ? createDefaultCloudAdapter() : cloudAdapter;
  if (cloud) {
    const remote = await cloud.getPlayer(format.normalized);
    if (remote) {
      return {
        available: false,
        normalized: format.normalized,
        reason: 'taken',
        message: 'Username already taken! Try another ID.',
      };
    }
  }

  return {
    available: true,
    normalized: format.normalized,
    reason: 'available',
    message: 'ID Available!',
  };
}

export async function createPlayerAccount(
  rawUsername: string,
  password: string,
  storage?: AccountStorage | null,
  cloudAdapter?: PlayerCloudAdapter | null,
): Promise<AuthResult> {
  const availability = await checkUsernameAvailability(rawUsername, storage, cloudAdapter);
  if (!availability.available) {
    return { ok: false, error: availability.message };
  }
  if (!password || password.length < 4) {
    return { ok: false, error: 'Password must be at least 4 characters.' };
  }

  const normalized = availability.normalized;
  const displayName = rawUsername.trim();
  const passwordHash = await sha256Hex(password);

  // Migrate current Guest progress (coins, unlocked fighters, stage progress, wins) into new account
  const guest = readGuestProgress(storage);
  const migratedGuest =
    guest.coins > DEFAULT_GUEST_COINS ||
    guest.unlockedFighters.length > STARTER_FIGHTERS.length ||
    guest.highestStage > 1 ||
    guest.wins > 0;

  const newRecord: PlayerAccountRecord = {
    displayName,
    passwordHash,
    coins: Math.max(DEFAULT_GUEST_COINS, guest.coins),
    unlockedFighters: sanitizeFighters([...STARTER_FIGHTERS, ...guest.unlockedFighters]),
    highestStage: Math.max(1, guest.highestStage),
    wins: guest.wins,
    updatedAt: Date.now(),
  };

  const registry = readRegistry(storage);
  registry[normalized] = newRecord;
  writeRegistry(registry, storage);
  writeSession({ mode: 'account', username: normalized }, storage);

  // Reset Guest scratch slot cleanly after migration
  if (migratedGuest) {
    writeGuestProgress(createDefaultGuestProgress(), storage);
  }

  const cloud = cloudAdapter === undefined ? createDefaultCloudAdapter() : cloudAdapter;
  if (cloud) {
    await cloud.savePlayer(normalized, newRecord);
  }

  return {
    ok: true,
    profile: recordToProfile(normalized, newRecord),
    migratedGuest,
  };
}

export async function loginPlayerAccount(
  rawUsername: string,
  password: string,
  storage?: AccountStorage | null,
  cloudAdapter?: PlayerCloudAdapter | null,
): Promise<AuthResult> {
  const format = validateUsernameFormat(rawUsername);
  if (!format.valid) {
    return { ok: false, error: format.error ?? 'Enter a valid username.' };
  }
  if (!password) {
    return { ok: false, error: 'Please enter your password.' };
  }

  const normalized = format.normalized;
  const inputHash = await sha256Hex(password);

  // Hidden pre-unlocked creator verification using precomputed SHA-256 digest only
  if (normalized === CREATOR_ACCOUNT_ID) {
    if (inputHash !== CREATOR_PASS_SHA256_DIGEST) {
      return { ok: false, error: 'Invalid username or password.' };
    }
    const existing = readCreatorProgress(storage);
    const profile = createCreatorProfile(existing);
    writeCreatorProgress(profile, storage);
    writeSession({ mode: 'account', username: CREATOR_ACCOUNT_ID }, storage);
    return { ok: true, profile };
  }

  const registry = readRegistry(storage);
  let record: PlayerAccountRecord | null = Object.prototype.hasOwnProperty.call(
    registry,
    normalized,
  )
    ? registry[normalized]
    : null;

  const cloud = cloudAdapter === undefined ? createDefaultCloudAdapter() : cloudAdapter;
  if (!record && cloud) {
    record = await cloud.getPlayer(normalized);
    if (record) {
      registry[normalized] = record;
      writeRegistry(registry, storage);
    }
  }

  if (!record) {
    return { ok: false, error: 'Account not found. Create an account or play as Guest.' };
  }

  if (record.passwordHash !== inputHash) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  writeSession({ mode: 'account', username: normalized }, storage);
  return { ok: true, profile: recordToProfile(normalized, record) };
}

export function loadActivePlayerProfile(storage?: AccountStorage | null): PlayerProfile {
  const session = readSession(storage);
  if (session.mode === 'account' && session.username) {
    if (session.username === CREATOR_ACCOUNT_ID) {
      return createCreatorProfile(readCreatorProgress(storage));
    }
    const registry = readRegistry(storage);
    const record = registry[session.username];
    if (record) {
      return recordToProfile(session.username, record);
    }
  }
  return guestToProfile(readGuestProgress(storage));
}

export function logoutToGuest(storage?: AccountStorage | null): PlayerProfile {
  writeSession({ mode: 'guest' }, storage);
  return guestToProfile(readGuestProgress(storage));
}

export function persistPlayerProfile(
  profile: PlayerProfile,
  storage?: AccountStorage | null,
  cloudAdapter?: PlayerCloudAdapter | null,
): PlayerProfile {
  const updated: PlayerProfile = {
    ...profile,
    updatedAt: Date.now(),
  };

  if (updated.mode === 'guest') {
    writeGuestProgress(
      {
        coins: updated.coins,
        unlockedFighters: updated.unlockedFighters,
        highestStage: updated.highestStage,
        wins: updated.wins,
        updatedAt: updated.updatedAt,
      },
      storage,
    );
    return updated;
  }

  if (updated.isCreator || updated.username === CREATOR_ACCOUNT_ID) {
    const creator = createCreatorProfile(updated);
    writeCreatorProgress(creator, storage);
    return creator;
  }

  const registry = readRegistry(storage);
  const existing = registry[updated.username];
  if (existing) {
    const mergedRecord: PlayerAccountRecord = {
      ...existing,
      displayName: updated.displayName,
      coins: updated.coins,
      unlockedFighters: updated.unlockedFighters,
      highestStage: updated.highestStage,
      wins: updated.wins,
      updatedAt: updated.updatedAt,
    };
    registry[updated.username] = mergedRecord;
    writeRegistry(registry, storage);

    const cloud = cloudAdapter === undefined ? createDefaultCloudAdapter() : cloudAdapter;
    if (cloud) {
      void cloud.savePlayer(updated.username, mergedRecord);
    }
  }

  return updated;
}

export function applyMatchOutcomeToProfile(
  profile: PlayerProfile,
  outcome: 'win' | 'loss' | 'draw',
  stageNumber: number,
  storage?: AccountStorage | null,
  cloudAdapter?: PlayerCloudAdapter | null,
): { profile: PlayerProfile; coinsEarned: number; unlockedNextStage: boolean } {
  const clearedCurrentMax = outcome === 'win' && stageNumber >= profile.highestStage && stageNumber < 6;
  const nextHighestStage = profile.isCreator
    ? 6
    : clearedCurrentMax
      ? Math.min(6, stageNumber + 1)
      : profile.highestStage;

  const coinsEarned =
    outcome === 'win'
      ? MATCH_WIN_COIN_REWARD + (clearedCurrentMax ? STAGE_CLEAR_BONUS_COINS : 0)
      : MATCH_LOSS_COIN_REWARD;

  const nextProfile: PlayerProfile = {
    ...profile,
    coins: profile.coins + coinsEarned,
    highestStage: nextHighestStage,
    allModesUnlocked: profile.isCreator || nextHighestStage >= 2,
    wins: outcome === 'win' ? profile.wins + 1 : profile.wins,
  };

  return {
    profile: persistPlayerProfile(nextProfile, storage, cloudAdapter),
    coinsEarned,
    unlockedNextStage: clearedCurrentMax,
  };
}

export function unlockFighterWithCoins(
  profile: PlayerProfile,
  fighterId: FighterId,
  storage?: AccountStorage | null,
  cloudAdapter?: PlayerCloudAdapter | null,
): { ok: boolean; profile: PlayerProfile; error?: string } {
  if (profile.unlockedFighters.includes(fighterId)) {
    return { ok: true, profile };
  }
  const cost = FIGHTER_UNLOCK_COSTS[fighterId] ?? 150;
  if (profile.coins < cost) {
    return {
      ok: false,
      profile,
      error: `Need ${cost - profile.coins} more coins to unlock.`,
    };
  }
  const nextProfile: PlayerProfile = {
    ...profile,
    coins: profile.coins - cost,
    unlockedFighters: sanitizeFighters([...profile.unlockedFighters, fighterId]),
  };
  return {
    ok: true,
    profile: persistPlayerProfile(nextProfile, storage, cloudAdapter),
  };
}

export function unlockStageWithCoins(
  profile: PlayerProfile,
  stageNumber: number,
  storage?: AccountStorage | null,
  cloudAdapter?: PlayerCloudAdapter | null,
): { ok: boolean; profile: PlayerProfile; error?: string } {
  if (stageNumber <= profile.highestStage) {
    return { ok: true, profile };
  }
  const cost = STAGE_UNLOCK_COSTS[stageNumber] ?? 75;
  if (profile.coins < cost) {
    return {
      ok: false,
      profile,
      error: `Need ${cost - profile.coins} more coins to unlock Stage ${stageNumber}.`,
    };
  }
  const nextProfile: PlayerProfile = {
    ...profile,
    coins: profile.coins - cost,
    highestStage: Math.max(profile.highestStage, Math.min(6, stageNumber)),
    allModesUnlocked: true,
  };
  return {
    ok: true,
    profile: persistPlayerProfile(nextProfile, storage, cloudAdapter),
  };
}
