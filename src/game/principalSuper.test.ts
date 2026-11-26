import assert from 'node:assert/strict';
import test from 'node:test';
import { getSuperAudioUrl, PRINCIPAL_SUPER_AUDIO_URL } from './audio';
import { computeSuperCameraTarget } from './camera';
import { FIGHTER_CONFIGS, FIGHTER_LIST, STAGE_LIST } from './characters/configs';
import {
  computeSignatureDamage,
  createEmptyInput,
  createMatchState,
  getAttackTiming,
  shouldAllowFloatingCallout,
  stepMatch,
} from './combat';
import {
  PRINCIPAL_LEVITATE_Y,
  PRINCIPAL_PAPER_COUNT,
  PRINCIPAL_SUPER_BANNER,
  PRINCIPAL_SUPER_DURATION,
  PRINCIPAL_SUPER_SIGNATURE_TEXT,
} from './principalSuper';
import type { FighterId } from './types';

test('Principal Man is added as 8th playable fighter without replacing any existing 7 fighters or adding a stage', () => {
  assert.equal(FIGHTER_LIST.length, 8, 'Roster must contain all 7 existing fighters + Principal Man');
  assert.deepEqual(
    FIGHTER_LIST.map((f) => f.id),
    ['sheru', 'billa', 'neta', 'anda', 'mausi', 'father', 'samyak', 'principal'],
  );
  assert.equal(STAGE_LIST.length, 6, 'No extra stage should be added');

  const principal = FIGHTER_CONFIGS.principal;
  assert.equal(principal.name, 'Principal Man');
  assert.equal(principal.maxHp, 130, 'Principal Man must have boss-tier 130 HP');
  assert.equal(principal.attackPowerMultiplier, 1.15, 'Principal Man must have 1.15x attack power');
  assert.equal(principal.special.shortLabel, 'DIARY NOTE');
  assert.equal(principal.special.id, 'diary_note');
  assert.equal(principal.special.cooldown, 3.5);
  assert.equal(principal.superName, 'RUSTICATION ORDER');

  const cmpState = createMatchState('principal', 'sheru', true);
  cmpState.fighters[0].action = 'punch';
  cmpState.fighters[1].action = 'punch';
  assert.ok(
    getAttackTiming(cmpState.fighters[0]).damage > getAttackTiming(cmpState.fighters[1]).damage,
    'Principal Man punches must deal ~15% boosted boss damage',
  );

  assert.equal(PRINCIPAL_SUPER_AUDIO_URL, '/audio/supers/principal.mp3');
  assert.equal(getSuperAudioUrl('principal'), '/audio/supers/principal.mp3');
  assert.equal(PRINCIPAL_PAPER_COUNT, 14);
});

test('Principal Man 5th Signature Move (DIARY NOTE) fires a red-stamped warning slip with 3.5s cooldown & boosted damage', () => {
  const state = createMatchState('principal', 'sheru', true);
  const [principal, sheru] = state.fighters;
  principal.x = -2.2;
  sheru.x = 2.0;

  const p1In = createEmptyInput();
  p1In.special = true;
  stepMatch(state, [p1In, createEmptyInput()], 0.016);
  assert.equal(principal.action, 'special');
  assert.equal(principal.specialCooldown, 3.5);

  let spawnedDiary = false;
  let hitDiary = false;
  const startHp = sheru.hp;

  for (let i = 0; i < 90; i++) {
    const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.016);
    if (state.projectiles.some((p) => p.kind === 'diary')) {
      spawnedDiary = true;
    }
    if (events.some((ev) => ev.type === 'heavy_hit' && ev.moveCallout === 'DIARY NOTE!')) {
      hitDiary = true;
      break;
    }
  }

  assert.ok(spawnedDiary, 'DIARY NOTE must spawn a 3D diary warning slip projectile');
  assert.ok(hitDiary, 'DIARY NOTE projectile must hit mid-range opponent');
  const dmg = startHp - sheru.hp;
  const expectedBossDmg = computeSignatureDamage(
    sheru.maxHp,
    FIGHTER_CONFIGS.principal.attackPowerMultiplier,
  );
  assert.equal(dmg, expectedBossDmg);
});

