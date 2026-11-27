import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_REGISTRY_STORAGE_KEY,
  ALL_FIGHTER_IDS,
  applyMatchOutcomeToProfile,
  checkUsernameAvailability,
  CREATOR_ACCOUNT_ID,
  createPlayerAccount,
  DEFAULT_GUEST_COINS,
  isReservedUsername,
  loadActivePlayerProfile,
  loginPlayerAccount,
  logoutToGuest,
  MATCH_WIN_COIN_REWARD,
  normalizeUsername,
  STAGE_CLEAR_BONUS_COINS,
  STARTER_FIGHTERS,
  unlockFighterWithCoins,
  unlockStageWithCoins,
  validateUsernameFormat,
  type AccountStorage,
  type PlayerAccountRecord,
  type PlayerCloudAdapter,
} from './playerAccount';

function createMemoryStorage(): AccountStorage & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => Object.fromEntries(map.entries()),
  };
}

test('username normalization & format validation enforce 3-16 chars and safe charset', () => {
  assert.equal(normalizeUsername('  @Ansh_Games '), '@ansh_games');
  assert.equal(validateUsernameFormat('ab').valid, false);
  assert.equal(validateUsernameFormat('a_very_long_username_17').valid, false);
  assert.equal(validateUsernameFormat('bad name!').valid, false);
  assert.equal(validateUsernameFormat('raju_99').valid, true);
  assert.equal(validateUsernameFormat('@desi-king_1').valid, true);
  assert.equal(isReservedUsername('@Ansh_Games'), true);
  assert.equal(isReservedUsername('GUEST'), true);
  assert.equal(isReservedUsername('raju_99'), false);
});

test('reserved @ansh_games cannot be registered under any casing', async () => {
  const storage = createMemoryStorage();
  const avail = await checkUsernameAvailability('@Ansh_Games', storage, null);
  assert.equal(avail.available, false);
  assert.equal(avail.reason, 'taken');
  assert.equal(avail.message, 'Username already taken! Try another ID.');

  const reg = await createPlayerAccount('@ANSH_GAMES', 'somepass123', storage, null);
  assert.equal(reg.ok, false);
  assert.equal(reg.error, 'Username already taken! Try another ID.');
});

test('createPlayerAccount hashes password with SHA-256, checks uniqueness, and migrates Guest progress', async () => {
  const storage = createMemoryStorage();

  // Play as guest and accumulate coins, win & stage progress
  let profile = loadActivePlayerProfile(storage);
  assert.equal(profile.mode, 'guest');
  assert.equal(profile.coins, DEFAULT_GUEST_COINS);
  assert.deepEqual(profile.unlockedFighters, STARTER_FIGHTERS);

  const matchRes = applyMatchOutcomeToProfile(profile, 'win', 1, storage, null);
  profile = matchRes.profile;
  assert.equal(
    profile.coins,
    DEFAULT_GUEST_COINS + MATCH_WIN_COIN_REWARD + STAGE_CLEAR_BONUS_COINS,
  );
  assert.equal(profile.highestStage, 2);
  assert.equal(profile.wins, 1);

  const avail = await checkUsernameAvailability('Raju_Fighter', storage, null);
  assert.equal(avail.available, true);
  assert.equal(avail.message, 'ID Available!');

  const secretInput = 'raju_secret_2026';
  const created = await createPlayerAccount('Raju_Fighter', secretInput, storage, null);
  assert.equal(created.ok, true);
  assert.equal(created.migratedGuest, true);
  assert.equal(created.profile?.displayName, 'Raju_Fighter');
  assert.equal(created.profile?.username, 'raju_fighter');
  assert.equal(created.profile?.coins, profile.coins);
  assert.equal(created.profile?.highestStage, 2);
  assert.equal(created.profile?.wins, 1);

  // Raw password must NEVER appear anywhere in storage
  const rawRegistry = storage.getItem(ACCOUNT_REGISTRY_STORAGE_KEY) ?? '';
  assert.equal(rawRegistry.includes(secretInput), false);
  const parsedRegistry = JSON.parse(rawRegistry) as Record<string, PlayerAccountRecord>;
  assert.equal(parsedRegistry['raju_fighter'].passwordHash.length, 64);

  // Case-insensitive uniqueness check rejects duplicate
  const dupCheck = await checkUsernameAvailability('raju_fighter', storage, null);
  assert.equal(dupCheck.available, false);
  assert.equal(dupCheck.message, 'Username already taken! Try another ID.');

  // Logging out returns to clean Guest without deleting Raju_Fighter
  const afterLogout = logoutToGuest(storage);
  assert.equal(afterLogout.mode, 'guest');
  assert.equal(afterLogout.coins, DEFAULT_GUEST_COINS);

  // Wrong password rejected
  const badLogin = await loginPlayerAccount('raju_fighter', 'wrong_pass', storage, null);
  assert.equal(badLogin.ok, false);

  // Correct password restores account progress
  const goodLogin = await loginPlayerAccount('raju_fighter', secretInput, storage, null);
  assert.equal(goodLogin.ok, true);
  assert.equal(goodLogin.profile?.coins, profile.coins);
  assert.equal(goodLogin.profile?.highestStage, 2);
});

