import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PRELOAD_MAX_RETRIES } from './assetPreloader';
import { DesiAudioEngine } from './audio';
import { computeSuperCameraTarget } from './camera';
import { FIGHTER_CONFIGS, FIGHTER_LIST } from './characters/configs';
import {
  computeSignatureDamage,
  computeTotalSuperDamage,
  createEmptyInput,
  createMatchState,
  stepMatch,
} from './combat';
import {
  KRISH_LEAP_START_TIME,
  KRISH_REATTACH_TIME,
  KRISH_SMASH_IMPACT_TIME,
  KRISH_SMASH_START_TIME,
  KRISH_SUPER_BANNER,
  KRISH_SUPER_DURATION,
  createKrishSuperState,
  stepKrishSuper,
} from './krishSuper';
import {
  UTKARSH_FINISHER_IMPACT_TIME,
  UTKARSH_ORBIT_REVOLUTIONS,
  UTKARSH_ORBIT_START_TIME,
  UTKARSH_SUPER_BANNER,
  UTKARSH_SUPER_DURATION,
  createUtkarshSuperState,
  stepUtkarshSuper,
} from './utkarshSuper';
import type { CombatEvent, FighterId } from './types';

test('PART 1: Dynamic roster count equals 10 and zero stale hardcoded "7 Fighters" exist in UI modals', () => {
  assert.equal(FIGHTER_LIST.length, 10);
  const filesToAudit = [
    path.resolve(process.cwd(), 'src/components/PlayerAccountModal.tsx'),
    path.resolve(process.cwd(), 'src/components/InfoModals.tsx'),
    path.resolve(process.cwd(), 'src/components/SettingsModal.tsx'),
  ];
  for (const filePath of filesToAudit) {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.equal(
      /\/7\s*Fighters|\/\s*7\b|7 Playable Fighters/i.test(content),
      false,
      `${path.basename(filePath)} must not hardcode stale 7 fighter counts`,
    );
  }
});

test('PART 2: AudioEngine strictly suppresses BGM during boot & portrait block and removes legacy synth BGM', () => {
  assert.equal(PRELOAD_MAX_RETRIES, 3);
  const audioSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/game/audio.ts'), 'utf8');
  assert.equal(audioSrc.includes('musicTimer'), false, 'Legacy synth musicTimer must be removed');
  assert.equal(audioSrc.includes('pauseSynthMusicTimer'), false, 'Legacy pauseSynthMusicTimer must be removed');

  const engine = new DesiAudioEngine();
  engine.setBootReady(false);
  assert.equal(engine.isBootReady(), false);
  assert.equal(engine.isPortraitBlocked(), false);

  // Attempting to start music before bootReady must NOT start playback
  engine.startMusic();
  assert.equal(engine.isBgmLooping(), false);

  // Even after bootReady, if portraitBlocked is true, playback must remain blocked
  engine.setBootReady(true);
  engine.setPortraitBlocked(true);
  engine.startMusic();
  assert.equal(engine.isBgmLooping(), false);

  // Releasing portrait block allows audio engine state transitions cleanly
  engine.setPortraitBlocked(false);
  assert.equal(engine.isBootReady(), true);
  assert.equal(engine.isPortraitBlocked(), false);

  // Verify App.tsx wires both bootReady and portraitBlocked gates into audioEngine
  const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appSrc.includes('audioEngine.setBootReady('));
  assert.ok(appSrc.includes('audioEngine.setPortraitBlocked('));
});