test('Principal Man RUSTICATION ORDER! enforces 5.2s choreography, levitation, signature pop-up, and strict 33% damage cap across all 8 opponents', () => {
  const opponents: FighterId[] = [
    'sheru',
    'billa',
    'neta',
    'anda',
    'mausi',
    'father',
    'samyak',
    'principal',
  ];
  assert.equal(PRINCIPAL_SUPER_BANNER, 'RUSTICATION ORDER!');
  assert.equal(
    PRINCIPAL_SUPER_SIGNATURE_TEXT,
    'AISA RUSTICATE KARUNGA... WAAPIS LAUT KE NHI AA PAYEGA!',
  );

  for (const oppId of opponents) {
    const state = createMatchState('principal', oppId, true);
    const [principal, opp] = state.fighters;
    principal.shakti = 100;
    const expectedCap = Math.round(opp.maxHp * 0.33);

    const p1In = createEmptyInput();
    p1In.superMove = true;
    stepMatch(state, [p1In, createEmptyInput()], 0.016);

    assert.equal(principal.shakti, 0);
    assert.equal(principal.action, 'super');
    assert.ok(state.principalSuper?.active, 'Principal Super must be active');

    let maxLevitateY = 0;
    let sawLevitateSignal = false;
    let sawPapersSummon = false;
    let paperHitSignals = 0;
    let sawFinalImpact = false;
    let sawSuperEnd = false;
    let sawSignatureCallout = false;
    const allowedWordsDuringSuper: string[] = [];

    const startHp = opp.hp;
    let preMasterDamage = 0;
    let capturedPreMaster = false;

    for (let step = 0; step < 360; step++) {
      const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.016);
      if (principal.y > maxLevitateY) maxLevitateY = principal.y;

      for (const ev of events) {
        if (ev.word && shouldAllowFloatingCallout(state, ev)) {
          allowedWordsDuringSuper.push(ev.word);
          if (ev.isSuperSignature && ev.word === PRINCIPAL_SUPER_SIGNATURE_TEXT) {
            sawSignatureCallout = true;
          }
        }
      }

      for (const sig of state.principalSuperSignals) {
        if (sig.kind === 'levitate_start') sawLevitateSignal = true;
        if (sig.kind === 'papers_summon') sawPapersSummon = true;
        if (sig.kind === 'paper_hit') paperHitSignals++;
        if (sig.kind === 'master_notice_impact') sawFinalImpact = true;
        if (sig.kind === 'super_end') sawSuperEnd = true;
      }

      if (
        state.principalSuper?.active &&
        !capturedPreMaster &&
        state.principalSuper.elapsed >= 4.2 &&
        state.principalSuper.elapsed < 4.46
      ) {
        preMasterDamage = startHp - opp.hp;
        capturedPreMaster = true;
      }

      if (!state.principalSuper?.active && sawSuperEnd) break;
    }

    assert.equal(state.principalSuper?.active ?? false, false, 'Principal Super must finish cleanly at 5.2s');
    assert.ok(sawLevitateSignal, 'Phase 1 must emit levitate_start signal');
    assert.ok(sawPapersSummon, 'Phase 2 must emit papers_summon signal');
    assert.ok(paperHitSignals >= 6, `Phase 3 barrage must emit paper_hit impacts (got ${paperHitSignals})`);
    assert.ok(sawFinalImpact, 'Phase 3 finisher must emit master_notice_impact at 4.5s');
    assert.ok(sawSuperEnd, 'Super must emit super_end at 5.2s');
    assert.ok(
      maxLevitateY >= PRINCIPAL_LEVITATE_Y - 0.15,
      `Principal Man must levitate cleanly up to ~${PRINCIPAL_LEVITATE_Y} (got ${maxLevitateY.toFixed(2)})`,
    );
    assert.equal(principal.y, 0, 'Principal Man must return cleanly to floor y=0 at 5.2s');
    assert.equal(principal.action, 'idle', 'Principal Man must return cleanly to idle after Super');
    assert.ok(sawSignatureCallout, 'Principal Super must show iconic Rusticate signature callout');
    assert.deepEqual(
      allowedWordsDuringSuper,
      [PRINCIPAL_SUPER_SIGNATURE_TEXT],
      'Only the signature Super callout may appear during Principal Super (zero generic hit-spam)',
    );

    const totalDamage = startHp - opp.hp;
    assert.equal(
      totalDamage,
      expectedCap,
      `Strict 33% maxHP cap for ${oppId}: expected ${expectedCap}, got ${totalDamage}`,
    );
    assert.equal(principal.superDamageDealt, expectedCap);
    assert.ok(
      preMasterDamage > 0 && preMasterDamage < totalDamage,
      `Barrage (${preMasterDamage}) and Final Stamp (${totalDamage - preMasterDamage}) should split the 33% cap`,
    );
    assert.equal(opp.action, 'knockdown', 'Surviving opponent must be knocked flat by Final Stamp');
  }
});

