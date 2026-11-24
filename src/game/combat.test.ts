import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMatchResultSnapshot,
  computeCpuInput,
  computeSignatureDamage,
  createEmptyInput,
  createMatchState,
  SIGNATURE_MOVE_COOLDOWN,
  stepMatch,
} from './combat';
import { FIGHTER_LIST } from './characters/configs';

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

test('grab beats blocking at close range, lifts opponent, and throws into knockdown', () => {
  const state = createMatchState('sheru', 'billa', true);
  state.fighters[0].x = -0.55;
  state.fighters[1].x = 0.55;
  const startHp = state.fighters[1].hp;

  const grabIn = { ...createEmptyInput(), grab: true };
  const blockIn = { ...createEmptyInput(), right: true };

  stepMatch(state, [grabIn, blockIn], 1 / 60);
  const events = stepFrames(state, createEmptyInput(), blockIn, 24);

  assert.ok(events.some((e) => e.type === 'grab'), 'Grab should lock on through block');
  assert.ok(events.some((e) => e.type === 'grab_throw'), 'Grab should execute throw release');
  assert.ok(state.fighters[1].hp < startHp - 10, 'Grab should deal full grab damage');
  assert.equal(state.fighters[1].action, 'knockdown', 'Grab throw should knock opponent down');
});

test('3-hit punch combo chains Jab -> Cross -> Finisher with hit-stop and launches opponent into knockdown', () => {
  const state = createMatchState('sheru', 'billa', true);
  state.fighters[0].x = -0.58;
  state.fighters[1].x = 0.58;

  const punchIn = { ...createEmptyInput(), punch: true };
  const idleIn = createEmptyInput();
  const allEvents = [];

  // Hit 1: Jab (comboStep 0)
  allEvents.push(...stepMatch(state, [punchIn, idleIn], 1 / 60));
  allEvents.push(...stepFrames(state, idleIn, idleIn, 10));
  assert.ok(state.fighters[0].comboCount >= 1, 'Jab should register first combo hit');

  // Hit 2: Cross (comboStep 1)
  state.fighters[1].x = state.fighters[0].x + 1.1;
  allEvents.push(...stepMatch(state, [punchIn, idleIn], 1 / 60));
  allEvents.push(...stepFrames(state, idleIn, idleIn, 12));
  assert.ok(state.fighters[0].comboCount >= 2, 'Cross should chain to 2 HITS');

  // Hit 3: Heavy Finisher (comboStep 2)
  state.fighters[1].x = state.fighters[0].x + 1.1;
  allEvents.push(...stepMatch(state, [punchIn, idleIn], 1 / 60));
  allEvents.push(...stepFrames(state, idleIn, idleIn, 18));

  assert.ok(state.fighters[0].comboCount >= 3, '3rd hit should chain to 3 HITS');
  assert.ok(
    allEvents.some((e) => e.type === 'heavy_hit' && e.moveCallout === 'PAISA UPPERCUT!'),
    '3rd hit finisher should emit character move callout',
  );
  assert.equal(state.fighters[1].action, 'knockdown', '3rd hit finisher should launch into knockdown');
});

test('low sweep knocks opponent flat onto floor, triggers knockdown_land dust event, and wakes up with invincibility', () => {
  const state = createMatchState('sheru', 'billa', true);
  state.fighters[0].x = -0.65;
  state.fighters[1].x = 0.65;

  const sweepIn = { ...createEmptyInput(), down: true, kick: true };
  const idleIn = createEmptyInput();

  stepMatch(state, [sweepIn, idleIn], 1 / 60);
  const hitEvents = stepFrames(state, idleIn, idleIn, 20);
  assert.ok(
    hitEvents.some((e) => e.moveCallout === 'TANGDI SWEEP!'),
    'Low sweep should emit TANGDI SWEEP! move callout',
  );
  assert.equal(state.fighters[1].action, 'knockdown', 'Sweep should knock opponent down');

  // Step through launch arc & floor landing + ~0.8s grounded knockdown into get-up
  const landEvents = stepFrames(state, idleIn, idleIn, 90);
  assert.ok(
    landEvents.some((e) => e.type === 'knockdown_land'),
    'Knocked down fighter hitting floor should emit knockdown_land dust event',
  );
  const postAction: string = state.fighters[1].action;
  assert.ok(
    postAction === 'getup' || postAction === 'idle',
    `Opponent should transition into get-up after grounded knockdown, got ${postAction}`,
  );
  if (postAction === 'getup') {
    assert.ok(state.fighters[1].invulnTimer > 0, 'Get-up must grant wake-up invincibility');
  }
});