test('PART 3: Krish 10KG HEAVY BAG SMASH 3-phase choreography, backpack detachment/reattach, 33% cap & KO', () => {
  assert.equal(KRISH_SUPER_DURATION, 3.0);
  assert.equal(KRISH_SUPER_BANNER, '10KG HEAVY BAG SMASH!');

  const state = createMatchState('krish', 'samyak', true);
  state.fighters[0].x = -2.2;
  state.fighters[1].x = 2.2;
  const attacker = state.fighters[0];
  const defender = state.fighters[1];
  const startHp = defender.hp;
  const expectedCap = computeTotalSuperDamage(defender.maxHp);

  const sup = createKrishSuperState(attacker, defender);
  const events: CombatEvent[] = [];
  const signals: Array<{ kind: string }> = [];

  let sawUnstrapWindup = false;
  let sawMidairLeap = false;
  let sawPeakAirY = 0;
  let sawOverheadSmash = false;
  let sawBagDetached = false;
  let sawBagReattached = false;

  let finished = false;
  for (let i = 0; i < 160 && !finished; i++) {
    finished = stepKrishSuper(sup, attacker, defender, 0.02, events, signals as never);
    if (sup.phase === 'unstrap_windup') sawUnstrapWindup = true;
    if (sup.phase === 'midair_leap') {
      sawMidairLeap = true;
      assert.equal(sup.bagInBothHands, true);
    }
    if (sup.phase === 'overhead_smash') sawOverheadSmash = true;
    if (sup.bagDetached) sawBagDetached = true;
    if (!sup.bagDetached && sup.elapsed >= KRISH_REATTACH_TIME) sawBagReattached = true;
    if (attacker.y > sawPeakAirY) sawPeakAirY = attacker.y;
  }

  assert.equal(finished, true, 'Krish Super must finish within 3.0s');
  assert.equal(sawUnstrapWindup, true);
  assert.equal(sawMidairLeap, true);
  assert.equal(sawOverheadSmash, true);
  assert.ok(sawPeakAirY >= 1.8, `Krish must leap high mid-air, peak y=${sawPeakAirY}`);
  assert.equal(sawBagDetached, true, 'Backpack must detach during Super');
  assert.equal(sawBagReattached, true, 'Backpack must cleanly re-attach after smash');
  assert.equal(sup.bagDetached, false, 'Backpack must be re-attached at end');
  assert.equal(startHp - defender.hp, expectedCap, 'Must deal strictly 33% maxHP');
  assert.ok(signals.some((s) => s.kind === 'unstrap_bag'));
  assert.ok(signals.some((s) => s.kind === 'leap_raise'));
  assert.ok(signals.some((s) => s.kind === 'bag_smash_impact'));
  assert.ok(signals.some((s) => s.kind === 'bag_reattach'));

  // Verify KO resolution when defender HP <= 33% cap
  const koState = createMatchState('krish', 'utkarsh', true);
  koState.fighters[0].x = -1.6;
  koState.fighters[1].x = 1.6;
  koState.fighters[0].shakti = 100;
  koState.fighters[1].hp = 35;
  const superIn = createEmptyInput();
  superIn.superMove = true;
  stepMatch(koState, [superIn, createEmptyInput()], 0.016);
  for (let i = 0; i < 160; i++) {
    stepMatch(koState, [createEmptyInput(), createEmptyInput()], 0.02);
  }
  assert.equal(koState.fighters[1].hp, 0);
  assert.equal(koState.phase, 'ko_freeze');

  // Verify camera computes finite targets across all 3 Krish phases
  for (const t of [0.5, KRISH_LEAP_START_TIME + 0.3, KRISH_SMASH_START_TIME + 0.1, KRISH_SMASH_IMPACT_TIME + 0.2]) {
    const cam = computeSuperCameraTarget(t, KRISH_SUPER_DURATION, -1.0, 1, 1.5, false, 'krish', 1.2);
    assert.ok(Number.isFinite(cam.x) && Number.isFinite(cam.y) && Number.isFinite(cam.z));
  }
});

test('PART 3: Krish DROP-BARRAGE goes airborne horizontally and deals 11%-13% maxHP', () => {
  const state = createMatchState('krish', 'billa', true);
  state.fighters[0].x = -1.2;
  state.fighters[1].x = 1.1;
  const startHp = state.fighters[1].hp;
  const inp = createEmptyInput();
  inp.special = true;
  stepMatch(state, [inp, createEmptyInput()], 0.016);

  let maxAirY = 0;
  for (let i = 0; i < 45; i++) {
    stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.02);
    if (state.fighters[0].y > maxAirY) maxAirY = state.fighters[0].y;
  }
  assert.ok(maxAirY >= 0.4, `DROP-BARRAGE must hop airborne, peak y=${maxAirY}`);
  assert.equal(startHp - state.fighters[1].hp, computeSignatureDamage(state.fighters[1].maxHp));
});