test('Principal Man RUSTICATION ORDER! holds opponent >= 1 HP during barrage and triggers clean KO on Final Rustication slam', () => {
  const state = createMatchState('principal', 'billa', true);
  const [principal, billa] = state.fighters;
  principal.shakti = 100;
  billa.hp = 20;

  const p1In = createEmptyInput();
  p1In.superMove = true;
  stepMatch(state, [p1In, createEmptyInput()], 0.016);

  let earlyKoBeforeMaster = false;
  let sawKoOnMaster = false;

  for (let i = 0; i < 360; i++) {
    const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.016);
    if (state.principalSuper?.active && state.principalSuper.elapsed < 4.45 && billa.hp <= 0) {
      earlyKoBeforeMaster = true;
    }
    if (events.some((ev) => ev.type === 'ko')) {
      sawKoOnMaster = true;
    }
    if (state.phase === 'ko_freeze') break;
  }

  assert.equal(earlyKoBeforeMaster, false, 'Barrage must leave opponent >= 1 HP until Final Stamp');
  assert.ok(sawKoOnMaster, 'Final Stamp must cleanly trigger KO when HP drops to 0');
  assert.equal(billa.hp, 0);
});

test('Principal Super camera choreography frames low-angle levitation, vortex orbit, barrage/slam, and returns to Z=9.2', () => {
  const p1 = computeSuperCameraTarget(0.8, PRINCIPAL_SUPER_DURATION, -2.2, 1, 2.2, false, 'principal', 1.4);
  const p2 = computeSuperCameraTarget(2.2, PRINCIPAL_SUPER_DURATION, -2.2, 1, 2.2, false, 'principal', 2.4);
  const p3 = computeSuperCameraTarget(3.6, PRINCIPAL_SUPER_DURATION, -2.2, 1, 2.2, false, 'principal', 2.4);
  const pEnd = computeSuperCameraTarget(PRINCIPAL_SUPER_DURATION, PRINCIPAL_SUPER_DURATION, -2.2, 1, 2.2, false, 'principal', 0);

  assert.ok(p1.z < 5.5, 'Phase 1 should zoom into low-angle levitation frame');
  assert.ok(p2.lookY > 2.2, 'Phase 2 should elevate camera lookY to frame levitating Principal Man & notices');
  assert.ok(p3.z > 8.2, 'Phase 3 should widen to frame both Principal Man and opponent');
  assert.ok(Math.abs(pEnd.z - 9.2) < 0.01, 'Camera must return cleanly to standard 2.5D Z=9.2');
});
