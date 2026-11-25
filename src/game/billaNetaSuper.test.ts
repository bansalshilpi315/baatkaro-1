import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BILLA_SUPER_BANNER,
  BILLA_SUPER_DURATION,
  getBillaSuperDimFactor,
  getBillaSuperPhase,
} from './billaSuper';
import { computeSuperCameraTarget } from './camera';
import {
  computeTotalSuperDamage,
  createEmptyInput,
  createMatchState,
  shouldAllowFloatingCallout,
  stepMatch,
} from './combat';
import {
  NETA_LEVITATION_PEAK_Y,
  NETA_SUPER_BANNER,
  NETA_SUPER_DURATION,
  getNetaLevitationY,
  getNetaSuperDimFactor,
  getNetaSuperPhase,
} from './netaSuper';
import type { FighterId } from './types';

test('Blue Billa Super phase timeline & dim factor map accurately across 4.5s', () => {
  assert.equal(BILLA_SUPER_BANNER, 'CHIRKUT CHAOS!');
  assert.equal(getBillaSuperPhase(0.0), 'eye_glow');
  assert.equal(getBillaSuperPhase(1.15), 'eye_glow');
  assert.equal(getBillaSuperPhase(1.25), 'roach_launch');
  assert.equal(getBillaSuperPhase(2.05), 'roach_launch');
  assert.equal(getBillaSuperPhase(2.15), 'smoke_beatdown');
  assert.equal(getBillaSuperPhase(4.05), 'smoke_beatdown');
  assert.equal(getBillaSuperPhase(4.15), 'pop_finisher');
  assert.equal(getBillaSuperPhase(4.49), 'pop_finisher');

  assert.equal(getBillaSuperDimFactor(0), 0);
  assert.equal(getBillaSuperDimFactor(1.0), 1);
  assert.equal(getBillaSuperDimFactor(3.8), 1);
  assert.ok(getBillaSuperDimFactor(4.3) < 0.6);
  assert.equal(getBillaSuperDimFactor(BILLA_SUPER_DURATION), 0);
});

test('Blue Billa "CHIRKUT CHAOS" deals exact 33% opponent maxHp (~45% smoke ticks + ~55% pop finisher) across all opponents and framerates', () => {
  const opponents: FighterId[] = ['billa', 'mausi', 'sheru', 'anda', 'neta'];
  const frameRates = [1 / 20, 1 / 60, 1 / 120];

  for (const oppId of opponents) {
    for (const dt of frameRates) {
      const state = createMatchState('billa', oppId, true);
      const [billa, opp] = state.fighters;
      billa.x = -6.0;
      opp.x = 5.5;
      billa.shakti = 100;

      const startHp = opp.hp;
      const expectedTotal = computeTotalSuperDamage(opp.maxHp);
      const expectedCombo = Math.round(expectedTotal * 0.45);
      const expectedFinisher = expectedTotal - expectedCombo;

      const superInput = createEmptyInput();
      superInput.superMove = true;
      const idle = createEmptyInput();

      const triggerEvents = stepMatch(state, [superInput, idle], dt);
      assert.equal(billa.shakti, 0, '100% Shakti should be consumed immediately');
      assert.equal(billa.action, 'super');
      assert.ok(state.billaSuper?.active, 'Blue Billa Super sequence should be active');
      assert.equal(state.sheruSuper, null);
      assert.equal(state.netaSuper, null);
      assert.ok(triggerEvents.some((e) => e.type === 'super'));

      let preFinisherDamage = 0;
      let capturedPreFinisher = false;
      const smokeComicWords: string[] = [];
      const nonSmokeComicWords: string[] = [];
      const steps = Math.ceil((BILLA_SUPER_DURATION + 0.25) / dt);

      for (let i = 0; i < steps; i++) {
        const evs = stepMatch(state, [idle, idle], dt);
        const phase: string | null = state.billaSuper?.active ? state.billaSuper.phase : null;
        if (state.billaSuper?.active) {
          assert.equal(
            shouldAllowFloatingCallout(state),
            phase === 'smoke_beatdown',
            `Blue Billa callouts allowed ONLY in smoke_beatdown, phase=${phase}`,
          );
        }
        for (const ev of evs) {
          if (ev.word) {
            if (phase === 'smoke_beatdown') {
              smokeComicWords.push(ev.word);
            } else {
              nonSmokeComicWords.push(`${phase}:${ev.word}`);
            }
          }
        }
        if (state.billaSuper?.active) {
          if (!capturedPreFinisher && state.billaSuper.elapsed >= 3.92 && state.billaSuper.elapsed < 4.09) {
            preFinisherDamage = startHp - opp.hp;
            capturedPreFinisher = true;
          }
        }
      }

      const totalDamage = startHp - opp.hp;
      const finisherDamage = totalDamage - preFinisherDamage;

      assert.equal(state.billaSuper?.active ?? false, false, 'Blue Billa Super must finish cleanly at 4.5s');
      assert.deepEqual(
        nonSmokeComicWords,
        [],
        'Blue Billa Super must emit ZERO comic text in Phases 1, 2, or 4 (pop burst)',
      );
      assert.deepEqual(
        smokeComicWords,
        ['POW!', 'WHAM!', 'CHIRKUT!'],
        'Blue Billa Phase 3 smoke cloud must emit only sparse POW!, WHAM!, CHIRKUT! pops',
      );
      assert.equal(
        preFinisherDamage,
        expectedCombo,
        `${oppId} @dt=${dt.toFixed(4)}: smoke ticks should be ~45% (${expectedCombo}), got ${preFinisherDamage}`,
      );
      assert.equal(
        finisherDamage,
        expectedFinisher,
        `${oppId} @dt=${dt.toFixed(4)}: pop finisher should be ~55% (${expectedFinisher}), got ${finisherDamage}`,
      );
      assert.equal(
        totalDamage,
        expectedTotal,
        `${oppId} @dt=${dt.toFixed(4)}: total Super damage must equal exact 33% maxHp (${expectedTotal}), got ${totalDamage}`,
      );
      assert.equal(billa.superDamageDealt, expectedTotal);
      assert.equal(opp.hp, opp.maxHp - expectedTotal);
      assert.equal(billa.action, 'idle');
    }
  }
});