test('coin unlocking unlocks Laddoo Mausi (100 coins), Principal Man, Samyak, and higher stages safely', async () => {
  const storage = createMemoryStorage();
  assert.equal(STARTER_FIGHTERS.includes('mausi'), false);
  const created = await createPlayerAccount('coin_hero', 'pass1234', storage, null);
  assert.equal(created.ok, true);
  let profile = created.profile!;
  assert.equal(profile.unlockedFighters.includes('mausi'), false);

  // Unlock Laddoo Mausi with initial 100 coins
  const unlockMausi = unlockFighterWithCoins(profile, 'mausi', storage, null);
  assert.equal(unlockMausi.ok, true);
  profile = unlockMausi.profile;
  assert.equal(profile.coins, 0);
  assert.ok(profile.unlockedFighters.includes('mausi'));

  // Earn coins via wins to unlock Principal Man and Stage 2
  for (let i = 0; i < 5; i++) {
    profile = applyMatchOutcomeToProfile(profile, 'win', 1, storage, null).profile;
  }
  assert.ok(profile.coins >= 400);

  const unlockFather = unlockFighterWithCoins(profile, 'father', storage, null);
  assert.equal(unlockFather.ok, true);
  profile = unlockFather.profile;
  assert.ok(profile.unlockedFighters.includes('father'));

  const unlockStage2 = unlockStageWithCoins(profile, 2, storage, null);
  assert.equal(unlockStage2.ok, true);
  profile = unlockStage2.profile;
  assert.equal(profile.highestStage, 2);
});

test('creator account rejects incorrect password and keeps all fighters count consistent', async () => {
  const storage = createMemoryStorage();
  const rejected = await loginPlayerAccount(CREATOR_ACCOUNT_ID, 'incorrect_pw', storage, null);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, 'Invalid username or password.');
  assert.equal(ALL_FIGHTER_IDS.length, 8);
});

test('optional cloud adapter syncs account records and checks remote uniqueness', async () => {
  const storageA = createMemoryStorage();
  const storageB = createMemoryStorage();
  const cloudDb = new Map<string, PlayerAccountRecord>();

  const cloudAdapter: PlayerCloudAdapter = {
    async getPlayer(username) {
      return cloudDb.get(username) ?? null;
    },
    async savePlayer(username, record) {
      cloudDb.set(username, record);
    },
  };

  const created = await createPlayerAccount('cloud_user', 'cloudpass', storageA, cloudAdapter);
  assert.equal(created.ok, true);
  assert.equal(cloudDb.has('cloud_user'), true);

  // Second device sees username taken and can log in via cloud adapter
  const availOnB = await checkUsernameAvailability('CLOUD_USER', storageB, cloudAdapter);
  assert.equal(availOnB.available, false);
  assert.equal(availOnB.message, 'Username already taken! Try another ID.');

  const loginOnB = await loginPlayerAccount('cloud_user', 'cloudpass', storageB, cloudAdapter);
  assert.equal(loginOnB.ok, true);
  assert.equal(loginOnB.profile?.displayName, 'cloud_user');
});
