import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANDA_LIGHTNING_DAMAGE_SHARE,
  ANDA_SUPER_DURATION,
  ANDA_WALL_DROP_START,
  ANDA_WALL_IMPACT_TIME,
  ANDA_WALL_START_Y,
  getAndaSkyFlash,
  getAndaSuperDimFactor,
  getAndaSuperPhase,
  getAndaWallDropY,
} from './andaSuper';
import { computeSuperCameraTarget } from './camera';
import {
  computeTotalSuperDamage,
  createEmptyInput,
  createMatchState,
  shouldAllowFloatingCallout,
  stepMatch,
} from './combat';
import {
  MAUSI_BARRAGE_DAMAGE_SHARE,
  MAUSI_LEVITATION_PEAK_Y,
  MAUSI_SUPER_DURATION,
  getMausiLevitationY,
  getMausiSuperDimFactor,
  getMausiSuperPhase,
} from './mausiSuper';
import type { FighterId } from './types';

test('Anda Bhai "THE GREAT WALL DROP!" phase timeline, wall drop Y curve, sky flash & dim factor', () => {
  assert.equal(getAndaSuperPhase(0.0), 'hat_bow');
  assert.equal(getAndaSuperPhase(1.2), 'hat_bow');
  assert.equal(getAndaSuperPhase(1.5), 'lightning_strike');
  assert.equal(getAndaSuperPhase(2.4), 'lightning_strike');
  assert.equal(getAndaSuperPhase(2.6), 'wall_drop');
  assert.equal(getAndaSuperPhase(4.4), 'wall_drop');

  assert.equal(getAndaSuperDimFactor(0), 0);
  assert.equal(getAndaSuperDimFactor(1.5), 1);
  assert.equal(getAndaSuperDimFactor(3.5), 1);
  assert.ok(getAndaSuperDimFactor(4.2) < 0.65);
  assert.equal(getAndaSuperDimFactor(ANDA_SUPER_DURATION), 0);

  assert.equal(getAndaWallDropY(ANDA_WALL_DROP_START - 0.1), ANDA_WALL_START_Y);
  assert.ok(getAndaWallDropY(2.62) < ANDA_WALL_START_Y && getAndaWallDropY(2.62) > 0);
  assert.equal(getAndaWallDropY(ANDA_WALL_IMPACT_TIME), 0);
  assert.equal(getAndaWallDropY(3.2), 0);

  assert.equal(getAndaSkyFlash(0.5), 0);
  assert.ok(getAndaSkyFlash(1.58) > 0.7, 'Sky should flash bright white-blue on lightning bolt 1');
  assert.ok(getAndaSkyFlash(1.96) > 0.7, 'Sky should flash bright white-blue on lightning bolt 2');
  assert.ok(getAndaSkyFlash(2.32) > 0.7, 'Sky should flash bright white-blue on lightning bolt 3');
});

