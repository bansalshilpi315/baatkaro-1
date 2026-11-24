import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMatchResultSnapshot,
  computeCpuInput,
  createEmptyInput,
  createMatchState,
  stepMatch,
} from './combat';

function stepFrames(
  state: ReturnType<typeof createMatchState>,
  p1Input: ReturnType<typeof createEmptyInput>,
  p2Input: ReturnType<typeof createEmptyInput>,
  frames: number,
  dt = 1 / 60,
) {
  const allEvents = [];
  for (let i = 0; i < frames; i++) {
    const ev = stepMatch(state, [p1Input, p2Input], dt);
    allEvents.push(...ev);
  }
  return allEvents;
}

test('punch deals damage, builds shakti, and respects hitstop', () => {
  const state = createMatchState('sheru', 'billa', true);
  // Bring fighters into punch range
  state.fighters[0].x = -0.6;
  state.fighters[1].x = 0.6;
  const startHp = state.fighters[1].hp;

  const punchIn = { ...createEmptyInput(), punch: true };
  const idleIn = createEmptyInput();

  stepMatch(state, [punchIn, idleIn], 1 / 60);
  const events = stepFrames(state, idleIn, idleIn, 12);

  assert.ok(state.fighters[1].hp < startHp, 'P2 HP should decrease after punch');
  assert.ok(state.fighters[0].shakti > 0, 'P1 SHAKTI should increase on hit');
  assert.ok(events.some((e) => e.type === 'hit'), 'Should emit a hit event');
});

test('holding back blocks incoming kick and drastically reduces damage', () => {
  const state = createMatchState('sheru', 'billa', true);
  state.fighters[0].x = -0.7;
  state.fighters[1].x = 0.7;
  const startHp = state.fighters[1].hp;

  const kickIn = { ...createEmptyInput(), kick: true };
  // P2 faces left (-1), so holding right is holding back (block)
  const blockIn = { ...createEmptyInput(), right: true };

  stepMatch(state, [kickIn, blockIn], 1 / 60);
  const events = stepFrames(state, createEmptyInput(), blockIn, 16);

  assert.ok(events.some((e) => e.type === 'block'), 'Should emit a block event');
  assert.ok(
    startHp - state.fighters[1].hp <= 2,
    `Blocked kick should deal minimal chip damage, got ${startHp - state.fighters[1].hp}`,
  );
});

test('grab beats blocking at close range', () => {
  const state = createMatchState('sheru', 'billa', true);
  state.fighters[0].x = -0.55;
  state.fighters[1].x = 0.55;
  const startHp = state.fighters[1].hp;

  const grabIn = { ...createEmptyInput(), grab: true };
  const blockIn = { ...createEmptyInput(), right: true };

  stepMatch(state, [grabIn, blockIn], 1 / 60);
  const events = stepFrames(state, createEmptyInput(), blockIn, 15);

  assert.ok(events.some((e) => e.type === 'grab'), 'Grab should connect through block');
  assert.ok(state.fighters[1].hp < startHp - 10, 'Grab should deal full grab damage');
});

test('Laddoo Mausi Belan Throw spawns spinning projectile and hits at mid-range', () => {
  const state = createMatchState('mausi', 'anda', true);
  state.fighters[0].x = -2.2;
  state.fighters[1].x = 1.8;
  const startHp = state.fighters[1].hp;

  const specialIn = { ...createEmptyInput(), special: true };
  stepMatch(state, [specialIn, createEmptyInput()], 1 / 60);
  assert.ok(state.fighters[0].specialCooldown > 4.0, 'Specialised move sets 4-5s cooldown');

  stepFrames(state, createEmptyInput(), createEmptyInput(), 40);
  assert.ok(state.fighters[1].hp < startHp, 'Belan projectile should travel and hit opponent');
});

test('Garib Sena Neta Dharna Shield reduces damage and counters melee attacker', () => {
  const state = createMatchState('sheru', 'neta', true);
  state.fighters[0].x = -0.65;
  state.fighters[1].x = 0.65;
  const p1StartHp = state.fighters[0].hp;
  const p2StartHp = state.fighters[1].hp;

  // Neta activates Dharna Shield
  stepMatch(state, [createEmptyInput(), { ...createEmptyInput(), special: true }], 1 / 60);
  assert.ok(state.fighters[1].dharnaShieldTimer > 0.5, 'Dharna shield should be active');

  // Sheru punches into Dharna Shield
  stepMatch(state, [{ ...createEmptyInput(), punch: true }, createEmptyInput()], 1 / 60);
  const events = stepFrames(state, createEmptyInput(), createEmptyInput(), 12);

  assert.ok(events.some((e) => e.type === 'dharna_counter'), 'Dharna Shield should emit counter event');
  assert.ok(state.fighters[0].hp < p1StartHp, 'Attacker should take counter damage');
  assert.ok(p2StartHp - state.fighters[1].hp <= 4, 'Neta should take reduced damage');
});

test('KO transitions match into ko_freeze then finished and builds newspaper result', () => {
  const state = createMatchState('anda', 'billa', true);
  state.fighters[0].x = -0.6;
  state.fighters[1].x = 0.6;
  state.fighters[1].hp = 5;

  stepMatch(state, [{ ...createEmptyInput(), kick: true }, createEmptyInput()], 1 / 60);
  stepFrames(state, createEmptyInput(), createEmptyInput(), 20);

  assert.equal(state.fighters[1].hp, 0);
  assert.equal(state.phase, 'ko_freeze');
  assert.equal(state.winnerSlot, 0);

  // Advance past ko_freeze
  stepFrames(state, createEmptyInput(), createEmptyInput(), 65);
  assert.equal(state.phase, 'finished');
  assert.equal(state.fighters[0].action, 'victory');

  const result = buildMatchResultSnapshot(state, 'railway', 'normal', 42);
  assert.equal(result.winnerSlot, 0);
  assert.equal(result.finishReason, 'ko');
  assert.equal(result.stampText, 'YOU WIN!');
  assert.ok(result.headline.length > 10);
  assert.ok(result.reportParagraph.length > 40);
});

test('CPU AI produces valid inputs across easy, normal, and hard', () => {
  const state = createMatchState('sheru', 'billa', true);
  state.aiThinkTimer = 0;
  const easyIn = computeCpuInput(state, 'easy', 1 / 60, () => 0.1);
  state.aiThinkTimer = 0;
  const hardIn = computeCpuInput(state, 'hard', 1 / 60, () => 0.1);

  assert.equal(typeof easyIn.left, 'boolean');
  assert.equal(typeof hardIn.punch, 'boolean');
});

test('Anda Bhai Deewar Drop launches airborne and lands with CRACK! shockwave event', () => {
  const state = createMatchState('anda', 'sheru', true);
  state.fighters[0].x = -1.2;
  state.fighters[1].x = 1.2;

  const launchEvents = stepMatch(
    state,
    [{ ...createEmptyInput(), special: true }, createEmptyInput()],
    1 / 60,
  );
  assert.ok(
    launchEvents.some((e) => e.type === 'special' && e.word === 'DEEWAR DROP!'),
    'Deewar Drop should trigger special callout',
  );
  assert.ok(state.fighters[0].y > 0, 'Anda Bhai should launch into the air for Deewar Drop');

  const allEvents = stepFrames(state, createEmptyInput(), createEmptyInput(), 48);
  assert.ok(
    allEvents.some((e) => e.type === 'land' && e.word === 'CRACK!'),
    'Deewar Drop slam landing should emit CRACK! shockwave event',
  );
});