test('Blue Billa Super cleanly KOs opponent at <= 33% HP on pop finisher and leaves 34% HP opponent alive at 1 HP', () => {
  const koState = createMatchState('billa', 'billa', true);
  const [billaA, oppA] = koState.fighters;
  billaA.shakti = 100;
  oppA.hp = 33; // 33/100 exact 33%

  const superInput = createEmptyInput();
  superInput.superMove = true;
  const idle = createEmptyInput();

  stepMatch(koState, [superInput, idle], 0.02);

  // Advance to ~3.9s (before 4.1s pop finisher): opponent must stay alive for full choreography
  for (let i = 0; i < 97; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.ok(oppA.hp >= 1, 'Opponent should survive until 4.1s pop finisher');
  assert.equal(koState.phase, 'fighting');

  // Finish remaining ~0.8s through pop finisher and sequence end
  for (let i = 0; i < 25; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.equal(oppA.hp, 0, 'Opponent at <= 33% HP must be cleanly KOed by pop finisher');
  assert.equal(koState.phase, 'ko_freeze');
  assert.equal(koState.roundWinnerSlot, 0);

  // Case B: Opponent at 34/100 HP -> survives at 1 HP
  const surviveState = createMatchState('billa', 'billa', true);
  const [billaB, oppB] = surviveState.fighters;
  billaB.shakti = 100;
  oppB.hp = 34;

  stepMatch(surviveState, [superInput, idle], 0.02);
  for (let i = 0; i < 125; i++) {
    stepMatch(surviveState, [idle, idle], 0.04);
  }
  assert.equal(oppB.hp, 1, 'Opponent at 34/100 HP must survive exact 33% cap with 1 HP left');
  assert.equal(surviveState.phase, 'fighting');
});

test('Garib Sena Neta Super phase timeline, levitation altitude (y ≈ 2.2), and dim factor map accurately across 4.8s', () => {
  assert.equal(NETA_SUPER_BANNER, 'VANS, ATTACK!');
  assert.equal(getNetaSuperPhase(0.0), 'levitate_command');
  assert.equal(getNetaSuperPhase(1.45), 'levitate_command');
  assert.equal(getNetaSuperPhase(1.55), 'van_stampede');
  assert.equal(getNetaSuperPhase(3.95), 'van_stampede');
  assert.equal(getNetaSuperPhase(4.05), 'van_finisher');
  assert.equal(getNetaSuperPhase(4.78), 'van_finisher');

  assert.equal(getNetaLevitationY(0), 0);
  const peakY = getNetaLevitationY(1.4);
  assert.ok(
    Math.abs(peakY - NETA_LEVITATION_PEAK_Y) < 0.12,
    `Peak levitation height should be near ${NETA_LEVITATION_PEAK_Y}, got ${peakY}`,
  );
  assert.ok(getNetaLevitationY(2.6) > 2.0, 'Neta must remain levitating during van stampede');
  assert.equal(getNetaLevitationY(NETA_SUPER_DURATION), 0, 'Neta must land smoothly at y=0');

  assert.equal(getNetaSuperDimFactor(0), 0);
  assert.equal(getNetaSuperDimFactor(1.2), 1);
  assert.equal(getNetaSuperDimFactor(4.1), 1);
  assert.ok(getNetaSuperDimFactor(4.55) < 0.6);
  assert.equal(getNetaSuperDimFactor(NETA_SUPER_DURATION), 0);
});

test('Garib Sena Neta "VANS, ATTACK!" deals exact 33% opponent maxHp (~45% van hits + ~55% lead van finisher) across all opponents and framerates', () => {
  const opponents: FighterId[] = ['billa', 'mausi', 'sheru', 'anda', 'neta'];
  const frameRates = [1 / 20, 1 / 60, 1 / 120];

  for (const oppId of opponents) {
    for (const dt of frameRates) {
      const state = createMatchState('neta', oppId, true);
      const [neta, opp] = state.fighters;
      neta.x = -5.5;
      opp.x = 5.5;
      neta.shakti = 100;

      const startHp = opp.hp;
      const expectedTotal = computeTotalSuperDamage(opp.maxHp);
      const expectedCombo = Math.round(expectedTotal * 0.45);
      const expectedFinisher = expectedTotal - expectedCombo;

      const superInput = createEmptyInput();
      superInput.superMove = true;
      const idle = createEmptyInput();

      const triggerEvents = stepMatch(state, [superInput, idle], dt);
      assert.equal(neta.shakti, 0);
      assert.equal(neta.action, 'super');
      assert.ok(state.netaSuper?.active, 'Garib Sena Neta Super sequence should be active');
      assert.equal(state.sheruSuper, null);
      assert.equal(state.billaSuper, null);
      assert.ok(triggerEvents.some((e) => e.type === 'super'));

      let preFinisherDamage = 0;
      let capturedPreFinisher = false;
      let maxNetaY = 0;
      const netaComicWords: string[] = [];
      let vanHitSignals = 0;
      const steps = Math.ceil((NETA_SUPER_DURATION + 0.25) / dt);

      for (let i = 0; i < steps; i++) {
        const evs = stepMatch(state, [idle, idle], dt);
        for (const ev of evs) {
          if (ev.word) {
            netaComicWords.push(ev.word);
            if (state.netaSuper?.active) {
              assert.equal(ev.isSuperSignature, true);
              assert.equal(shouldAllowFloatingCallout(state, ev), true);
            }
          }
        }
        vanHitSignals += state.netaSuperSignals.filter((s) => s.kind === 'van_hit').length;
        if (neta.y > maxNetaY) maxNetaY = neta.y;
        if (state.netaSuper?.active) {
          assert.equal(
            shouldAllowFloatingCallout(state),
            false,
            'Generic floating comic hit-text spam must remain suppressed throughout Garib Sena Neta Super',
          );
          if (!capturedPreFinisher && state.netaSuper.elapsed >= 3.72 && state.netaSuper.elapsed < 4.0) {
            preFinisherDamage = startHp - opp.hp;
            capturedPreFinisher = true;
          }
        }
      }

      const totalDamage = startHp - opp.hp;
      const finisherDamage = totalDamage - preFinisherDamage;

      assert.equal(state.netaSuper?.active ?? false, false, 'Neta Super must finish cleanly at 4.8s');
      assert.ok(maxNetaY >= 2.05, `Neta should levitate to y ≈ 2.2, max reached ${maxNetaY.toFixed(2)}`);
      assert.equal(neta.y, 0, 'Neta must touch down to ground y = 0');
      assert.equal(vanHitSignals, 4, 'All 4 convoy van_hit signals must still fire intact');
      assert.deepEqual(
        netaComicWords,
        ['VANS, ATTACK!'],
        'Garib Sena Neta Super must emit ONLY his signature VANS, ATTACK! pop-up with zero hit-spam',
      );
      assert.equal(
        preFinisherDamage,
        expectedCombo,
        `${oppId} @dt=${dt.toFixed(4)}: convoy van ticks should be ~45% (${expectedCombo}), got ${preFinisherDamage}`,
      );
      assert.equal(
        finisherDamage,
        expectedFinisher,
        `${oppId} @dt=${dt.toFixed(4)}: lead van finisher should be ~55% (${expectedFinisher}), got ${finisherDamage}`,
      );
      assert.equal(
        totalDamage,
        expectedTotal,
        `${oppId} @dt=${dt.toFixed(4)}: total Super damage must equal exact 33% maxHp (${expectedTotal}), got ${totalDamage}`,
      );
      assert.equal(neta.superDamageDealt, expectedTotal);
      assert.equal(opp.hp, opp.maxHp - expectedTotal);
      assert.equal(neta.action, 'idle');
    }
  }
});

test('Garib Sena Neta Super cleanly KOs opponent at <= 33% HP on Lead Van finisher and leaves 34% HP opponent alive at 1 HP', () => {
  const koState = createMatchState('neta', 'billa', true);
  const [netaA, oppA] = koState.fighters;
  netaA.shakti = 100;
  oppA.hp = 33;

  const superInput = createEmptyInput();
  superInput.superMove = true;
  const idle = createEmptyInput();

  stepMatch(koState, [superInput, idle], 0.02);

  // Advance to ~3.8s (before 4.02s lead van finisher)
  for (let i = 0; i < 95; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.ok(oppA.hp >= 1, 'Opponent must stay alive until Lead Van finisher');
  assert.equal(koState.phase, 'fighting');

  // Finish remaining ~1.2s
  for (let i = 0; i < 32; i++) {
    stepMatch(koState, [idle, idle], 0.04);
  }
  assert.equal(oppA.hp, 0, 'Opponent at <= 33% HP must be cleanly KOed by Lead Van finisher');
  assert.equal(koState.phase, 'ko_freeze');
  assert.equal(koState.roundWinnerSlot, 0);

  // Case B: 34/100 HP -> survives with 1 HP
  const surviveState = createMatchState('neta', 'billa', true);
  const [netaB, oppB] = surviveState.fighters;
  netaB.shakti = 100;
  oppB.hp = 34;

  stepMatch(surviveState, [superInput, idle], 0.02);
  for (let i = 0; i < 130; i++) {
    stepMatch(surviveState, [idle, idle], 0.04);
  }
  assert.equal(oppB.hp, 1, 'Opponent at 34/100 HP must survive exact 33% cap with 1 HP left');
  assert.equal(surviveState.phase, 'fighting');
});

test('Super camera choreography frames Blue Billa eye close-up -> smoke cloud and Neta levitation -> wide van convoy', () => {
  // Blue Billa eye close-up is tightly zoomed near attacker's head
  const billaClose = computeSuperCameraTarget(0.7, BILLA_SUPER_DURATION, -3.0, 1, 2.5, false, 'billa', 0);
  assert.ok(billaClose.z < 3.5, 'Billa eye close-up should zoom tightly onto eyes');
  assert.ok(Math.abs(billaClose.lookX - -3.0) < 0.5, 'Billa eye close-up must focus on Billa');

  // Blue Billa smoke beatdown focuses on the defender's smoke cloud
  const billaCloud = computeSuperCameraTarget(3.0, BILLA_SUPER_DURATION, -3.0, 1, 2.5, false, 'billa', 0);
  assert.ok(Math.abs(billaCloud.lookX - 2.5) < 0.8, 'Billa Phase 3 camera must frame defender smoke cloud');

  // Neta levitation close-up tracks upward as Neta rises to y=2.2
  const netaLev = computeSuperCameraTarget(1.1, NETA_SUPER_DURATION, -3.0, 1, 2.5, false, 'neta', 2.2);
  assert.ok(netaLev.lookY > 3.0, 'Neta Phase 1 camera must look up at levitating Neta');

  // Neta van stampede pulls back to wide arena framing
  const netaWide = computeSuperCameraTarget(2.8, NETA_SUPER_DURATION, -3.0, 1, 2.5, false, 'neta', 2.2);
  assert.ok(netaWide.z > 8.2, 'Neta Phase 2 camera must pull out to wide 3D arena angle for van convoy');
  assert.ok(netaWide.y > 3.2, 'Neta Phase 2 camera must elevate for wide convoy overview');
});