test('PART 4: Utkarsh LIGHTNING ORBIT BLITZ 2-phase 360° XZ orbit, 6 strikes + electric finisher, 33% cap & KO', () => {
  assert.equal(UTKARSH_SUPER_DURATION, 3.4);
  assert.equal(UTKARSH_ORBIT_REVOLUTIONS, 3.5);
  assert.equal(UTKARSH_SUPER_BANNER, 'LIGHTNING ORBIT BLITZ!');

  const opponents: FighterId[] = ['sheru', 'krish', 'father'];
  for (const oppId of opponents) {
    const state = createMatchState('utkarsh', oppId, true);
    state.fighters[0].x = -2.2;
    state.fighters[1].x = 2.2;
    const attacker = state.fighters[0];
    const defender = state.fighters[1];
    const startHp = defender.hp;
    const expectedCap = computeTotalSuperDamage(defender.maxHp);

    const sup = createUtkarshSuperState(attacker, defender);
    const events: CombatEvent[] = [];
    const signals: Array<{ kind: string }> = [];

    let sawLaughTaunt = false;
    let sawOrbitBlitz = false;
    let maxPosZ = 0;
    let minNegZ = 0;

    let finished = false;
    for (let i = 0; i < 180 && !finished; i++) {
      finished = stepUtkarshSuper(sup, attacker, defender, 0.02, events, signals as never);
      if (sup.phase === 'laugh_taunt') sawLaughTaunt = true;
      if (sup.phase === 'orbit_blitz') sawOrbitBlitz = true;
      if (sup.attackerZ > maxPosZ) maxPosZ = sup.attackerZ;
      if (sup.attackerZ < minNegZ) minNegZ = sup.attackerZ;
    }

    assert.equal(finished, true, `Utkarsh Super vs ${oppId} must finish within 3.4s`);
    assert.equal(sawLaughTaunt, true);
    assert.equal(sawOrbitBlitz, true);
    assert.ok(maxPosZ > 1.0 && minNegZ < -1.0, `Must sweep full 360° in XZ depth (+Z=${maxPosZ}, -Z=${minNegZ})`);
    assert.equal(sup.attackerZ, 0, 'Must snap cleanly back to Z=0 on finish');
    assert.equal(sup.strikesLanded, 6, 'Must deliver 6 multi-hit orbit strikes');
    assert.equal(startHp - defender.hp, expectedCap, `Must deal strictly 33% maxHP to ${oppId}`);
    assert.ok(signals.some((s) => s.kind === 'laugh_taunt'));
    assert.ok(signals.some((s) => s.kind === 'orbit_start'));
    assert.ok(signals.some((s) => s.kind === 'orbit_strike'));
    assert.ok(signals.some((s) => s.kind === 'electric_finisher'));
  }

  // Verify KO resolution when defender HP <= 33% cap (stays >= 1 HP during 6 orbit strikes, KOs cleanly on electric finisher)
  const koState = createMatchState('utkarsh', 'adi', true);
  koState.fighters[0].x = -2.0;
  koState.fighters[1].x = 2.0;
  koState.fighters[0].shakti = 100;
  koState.fighters[1].hp = 40;
  const superIn = createEmptyInput();
  superIn.superMove = true;
  stepMatch(koState, [superIn, createEmptyInput()], 0.016);
  let diedBeforeFinisher = false;
  for (let i = 0; i < 180; i++) {
    stepMatch(koState, [createEmptyInput(), createEmptyInput()], 0.02);
    if (
      koState.utkarshSuper &&
      koState.utkarshSuper.elapsed < UTKARSH_FINISHER_IMPACT_TIME - 0.02 &&
      koState.fighters[1].hp <= 0
    ) {
      diedBeforeFinisher = true;
    }
  }
  assert.equal(diedBeforeFinisher, false, 'Orbit hits must be non-lethal so electric finisher delivers clean KO');
  assert.equal(koState.fighters[1].hp, 0);
  assert.equal(koState.phase, 'ko_freeze');

  // Verify camera computes finite targets across Utkarsh phases
  for (const t of [0.6, UTKARSH_ORBIT_START_TIME + 0.4, UTKARSH_FINISHER_IMPACT_TIME + 0.1]) {
    const cam = computeSuperCameraTarget(t, UTKARSH_SUPER_DURATION, -1.2, 1, 2.0, false, 'utkarsh', 0);
    assert.ok(Number.isFinite(cam.x) && Number.isFinite(cam.y) && Number.isFinite(cam.z));
  }
});

test('PART 4: Utkarsh SKY-BOLT SMASH leaps high into air then dives diagonally for 11%-13% maxHP', () => {
  assert.equal(FIGHTER_CONFIGS.utkarsh.special.id, 'sky_bolt_smash');
  assert.equal(FIGHTER_CONFIGS.utkarsh.special.shortLabel, 'SKY-BOLT SMASH');

  const state = createMatchState('utkarsh', 'krish', true);
  state.fighters[0].x = -1.3;
  state.fighters[1].x = 1.1;
  const startHp = state.fighters[1].hp;
  const inp = createEmptyInput();
  inp.special = true;
  stepMatch(state, [inp, createEmptyInput()], 0.016);

  let maxAirY = 0;
  for (let i = 0; i < 45; i++) {
    stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.02);
    if (state.fighters[0].y > maxAirY) maxAirY = state.fighters[0].y;
  }
  assert.ok(maxAirY >= 1.1, `SKY-BOLT SMASH must leap cleanly into the air before diving, peak y=${maxAirY}`);
  assert.equal(startHp - state.fighters[1].hp, computeSignatureDamage(state.fighters[1].maxHp));
});