test('Laddoo Mausi Belan Throw spawns spinning projectile, sets 3.5s cooldown, and deals 11%-13% maxHP', () => {
  const state = createMatchState('mausi', 'anda', true);
  state.fighters[0].x = -2.2;
  state.fighters[1].x = 1.8;
  const startHp = state.fighters[1].hp;
  const oppMaxHp = state.fighters[1].maxHp;

  const specialIn = { ...createEmptyInput(), special: true };
  stepMatch(state, [specialIn, createEmptyInput()], 1 / 60);
  assert.ok(
    state.fighters[0].specialCooldown >= 3.45 && state.fighters[0].specialCooldown <= SIGNATURE_MOVE_COOLDOWN,
    `Signature move should set ~3.5s cooldown, got ${state.fighters[0].specialCooldown}`,
  );

  const events = stepFrames(state, createEmptyInput(), createEmptyInput(), 40);
  const dmg = startHp - state.fighters[1].hp;
  assert.equal(dmg, computeSignatureDamage(oppMaxHp), 'Belan Throw should deal exact signature damage');
  assert.ok(dmg >= oppMaxHp * 0.11 && dmg <= oppMaxHp * 0.13, `Damage ${dmg}/${oppMaxHp} must be 11%-13%`);
  assert.ok(
    events.some((e) => e.moveCallout === 'BELAN THROW!'),
    'Belan Throw impact should emit BELAN THROW! callout',
  );
});

test('Garib Sena Neta Dharna Shield negates melee damage (0 taken), counters for 11%-13% HP, and bursts sonic wave when unhit', () => {
  const state = createMatchState('sheru', 'neta', true);
  state.fighters[0].x = -0.65;
  state.fighters[1].x = 0.65;
  const p1StartHp = state.fighters[0].hp;
  const p1MaxHp = state.fighters[0].maxHp;
  const p2StartHp = state.fighters[1].hp;

  // Neta activates Dharna Shield
  stepMatch(state, [createEmptyInput(), { ...createEmptyInput(), special: true }], 1 / 60);
  assert.ok(state.fighters[1].dharnaShieldTimer > 0.5, 'Dharna shield should be active');

  // Sheru punches into Dharna Shield -> negated (0 dmg to Neta) + counter pushback (11%-13% to Sheru)
  stepMatch(state, [{ ...createEmptyInput(), punch: true }, createEmptyInput()], 1 / 60);
  const events = stepFrames(state, createEmptyInput(), createEmptyInput(), 12);

  assert.ok(events.some((e) => e.type === 'dharna_counter'), 'Dharna Shield should emit counter event');
  assert.equal(state.fighters[1].hp, p2StartHp, 'Dharna Shield should completely negate incoming non-Super hit');
  const counterDmg = p1StartHp - state.fighters[0].hp;
  assert.equal(counterDmg, computeSignatureDamage(p1MaxHp), 'Dharna counter should deal exact signature damage');
  assert.ok(counterDmg >= p1MaxHp * 0.11 && counterDmg <= p1MaxHp * 0.13);

  // Separate check: unhit Dharna Shield emits outward sonic pushback wave at ~0.42s
  const waveState = createMatchState('neta', 'billa', true);
  waveState.fighters[0].x = -1.1;
  waveState.fighters[1].x = 1.1;
  const billaStartHp = waveState.fighters[1].hp;
  const billaMaxHp = waveState.fighters[1].maxHp;
  stepMatch(waveState, [{ ...createEmptyInput(), special: true }, createEmptyInput()], 1 / 60);
  const waveEvents = stepFrames(waveState, createEmptyInput(), createEmptyInput(), 35);
  assert.ok(
    waveEvents.some((e) => e.moveCallout === 'DHARNA SHIELD!'),
    'Dharna Shield outward sonic wave should emit DHARNA SHIELD! callout',
  );
  const waveDmg = billaStartHp - waveState.fighters[1].hp;
  assert.equal(waveDmg, computeSignatureDamage(billaMaxHp));
  assert.ok(waveDmg >= billaMaxHp * 0.11 && waveDmg <= billaMaxHp * 0.13);
});

