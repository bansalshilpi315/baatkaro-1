import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeTotalSuperDamage,
  createEmptyInput,
  createMatchState,
  stepMatch,
} from './combat';
import {
  SHERU_SUPER_DURATION,
  getSheruSuperDimFactor,
  getSheruSuperPhase,
} from './sheruSuper';
import type { FighterId } from './types';

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

test('Sheru Super deals exactly 33% opponent maxHp (~45% combo + ~55% finisher) across all opponents and framerates', () => {
  const opponents: FighterId[] = ['billa', 'mausi', 'sheru', 'anda', 'neta'];
  const frameRates = [1 / 20, 1 / 60, 1 / 120];

  for (const oppId of opponents) {
    for (const dt of frameRates) {
      const state = createMatchState('sheru', oppId, true);
      const [sheru, opp] = state.fighters;
      sheru.x = -8.5;
      opp.x = 7.5;
      sheru.shakti = 100;
      const startHp = opp.hp;
      const expectedTotal = computeTotalSuperDamage(opp.maxHp);
      const expectedCombo = Math.round(expectedTotal * 0.45);
      const expectedFinisher = expectedTotal - expectedCombo;

      const superInput = createEmptyInput();
      superInput.superMove = true;
      const idle = createEmptyInput();

      const triggerEvents = stepMatch(state, [superInput, idle], dt);
      assert.equal(sheru.shakti, 0, '100% Shakti should be consumed immediately');
      assert.equal(sheru.action, 'super');
      assert.ok(state.sheruSuper?.active, 'Sheru Super sequence should be active');
      assert.ok(triggerEvents.some((e) => e.type === 'super'));

      let preFinisherDamage = 0;
      let capturedPreFinisher = false;
      let sawTrillionWord = false;
      let dashVerified = false;
      const steps = Math.ceil((SHERU_SUPER_DURATION + 0.25) / dt);

      for (let i = 0; i < steps; i++) {
        const evs = stepMatch(state, [idle, idle], dt);
        if (evs.some((e) => e.word === '$ TRILLION $')) {
          sawTrillionWord = true;
        }
        if (state.sheruSuper?.active) {
          if (state.sheruSuper.phase === 'paw_flurry' && state.sheruSuper.elapsed > 1.35) {
            if (Math.abs(sheru.x - opp.x) < 1.8) dashVerified = true;
          }
          if (!capturedPreFinisher && state.sheruSuper.elapsed >= 5.2 && state.sheruSuper.elapsed < 6.0) {
            preFinisherDamage = startHp - opp.hp;
            capturedPreFinisher = true;
          }
        }
      }

      const totalDamage = startHp - opp.hp;
      const finisherDamage = totalDamage - preFinisherDamage;

      assert.equal(state.sheruSuper?.active ?? false, false, 'Super should finish cleanly at 7.5s');
      assert.equal(dashVerified, true, 'Sheru should auto-dash into melee range');
      assert.equal(sawTrillionWord, true, 'Finisher should emit $ TRILLION $');
      assert.equal(
        preFinisherDamage,
        expectedCombo,
        `${oppId} @dt=${dt.toFixed(4)}: combo damage should be ~45% (${expectedCombo}), got ${preFinisherDamage}`,
      );
      assert.equal(
        finisherDamage,
        expectedFinisher,
        `${oppId} @dt=${dt.toFixed(4)}: finisher damage should be ~55% (${expectedFinisher}), got ${finisherDamage}`,
      );
      assert.equal(
        totalDamage,
        expectedTotal,
        `${oppId} @dt=${dt.toFixed(4)}: total Super damage must equal exact 33% maxHp (${expectedTotal}), got ${totalDamage}`,
      );
      assert.equal(sheru.superDamageDealt, expectedTotal);
      assert.equal(opp.hp, opp.maxHp - expectedTotal, 'Full-HP opponent must survive with ~67% HP');
      assert.equal(sheru.action, 'idle');
    }
  }
});

test('Sheru Super cleanly KOs opponent at <= 33% HP on final snap and leaves 34% HP opponent alive at 1 HP', () => {
  // Case A: Opponent at exact 33% HP (33/100) -> KO on final snap
  const koState = createMatchState('sheru', 'billa', true);
  const [sheruA, billaA] = koState.fighters;
  sheruA.shakti = 100;
  billaA.hp = 33;

  const superInput = createEmptyInput();
  superInput.superMove = true;
  const idle = createEmptyInput();

  stepMatch(koState, [superInput, idle], 0.02);

  // Advance to t = 5.8s (before 6.15s snap): opponent must still be alive so full choreography plays
  for (let i = 0; i < 145; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.ok(billaA.hp >= 1, 'Opponent should survive until Phase 4 snap');
  assert.equal(koState.phase, 'fighting');

  // Finish remaining 2s through snap and sequence end
  for (let i = 0; i < 60; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.equal(billaA.hp, 0, 'Opponent at <= 33% HP must be cleanly KOed by final finisher');
  assert.equal(koState.phase, 'ko_freeze');
  assert.equal(koState.winnerSlot, 0);

  // Case B: Opponent at 34/100 HP (1 HP above 33%) -> survives with exact 1 HP
  const surviveState = createMatchState('sheru', 'billa', true);
  const [sheruB, billaB] = surviveState.fighters;
  sheruB.shakti = 100;
  billaB.hp = 34;

  stepMatch(surviveState, [superInput, idle], 0.02);
  for (let i = 0; i < 200; i++) {
    stepMatch(surviveState, [idle, idle], 0.04);
  }
  assert.equal(billaB.hp, 1, 'Opponent at 34/100 HP must survive exact 33% cap with 1 HP left');
  assert.equal(surviveState.phase, 'fighting');
});

test('All other fighters Supers are globally capped at exactly 33% of opponent maxHp', () => {
  const casters: FighterId[] = ['billa', 'neta', 'anda', 'mausi'];
  for (const casterId of casters) {
    const state = createMatchState(casterId, 'neta', true); // Neta maxHp = 120 -> 33% = 40
    const [caster, defender] = state.fighters;
    caster.x = -0.8;
    defender.x = 0.8;
    caster.shakti = 100;
    const expectedDamage = computeTotalSuperDamage(defender.maxHp);

    const superInput = createEmptyInput();
    superInput.superMove = true;
    const idle = createEmptyInput();

    stepMatch(state, [superInput, idle], 1 / 60);
    assert.equal(caster.action, 'super');
    assert.equal(state.sheruSuper, null, 'Non-Sheru fighters must not trigger Sheru Super state');

    for (let i = 0; i < 40; i++) {
      stepMatch(state, [idle, idle], 1 / 60);
    }

    assert.equal(
      defender.maxHp - defender.hp,
      expectedDamage,
      `${casterId} Super must deal exact 33% maxHp (${expectedDamage}), got ${defender.maxHp - defender.hp}`,
    );
    assert.equal(caster.superDamageDealt, expectedDamage);
  }
});