test('Anda Bhai Super deals exact 33% maxHp (~25% lightning + ~75% red-brick wall slam) across all opponents & framerates', () => {
  const opponents: FighterId[] = ['sheru', 'billa', 'neta', 'anda', 'mausi'];
  const frameRates = [1 / 20, 1 / 60, 1 / 120];

  for (const oppId of opponents) {
    for (const dt of frameRates) {
      const state = createMatchState('anda', oppId, true);
      const [anda, opp] = state.fighters;
      anda.shakti = 100;
      const startHp = opp.hp;
      const expectedTotal = computeTotalSuperDamage(opp.maxHp);
      const expectedLightning = Math.round(expectedTotal * ANDA_LIGHTNING_DAMAGE_SHARE);
      const expectedWall = expectedTotal - expectedLightning;

      const superInput = createEmptyInput();
      superInput.superMove = true;
      const idle = createEmptyInput();

      const triggerEvents = stepMatch(state, [superInput, idle], dt);
      assert.equal(anda.shakti, 0);
      assert.equal(anda.action, 'super');
      assert.ok(state.andaSuper?.active, 'Anda Super state must be active');
      assert.ok(triggerEvents.some((e) => e.type === 'super'));

      let preWallDamage = 0;
      let capturedPreWall = false;
      const andaComicWords: string[] = [];
      let sawWallImpact = false;
      let sawWallShatter = false;
      const steps = Math.ceil((ANDA_SUPER_DURATION + 0.25) / dt);

      for (let i = 0; i < steps; i++) {
        const evs = stepMatch(state, [idle, idle], dt);
        for (const ev of evs) {
          if (ev.word) {
            andaComicWords.push(ev.word);
            if (state.andaSuper?.active) {
              assert.equal(ev.isSuperSignature, true);
              assert.equal(shouldAllowFloatingCallout(state, ev), true);
            }
          }
        }
        if (state.andaSuperSignals.some((s) => s.kind === 'wall_impact')) {
          sawWallImpact = true;
        }
        if (state.andaSuperSignals.some((s) => s.kind === 'wall_shatter')) {
          sawWallShatter = true;
        }
        if (state.andaSuper?.active) {
          assert.equal(
            shouldAllowFloatingCallout(state),
            false,
            'Generic floating comic hit-text spam must remain suppressed throughout Anda Bhai Super',
          );
          if (!capturedPreWall && state.andaSuper.elapsed >= 2.45 && state.andaSuper.elapsed < 2.65) {
            preWallDamage = startHp - opp.hp;
            capturedPreWall = true;
          }
        }
      }

      const totalDamage = startHp - opp.hp;
      const wallDamage = totalDamage - preWallDamage;

      assert.equal(state.andaSuper?.active ?? false, false, 'Anda Super must finish cleanly at 4.5s');
      assert.equal(sawWallImpact, true, 'Wall impact VFX signal must fire');
      assert.equal(sawWallShatter, true, 'Wall shatter beat must emit after flattened beat');
      assert.deepEqual(
        andaComicWords,
        ['THE GREAT WALL DROP!'],
        'Anda Bhai Super must emit ONLY his signature THE GREAT WALL DROP! pop-up with zero hit-spam',
      );
      assert.equal(
        preWallDamage,
        expectedLightning,
        `${oppId} @dt=${dt.toFixed(4)}: lightning damage must equal ~25% (${expectedLightning}), got ${preWallDamage}`,
      );
      assert.equal(
        wallDamage,
        expectedWall,
        `${oppId} @dt=${dt.toFixed(4)}: wall slam damage must equal ~75% (${expectedWall}), got ${wallDamage}`,
      );
      assert.equal(totalDamage, expectedTotal);
      assert.equal(anda.superDamageDealt, expectedTotal);
      assert.equal(opp.hp, opp.maxHp - expectedTotal);
      assert.equal(anda.action, 'idle');
    }
  }
});

