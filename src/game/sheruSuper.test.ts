import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyInput, createMatchState, stepMatch } from './combat';
import {
  SHERU_SUPER_DURATION,
  getSheruSuperDimFactor,
  getSheruSuperPhase,
} from './sheruSuper';

test('Sheru Super phase timeline maps accurately across 7.5s', () => {
  assert.equal(getSheruSuperPhase(0.0), 'beat_drop');
  assert.equal(getSheruSuperPhase(0.95), 'beat_drop');
  assert.equal(getSheruSuperPhase(1.05), 'paw_flurry');
  assert.equal(getSheruSuperPhase(2.95), 'paw_flurry');
  assert.equal(getSheruSuperPhase(3.1), 'standing_hit');
  assert.equal(getSheruSuperPhase(4.2), 'lying_combo');
  assert.equal(getSheruSuperPhase(5.6), 'finisher');
  assert.equal(getSheruSuperPhase(7.45), 'finisher');

  assert.equal(getSheruSuperDimFactor(0), 0);
  assert.equal(getSheruSuperDimFactor(1.5), 1);
  assert.equal(getSheruSuperDimFactor(6.2), 1);
  assert.ok(getSheruSuperDimFactor(7.05) < 0.6);
  assert.equal(getSheruSuperDimFactor(SHERU_SUPER_DURATION), 0);
});

test('Sheru Super consumes 100% Shakti, auto-dashes from extreme range, deals 35-40% HP across 4 phases', () => {
  const state = createMatchState('sheru', 'billa', true);
  const [sheru, billa] = state.fighters;
  sheru.x = -8.5;
  billa.x = 7.5;
  sheru.shakti = 100;
  const startHp = billa.hp;

  const superInput = createEmptyInput();
  superInput.superMove = true;
  const idle = createEmptyInput();

  // Trigger Super on first tick
  const triggerEvents = stepMatch(state, [superInput, idle], 0.02);
  assert.equal(sheru.shakti, 0, '100% Shakti should be consumed immediately');
  assert.equal(sheru.action, 'super');
  assert.ok(state.sheruSuper?.active, 'Sheru Super sequence should be active');
  assert.ok(sheru.invulnTimer > 0, 'Sheru should have startup invincibility');
  assert.ok(triggerEvents.some((e) => e.type === 'super'));

  // Step through full 7.5s choreography collecting events and phase transitions
  const seenPhases = new Set<string>();
  const allWords: string[] = [];
  let dashVerified = false;
  let midComboHp = startHp;

  for (let i = 0; i < 200; i++) {
    const evs = stepMatch(state, [idle, idle], 0.04);
    for (const ev of evs) {
      if (ev.word) allWords.push(ev.word);
    }
    if (state.sheruSuper?.active) {
      seenPhases.add(state.sheruSuper.phase);
      if (state.sheruSuper.phase === 'paw_flurry' && state.sheruSuper.elapsed > 1.35) {
        if (Math.abs(sheru.x - billa.x) < 1.8) dashVerified = true;
      }
      if (state.sheruSuper.elapsed >= 5.0 && state.sheruSuper.elapsed < 5.2) {
        midComboHp = billa.hp;
      }
    }
  }

  assert.equal(state.sheruSuper?.active ?? false, false, 'Super should finish cleanly at 7.5s');
  assert.ok(seenPhases.has('beat_drop'));
  assert.ok(seenPhases.has('paw_flurry'));
  assert.ok(seenPhases.has('standing_hit'));
  assert.ok(seenPhases.has('lying_combo'));
  assert.ok(seenPhases.has('finisher'));
  assert.equal(dashVerified, true, 'Sheru should auto-dash into melee range even from extreme distance');

  assert.ok(midComboHp < startHp, 'Flurry and comedy combo should deal multi-hit damage');
  assert.ok(allWords.includes('$ TRILLION $'), 'Finisher snap should emit $ TRILLION $ impact callout');

  const totalDamage = startHp - billa.hp;
  const pct = totalDamage / billa.maxHp;
  assert.ok(
    pct >= 0.35 && pct <= 0.42,
    `Expected total Super damage 35-40% HP, got ${(pct * 100).toFixed(1)}% (${totalDamage}/${billa.maxHp})`,
  );
  assert.equal(sheru.action, 'idle', 'Sheru should return to idle cleanly when Super completes');
});

test('Sheru Super holds opponent alive until Phase 4 snap then cleanly KOs', () => {
  const state = createMatchState('sheru', 'billa', true);
  const [sheru, billa] = state.fighters;
  sheru.shakti = 100;
  billa.hp = 20; // Low HP opponent

  const superInput = createEmptyInput();
  superInput.superMove = true;
  const idle = createEmptyInput();

  stepMatch(state, [superInput, idle], 0.02);

  // Advance to t = 5.8s (before the 6.15s snap): opponent must still be at >= 1 HP so full choreography plays
  for (let i = 0; i < 145; i++) {
    stepMatch(state, [idle, idle], 0.04);
  }
  assert.ok(billa.hp >= 1, 'Opponent should survive until the Phase 4 snap finisher');
  assert.equal(state.phase, 'fighting');

  // Finish remaining 2s through snap and sequence end
  for (let i = 0; i < 60; i++) {
    stepMatch(state, [idle, idle], 0.04);
  }
  assert.equal(billa.hp, 0, 'Phase 4 snap should cleanly KO low-HP opponent');
  assert.equal(state.phase, 'ko_freeze');
  assert.equal(state.winnerSlot, 0);
});

test('Other fighters (Blue Billa) keep their standard Super unchanged', () => {
  const state = createMatchState('billa', 'sheru', true);
  const [billa] = state.fighters;
  billa.shakti = 100;

  const superInput = createEmptyInput();
  superInput.superMove = true;
  stepMatch(state, [superInput, createEmptyInput()], 0.02);

  assert.equal(billa.action, 'super');
  assert.equal(state.sheruSuper, null, 'Non-Sheru fighters must not trigger Sheru Super state');
});