test('Best-of-3 KO transitions Round 1 into Round 2, then 2nd round win finishes match and builds BREAKING BAKWAS result', () => {
  const state = createMatchState('anda', 'billa', true);
  state.fighters[0].x = -0.6;
  state.fighters[1].x = 0.6;
  state.fighters[1].hp = 5;

  // Round 1 KO
  stepMatch(state, [{ ...createEmptyInput(), kick: true }, createEmptyInput()], 1 / 60);
  stepFrames(state, createEmptyInput(), createEmptyInput(), 20);

  assert.equal(state.fighters[1].hp, 0);
  assert.equal(state.phase, 'ko_freeze');
  assert.equal(state.koSubPhase, 'impact_slowmo');
  assert.ok(
    state.koCalloutText === 'GHEE KHATAM!' || state.koCalloutText === 'KHEL KHATAM!',
    `Expected desi KO callout, got ${state.koCalloutText}`,
  );
  assert.equal(state.p1RoundsWon, 1);
  assert.equal(state.p2RoundsWon, 0);
  assert.equal(state.roundWinnerSlot, 0);
  assert.equal(state.winnerSlot, null, 'Match must not end after only 1 round win');

  // Advance past 0.9s impact_slowmo into winner_celebration
  stepFrames(state, createEmptyInput(), createEmptyInput(), 62);
  assert.equal(state.phase, 'ko_freeze');
  assert.equal(state.koSubPhase, 'winner_celebration');
  assert.equal(state.fighters[0].action, 'victory');

  // Advance past 1.45s winner_celebration -> starts Round 2 intro with full HP reset
  stepFrames(state, createEmptyInput(), createEmptyInput(), 95);
  assert.equal(state.phase, 'intro');
  assert.equal(state.roundNumber, 2);
  assert.equal(state.fighters[0].hp, state.fighters[0].maxHp);
  assert.equal(state.fighters[1].hp, state.fighters[1].maxHp);

  // Advance past Round 2 intro into active fighting
  stepFrames(state, createEmptyInput(), createEmptyInput(), 105);
  assert.equal(state.phase, 'fighting');

  // Round 2 KO -> P1 reaches 2 round wins (Landslide 2-0)
  state.fighters[0].x = -0.6;
  state.fighters[1].x = 0.6;
  state.fighters[1].hp = 5;
  stepMatch(state, [{ ...createEmptyInput(), kick: true }, createEmptyInput()], 1 / 60);
  stepFrames(state, createEmptyInput(), createEmptyInput(), 20);
  assert.equal(state.phase, 'ko_freeze');
  assert.equal(state.koSubPhase, 'impact_slowmo');
  assert.equal(state.p1RoundsWon, 2);
  assert.equal(state.winnerSlot, 0);

  stepFrames(state, createEmptyInput(), createEmptyInput(), 160);
  assert.equal(state.phase, 'finished');
  assert.equal(state.fighters[0].action, 'victory');
  assert.equal(state.fighters[1].action, 'ko');

  const result = buildMatchResultSnapshot(state, 'railway', 'normal', 42);
  assert.equal(result.winnerSlot, 0);
  assert.equal(result.finishReason, 'ko');
  assert.equal(result.p1RoundsWon, 2);
  assert.equal(result.p2RoundsWon, 0);
  assert.equal(result.stampText, 'YOU WIN!');
  assert.ok(result.scoreSummary.includes('LANDSLIDE 2-0'), `Expected 2-0 landslide, got ${result.scoreSummary}`);
  assert.ok(result.headline.length > 10);
  assert.ok(result.loserQuote.length > 10);

  // Verify CPU 2-1 nail-biter produces YOU LOSE! stamp and NAIL-BITER 2-1 score
  const loseState = createMatchState('sheru', 'mausi', true);
  loseState.p1RoundsWon = 1;
  loseState.p2RoundsWon = 2;
  loseState.winnerSlot = 1;
  loseState.finishReason = 'ko';
  const loseResult = buildMatchResultSnapshot(loseState, 'mohalla', 'normal', 7);
  assert.equal(loseResult.stampText, 'YOU LOSE!');
  assert.ok(loseResult.scoreSummary.includes('NAIL-BITER 2-1'));
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

test('Anda Bhai Anda Squash hops onto opponent, flattens them for comedic beat, and deals 11%-13% maxHP', () => {
  const state = createMatchState('anda', 'sheru', true);
  state.fighters[0].x = -1.1;
  state.fighters[1].x = 1.1;
  const startHp = state.fighters[1].hp;
  const oppMaxHp = state.fighters[1].maxHp;

  const launchEvents = stepMatch(
    state,
    [{ ...createEmptyInput(), special: true }, createEmptyInput()],
    1 / 60,
  );
  assert.ok(
    launchEvents.some((e) => e.type === 'special' && e.word === 'ANDA SQUASH!'),
    'Anda Squash should trigger ANDA SQUASH! callout',
  );
  assert.ok(state.fighters[0].y > 0, 'Anda Bhai should hop into the air for Anda Squash');

  let sawSquashHold = false;
  let sawSquashedOpp = false;
  const allEvents = [];
  for (let i = 0; i < 60; i++) {
    const ev = stepMatch(state, [createEmptyInput(), createEmptyInput()], 1 / 60);
    allEvents.push(...ev);
    if (state.fighters[0].squashHoldTimer > 0) sawSquashHold = true;
    if (state.fighters[1].squashedTimer > 0) sawSquashedOpp = true;
  }
  assert.ok(
    allEvents.some((e) => e.type === 'land' && e.word === 'SQUASH!'),
    'Anda Squash landing should emit SQUASH! shockwave event',
  );
  assert.ok(sawSquashHold, 'Anda Bhai should hold flat-on-top flop pose on landing');
  assert.ok(sawSquashedOpp, 'Opponent should enter flattened squashedTimer state');
  const dmg = startHp - state.fighters[1].hp;
  assert.equal(dmg, computeSignatureDamage(oppMaxHp));
  assert.ok(dmg >= oppMaxHp * 0.11 && dmg <= oppMaxHp * 0.13);
});

test('interrupting opponent attack startup triggers COUNTER! callout and bonus damage', () => {
  const normalState = createMatchState('sheru', 'billa', true);
  normalState.fighters[0].x = -0.58;
  normalState.fighters[1].x = 0.58;
  stepMatch(normalState, [{ ...createEmptyInput(), punch: true }, createEmptyInput()], 1 / 60);
  stepFrames(normalState, createEmptyInput(), createEmptyInput(), 12);
  const normalDmg = normalState.fighters[1].maxHp - normalState.fighters[1].hp;

  const counterState = createMatchState('sheru', 'billa', true);
  counterState.fighters[0].x = -0.58;
  counterState.fighters[1].x = 0.58;
  // P1 throws fast jab (shorter windup) while P2 begins slower kick on the same frame -> COUNTER!
  const events = [
    ...stepMatch(
      counterState,
      [{ ...createEmptyInput(), punch: true }, { ...createEmptyInput(), kick: true }],
      1 / 60,
    ),
    ...stepFrames(counterState, createEmptyInput(), createEmptyInput(), 12),
  ];
  const counterDmg = counterState.fighters[1].maxHp - counterState.fighters[1].hp;

  assert.ok(
    events.some((e) => e.word === 'COUNTER!' && e.moveCallout === 'COUNTER HIT!'),
    'Interrupting attack startup should emit COUNTER! callout',
  );
  assert.ok(
    counterDmg > normalDmg,
    `Counter hit (${counterDmg}) should deal more damage than normal hit (${normalDmg})`,
  );
});

test('Kick 3-hit combo executes High Snap Kick -> Low Sweep -> Jump-Kick Finisher', () => {
  const state = createMatchState('sheru', 'billa', true);
  state.fighters[0].x = -0.62;
  state.fighters[1].x = 0.62;

  const kickIn = { ...createEmptyInput(), kick: true };
  const idleIn = createEmptyInput();

  // Hit 1: High Snap Kick (comboStep 0)
  stepMatch(state, [kickIn, idleIn], 1 / 60);
  const h1 = stepFrames(state, idleIn, idleIn, 16);
  assert.ok(
    h1.some((e) => (e.type === 'hit' || e.type === 'heavy_hit') && e.y > 1.2),
    '1st kick should connect at chest/head height',
  );

  // Hit 2: Low Sweep Kick (comboStep 1)
  state.fighters[1].x = state.fighters[0].x + 1.15;
  stepMatch(state, [kickIn, idleIn], 1 / 60);
  const h2 = stepFrames(state, idleIn, idleIn, 18);
  assert.ok(
    h2.some((e) => e.moveCallout === 'TANGDI SWEEP!' && e.y < 0.6),
    '2nd kick combo should execute low sweep at floor contact height',
  );

  // Hit 3: Jump-Kick Finisher (comboStep 2) - test fresh fighter in range with comboChainTimer active
  const state3 = createMatchState('sheru', 'billa', true);
  state3.fighters[0].x = -0.65;
  state3.fighters[1].x = 0.65;
  state3.fighters[0].comboStep = 1;
  state3.fighters[0].comboChainTimer = 0.45;
  stepMatch(state3, [kickIn, idleIn], 1 / 60);
  assert.equal(state3.fighters[0].comboStep, 2, '3rd kick should advance to comboStep 2');
  assert.ok(state3.fighters[0].vy > 4.0, '3rd kick jump-kick finisher should hop briskly off the ground');
  const h3 = stepFrames(state3, idleIn, idleIn, 20);
  assert.ok(
    h3.some((e) => e.type === 'heavy_hit'),
    '3rd kick jump-kick finisher should land as heavy knockdown hit',
  );
  assert.equal(state3.fighters[1].action, 'knockdown', '3rd kick finisher should launch opponent into knockdown');
});

test('All 5 fighters have custom named Signature Moves (never SPECIAL), 3.5s cooldown, and 11%-13% HP damage tier', () => {
  const expectedLabels: Record<string, string> = {
    sheru: 'PAISA FLEX',
    billa: 'SWATTER THROW',
    neta: 'DHARNA SHIELD',
    anda: 'ANDA SQUASH',
    mausi: 'BELAN THROW',
  };

  for (const cfg of FIGHTER_LIST) {
    const id = cfg.id;
    assert.equal(cfg.special.shortLabel, expectedLabels[id], `${id} shortLabel mismatch`);
    assert.ok(
      !cfg.special.shortLabel.toUpperCase().includes('SPECIAL'),
      `${id} button label must never say SPECIAL`,
    );
    assert.equal(cfg.special.cooldown, SIGNATURE_MOVE_COOLDOWN, `${id} cooldown must be 3.5s`);

    const sigDmg = computeSignatureDamage(cfg.maxHp);
    const pct = sigDmg / cfg.maxHp;
    assert.ok(
      pct >= 0.11 && pct <= 0.13,
      `Signature damage against ${id} (maxHp ${cfg.maxHp}) = ${sigDmg} (${(pct * 100).toFixed(2)}%) must be 11%-13%`,
    );
  }
});

test('Sheru Bhai PAISA FLEX fans flying currency bills and caps single-activation damage at 11%-13% maxHP', () => {
  const state = createMatchState('sheru', 'mausi', true);
  state.fighters[0].x = -0.8;
  state.fighters[1].x = 0.8;
  const startHp = state.fighters[1].hp;
  const oppMaxHp = state.fighters[1].maxHp;

  const triggerEvents = stepMatch(
    state,
    [{ ...createEmptyInput(), special: true }, createEmptyInput()],
    1 / 60,
  );
  assert.ok(
    triggerEvents.some((e) => e.type === 'special' && e.word === 'PAISA FLEX!'),
    'PAISA FLEX should emit PAISA FLEX! callout',
  );

  let maxNotesSpawned = 0;
  const events = [];
  for (let i = 0; i < 45; i++) {
    events.push(...stepMatch(state, [createEmptyInput(), createEmptyInput()], 1 / 60));
    const activeNotes = state.projectiles.filter((p) => p.active && p.kind === 'notes').length;
    if (activeNotes > maxNotesSpawned) maxNotesSpawned = activeNotes;
  }

  assert.ok(maxNotesSpawned >= 3, `PAISA FLEX should fan multiple currency bills, saw ${maxNotesSpawned}`);
  const dmg = startHp - state.fighters[1].hp;
  assert.equal(dmg, computeSignatureDamage(oppMaxHp), 'PAISA FLEX bills must never multi-hit stack past signature damage');
  assert.ok(dmg >= oppMaxHp * 0.11 && dmg <= oppMaxHp * 0.13);
  assert.ok(events.some((e) => e.moveCallout === 'PAISA FLEX!'));
});

test('Blue Billa SWATTER THROW hurls spinning swatter projectile across mid-range for 11%-13% maxHP', () => {
  const state = createMatchState('billa', 'sheru', true);
  state.fighters[0].x = -2.2;
  state.fighters[1].x = 1.6;
  const startHp = state.fighters[1].hp;
  const oppMaxHp = state.fighters[1].maxHp;

  const triggerEvents = stepMatch(
    state,
    [{ ...createEmptyInput(), special: true }, createEmptyInput()],
    1 / 60,
  );
  assert.ok(
    triggerEvents.some((e) => e.type === 'special' && e.word === 'SWATTER THROW!'),
    'SWATTER THROW should emit SWATTER THROW! callout',
  );

  let sawSwatterProjectile = false;
  const events = [];
  for (let i = 0; i < 45; i++) {
    events.push(...stepMatch(state, [createEmptyInput(), createEmptyInput()], 1 / 60));
    if (state.projectiles.some((p) => p.active && p.kind === 'swatter')) {
      sawSwatterProjectile = true;
    }
  }

  assert.ok(sawSwatterProjectile, 'SWATTER THROW must spawn a spinning swatter projectile');
  const dmg = startHp - state.fighters[1].hp;
  assert.equal(dmg, computeSignatureDamage(oppMaxHp));
  assert.ok(dmg >= oppMaxHp * 0.11 && dmg <= oppMaxHp * 0.13);
  assert.ok(events.some((e) => e.moveCallout === 'SWATTER THROW!'));
});