test('Anda Bhai Super cleanly KOs opponent at <= 33% HP and leaves 33%+1 HP opponent at exact 1 HP', () => {
  // Case A: Exact 33% HP -> KO after wall crush
  const koState = createMatchState('anda', 'billa', true);
  const [andaA, billaA] = koState.fighters;
  const superCap = computeTotalSuperDamage(billaA.maxHp);
  andaA.shakti = 100;
  billaA.hp = superCap;

  const superInput = createEmptyInput();
  superInput.superMove = true;
  const idle = createEmptyInput();

  stepMatch(koState, [superInput, idle], 0.02);

  // Advance to t = 2.4s (after lightning, before 2.74s wall impact): opponent must still be alive
  for (let i = 0; i < 60; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.ok(billaA.hp >= 1, 'Opponent must survive lightning until brick wall impact');
  assert.equal(koState.phase, 'fighting');

  // Finish remaining 2.5s through wall slam, shatter, and KO transition
  for (let i = 0; i < 70; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.equal(billaA.hp, 0, 'Opponent at <= 33% HP must be cleanly KOed');
  assert.equal(koState.phase, 'ko_freeze');
  assert.equal(koState.roundWinnerSlot, 0);
  assert.equal(koState.p1RoundsWon, 1);

  // Case B: 1 HP above exact 33% cap -> survives with 1 HP
  const surviveState = createMatchState('anda', 'billa', true);
  const [andaB, billaB] = surviveState.fighters;
  andaB.shakti = 100;
  billaB.hp = superCap + 1;

  stepMatch(surviveState, [superInput, idle], 0.02);
  for (let i = 0; i < 130; i++) {
    stepMatch(surviveState, [idle, idle], 0.04);
  }
  assert.equal(billaB.hp, 1, 'Opponent at 33% cap + 1 HP must survive with 1 HP left');
  assert.equal(surviveState.phase, 'fighting');
});

test('Laddoo Mausi "GOL-GOL LADDOO BARRAGE!" phase timeline, levitation curve (y ≈ 2.0) & dim factor', () => {
  assert.equal(getMausiSuperPhase(0.0), 'laddoo_gulp');
  assert.equal(getMausiSuperPhase(1.5), 'laddoo_gulp');
  assert.equal(getMausiSuperPhase(1.7), 'levitate');
  assert.equal(getMausiSuperPhase(2.4), 'levitate');
  assert.equal(getMausiSuperPhase(2.6), 'laddoo_barrage');
  assert.equal(getMausiSuperPhase(4.9), 'laddoo_barrage');

  assert.equal(getMausiLevitationY(0.5), 0);
  assert.equal(getMausiLevitationY(1.55), 0);
  assert.ok(getMausiLevitationY(2.0) > 0.7 && getMausiLevitationY(2.0) < MAUSI_LEVITATION_PEAK_Y);
  assert.ok(Math.abs(getMausiLevitationY(3.2) - MAUSI_LEVITATION_PEAK_Y) < 0.14);
  assert.equal(getMausiLevitationY(MAUSI_SUPER_DURATION), 0);

  assert.equal(getMausiSuperDimFactor(0), 0);
  assert.equal(getMausiSuperDimFactor(2.0), 1);
  assert.equal(getMausiSuperDimFactor(4.2), 1);
  assert.equal(getMausiSuperDimFactor(MAUSI_SUPER_DURATION), 0);
});

test('Laddoo Mausi Super deals exact 33% maxHp (~50% laddoo storm + ~50% Mega Laddoo) and levitates smoothly across all opponents & framerates', () => {
  const opponents: FighterId[] = ['sheru', 'billa', 'neta', 'anda', 'mausi'];
  const frameRates = [1 / 20, 1 / 60, 1 / 120];

  for (const oppId of opponents) {
    for (const dt of frameRates) {
      const state = createMatchState('mausi', oppId, true);
      const [mausi, opp] = state.fighters;
      mausi.shakti = 100;
      const startHp = opp.hp;
      const expectedTotal = computeTotalSuperDamage(opp.maxHp);
      const expectedBarrage = Math.round(expectedTotal * MAUSI_BARRAGE_DAMAGE_SHARE);
      const expectedMega = expectedTotal - expectedBarrage;

      const superInput = createEmptyInput();
      superInput.superMove = true;
      const idle = createEmptyInput();

      const triggerEvents = stepMatch(state, [superInput, idle], dt);
      assert.equal(mausi.shakti, 0);
      assert.equal(mausi.action, 'super');
      assert.ok(state.mausiSuper?.active, 'Mausi Super state must be active');
      assert.ok(triggerEvents.some((e) => e.type === 'super'));

      let preMegaDamage = 0;
      let capturedPreMega = false;
      let maxHoverY = 0;
      const mausiComicWords: string[] = [];
      let laddooHitSignals = 0;
      let sawMegaImpact = false;
      const steps = Math.ceil((MAUSI_SUPER_DURATION + 0.25) / dt);

      for (let i = 0; i < steps; i++) {
        const evs = stepMatch(state, [idle, idle], dt);
        if (mausi.y > maxHoverY) maxHoverY = mausi.y;
        for (const ev of evs) {
          if (ev.word) {
            mausiComicWords.push(ev.word);
            if (state.mausiSuper?.active) {
              assert.equal(ev.isSuperSignature, true);
              assert.equal(shouldAllowFloatingCallout(state, ev), true);
            }
          }
        }
        laddooHitSignals += state.mausiSuperSignals.filter((s) => s.kind === 'laddoo_hit').length;
        if (state.mausiSuperSignals.some((s) => s.kind === 'mega_impact')) {
          sawMegaImpact = true;
        }
        if (state.mausiSuper?.active) {
          assert.equal(
            shouldAllowFloatingCallout(state),
            false,
            'Generic floating comic hit-text spam must remain suppressed throughout Laddoo Mausi Super',
          );
          if (!capturedPreMega && state.mausiSuper.elapsed >= 4.08 && state.mausiSuper.elapsed < 4.24) {
            preMegaDamage = startHp - opp.hp;
            capturedPreMega = true;
          }
        }
      }

      const totalDamage = startHp - opp.hp;
      const megaDamage = totalDamage - preMegaDamage;

      assert.equal(state.mausiSuper?.active ?? false, false, 'Mausi Super must finish cleanly at 5.0s');
      assert.ok(maxHoverY >= 1.9, `Mausi must levitate up to ~2.0, peaked at ${maxHoverY.toFixed(2)}`);
      assert.equal(mausi.y, 0, 'Mausi must touch down cleanly on ground at end of Super');
      assert.equal(laddooHitSignals, 7, 'All 7 laddoo barrage hit VFX signals must fire');
      assert.equal(sawMegaImpact, true, 'Mega Laddoo impact VFX signal must fire');
      assert.deepEqual(
        mausiComicWords,
        ['GOL-GOL LADDOO!'],
        'Laddoo Mausi Super must emit ONLY her signature GOL-GOL LADDOO! pop-up with zero hit-spam',
      );
      assert.equal(
        preMegaDamage,
        expectedBarrage,
        `${oppId} @dt=${dt.toFixed(4)}: barrage damage must equal ~50% (${expectedBarrage}), got ${preMegaDamage}`,
      );
      assert.equal(
        megaDamage,
        expectedMega,
        `${oppId} @dt=${dt.toFixed(4)}: Mega Laddoo damage must equal ~50% (${expectedMega}), got ${megaDamage}`,
      );
      assert.equal(totalDamage, expectedTotal);
      assert.equal(mausi.superDamageDealt, expectedTotal);
      assert.equal(opp.hp, opp.maxHp - expectedTotal);
      assert.equal(mausi.action, 'idle');
    }
  }
});

test('Laddoo Mausi Super cleanly KOs opponent at <= 33% HP and leaves 33%+1 HP opponent at exact 1 HP', () => {
  // Case A: Exact 33% HP -> KO on Mega Laddoo finisher
  const koState = createMatchState('mausi', 'billa', true);
  const [mausiA, billaA] = koState.fighters;
  const superCap = computeTotalSuperDamage(billaA.maxHp);
  mausiA.shakti = 100;
  billaA.hp = superCap;

  const superInput = createEmptyInput();
  superInput.superMove = true;
  const idle = createEmptyInput();

  stepMatch(koState, [superInput, idle], 0.02);

  // Advance to t = 4.04s (before 4.30s Mega Laddoo impact): opponent must still be alive
  for (let i = 0; i < 101; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.ok(billaA.hp >= 1, 'Opponent must survive barrage until Mega Laddoo finisher');
  assert.equal(koState.phase, 'fighting');

  // Finish through 5.0s touchdown and KO transition
  for (let i = 0; i < 35; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.equal(billaA.hp, 0, 'Opponent at <= 33% HP must be cleanly KOed by Mega Laddoo');
  assert.equal(koState.phase, 'ko_freeze');
  assert.equal(koState.roundWinnerSlot, 0);
  assert.equal(koState.p1RoundsWon, 1);

  // Case B: 1 HP above exact 33% cap -> survives with 1 HP
  const surviveState = createMatchState('mausi', 'billa', true);
  const [mausiB, billaB] = surviveState.fighters;
  mausiB.shakti = 100;
  billaB.hp = superCap + 1;

  stepMatch(surviveState, [superInput, idle], 0.02);
  for (let i = 0; i < 140; i++) {
    stepMatch(surviveState, [idle, idle], 0.04);
  }
  assert.equal(billaB.hp, 1, 'Opponent at 33% cap + 1 HP must survive with 1 HP left');
  assert.equal(surviveState.phase, 'fighting');
});

test('Super camera choreography handles Anda Bhai and Laddoo Mausi cleanly across all phases', () => {
  const andaClose = computeSuperCameraTarget(0.5, ANDA_SUPER_DURATION, -2.4, 1, 2.4, false, 'anda', 0);
  const andaWall = computeSuperCameraTarget(2.8, ANDA_SUPER_DURATION, -2.4, 1, 2.4, false, 'anda', 0);
  const andaEnd = computeSuperCameraTarget(ANDA_SUPER_DURATION, ANDA_SUPER_DURATION, -2.4, 1, 2.4, false, 'anda', 0);

  assert.ok(andaClose.z < 4.5, 'Anda Phase 1 should use dramatic low-angle close-up');
  assert.ok(andaWall.z > 7.5, 'Anda Phase 3 should pull out wide to frame sky & falling brick wall');
  assert.ok(Math.abs(andaEnd.z - 9.2) < 0.01, 'Anda camera must return to standard 2.5D Z=9.2');

  const mausiClose = computeSuperCameraTarget(0.6, MAUSI_SUPER_DURATION, -2.4, 1, 2.4, false, 'mausi', 0);
  const mausiLift = computeSuperCameraTarget(2.1, MAUSI_SUPER_DURATION, -2.4, 1, 2.4, false, 'mausi', 1.6);
  const mausiBarrage = computeSuperCameraTarget(3.4, MAUSI_SUPER_DURATION, -2.4, 1, 2.4, false, 'mausi', 2.0);
  const mausiEnd = computeSuperCameraTarget(MAUSI_SUPER_DURATION, MAUSI_SUPER_DURATION, -2.4, 1, 2.4, false, 'mausi', 0);

  assert.ok(mausiClose.z < 4.2, 'Mausi Phase 1 should use low-angle close-up for Power Laddoo gulp');
  assert.ok(mausiLift.lookY > 1.8, 'Mausi Phase 2 should track upward as she levitates');
  assert.ok(mausiBarrage.z > 8.5, 'Mausi Phase 3 should frame both levitating Mausi and opponent');
  assert.ok(Math.abs(mausiEnd.z - 9.2) < 0.01, 'Mausi camera must return to standard 2.5D Z=9.2');
});
