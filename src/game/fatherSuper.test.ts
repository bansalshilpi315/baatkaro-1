import assert from 'node:assert/strict';
import test from 'node:test';
import { FATHER_SUPER_AUDIO_URL, getSuperAudioUrl } from './audio';
import { computeSuperCameraTarget } from './camera';
import { FIGHTER_CONFIGS, FIGHTER_LIST, STAGE_CONFIGS, STAGE_LIST } from './characters/configs';
import {
  computeSignatureDamage,
  createEmptyInput,
  createMatchState,
  getAttackTiming,
  shouldAllowFloatingCallout,
  stepMatch,
} from './combat';
import {
  FATHER_LEVITATE_Y,
  FATHER_SUPER_BANNER,
  FATHER_SUPER_DURATION,
  FATHER_SUPER_SIGNATURE_TEXT,
} from './fatherSuper';
import type { FighterId } from './types';

test('Principal Man (id: father) & School Assembly Ground are registered in the 10-playable roster and 6 stages', () => {
  assert.equal(FIGHTER_LIST.length, 10, 'Roster must have 10 unique playable fighters');
  assert.deepEqual(
    FIGHTER_LIST.map((f) => f.id),
    ['sheru', 'billa', 'utkarsh', 'anda', 'krish', 'adi', 'mausi', 'neta', 'samyak', 'father'],
  );
  assert.equal(STAGE_LIST.length, 6);

  const father = FIGHTER_CONFIGS.father;
  assert.equal(father.name, 'Principal Man');
  assert.ok(
    FIGHTER_LIST.every((f) => !/father roy|dolphus/i.test(f.name)),
    'No fighter display name may contain leftover Father Roy Dolphus text',
  );
  assert.equal(father.maxHp, 200, 'Principal Man must have boss-tier 200 HP (strongest)');
  assert.equal(father.attackPowerMultiplier, 1.15, 'Principal Man must have 1.15x attack power');
  assert.ok(
    father.maxHp > FIGHTER_CONFIGS.samyak.maxHp,
    'Principal Man must have highest maxHp in roster',
  );
  const cmpState = createMatchState('father', 'sheru', true);
  cmpState.fighters[0].action = 'punch';
  cmpState.fighters[1].action = 'punch';
  assert.ok(
    getAttackTiming(cmpState.fighters[0]).damage > getAttackTiming(cmpState.fighters[1]).damage,
    'Principal Man punches must deal ~15% boosted boss damage',
  );
  cmpState.fighters[0].action = 'kick';
  cmpState.fighters[1].action = 'kick';
  assert.ok(
    getAttackTiming(cmpState.fighters[0]).damage > getAttackTiming(cmpState.fighters[1]).damage,
    'Principal Man kicks must deal ~15% boosted boss damage',
  );
  assert.equal(father.special.shortLabel, 'DIARY NOTE');
  assert.equal(father.special.id, 'diary_note');
  assert.equal(father.special.cooldown, 3.5);
  assert.equal(father.superName, 'RUSTICATION ORDER');

  const assembly = STAGE_CONFIGS.assembly;
  assert.equal(assembly.name, 'School Assembly Ground');
  assert.equal(getSuperAudioUrl('father'), './audio/supers/father.mp3');
  assert.equal(FATHER_SUPER_AUDIO_URL, './audio/supers/father.mp3');
});

test('Father Roy Dolphus 5th Signature Move (DIARY NOTE) launches a diary projectile with 3.5s cooldown & 11-13% maxHP damage', () => {
  const state = createMatchState('father', 'sheru', true);
  const [father, sheru] = state.fighters;
  father.x = -2.2;
  sheru.x = 2.0;

  const p1In = createEmptyInput();
  p1In.special = true;
  const p2In = createEmptyInput();

  stepMatch(state, [p1In, p2In], 0.016);
  assert.equal(father.action, 'special');
  assert.equal(father.specialCooldown, 3.5);

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
  assert.ok(hitDiary, 'DIARY NOTE projectile must connect with opponent at mid-range');
  const dmg = startHp - sheru.hp;
  const expectedBossDmg = computeSignatureDamage(
    sheru.maxHp,
    FIGHTER_CONFIGS.father.attackPowerMultiplier,
  );
  assert.equal(
    dmg,
    expectedBossDmg,
    `DIARY NOTE damage (${dmg}) must match 1.15x boss-boosted signature damage (${expectedBossDmg})`,
  );
  assert.ok(
    dmg > computeSignatureDamage(sheru.maxHp, 1),
    'Father Roy Dolphus DIARY NOTE must deal more damage than baseline 1.0x signature move',
  );
});

test('Father Roy Dolphus RUSTICATION ORDER! enforces 5.2s choreography, levitation, signature pop-up, and strict 33% damage cap across all 6 opponents', () => {
  const opponents: FighterId[] = ['sheru', 'billa', 'neta', 'anda', 'mausi', 'father'];
  assert.equal(FATHER_SUPER_BANNER, 'RUSTICATION ORDER!');

  for (const oppId of opponents) {
    const state = createMatchState('father', oppId, true);
    const [father, opp] = state.fighters;
    father.shakti = 100;
    const expectedCap = Math.round(opp.maxHp * 0.33);

    const p1In = createEmptyInput();
    p1In.superMove = true;
    stepMatch(state, [p1In, createEmptyInput()], 0.016);

    assert.equal(father.shakti, 0);
    assert.equal(father.action, 'super');
    assert.ok(state.fatherSuper?.active, 'Father Super must be active');

    let maxLevitateY = 0;
    let sawLevitateSignal = false;
    let sawPapersSummon = false;
    let paperHitSignals = 0;
    let sawMasterImpact = false;
    let sawSuperEnd = false;
    let sawSignatureCallout = false;
    const allowedWordsDuringSuper: string[] = [];

    const startHp = opp.hp;
    let preMasterDamage = 0;
    let capturedPreMaster = false;

    for (let step = 0; step < 360; step++) {
      const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.016);
      if (father.y > maxLevitateY) maxLevitateY = father.y;

      for (const ev of events) {
        if (ev.word && shouldAllowFloatingCallout(state, ev)) {
          allowedWordsDuringSuper.push(ev.word);
          if (ev.isSuperSignature && ev.word === FATHER_SUPER_SIGNATURE_TEXT) {
            sawSignatureCallout = true;
          }
        }
      }

      for (const sig of state.fatherSuperSignals) {
        if (sig.kind === 'levitate_start') sawLevitateSignal = true;
        if (sig.kind === 'papers_summon') sawPapersSummon = true;
        if (sig.kind === 'paper_hit') paperHitSignals++;
        if (sig.kind === 'master_notice_impact') sawMasterImpact = true;
        if (sig.kind === 'super_end') sawSuperEnd = true;
      }

      if (state.fatherSuper?.active && !capturedPreMaster && state.fatherSuper.elapsed >= 4.2 && state.fatherSuper.elapsed < 4.46) {
        preMasterDamage = startHp - opp.hp;
        capturedPreMaster = true;
      }

      if (!state.fatherSuper?.active && sawSuperEnd) break;
    }

    assert.equal(state.fatherSuper?.active ?? false, false, 'Father Super must finish cleanly at 5.2s');
    assert.ok(sawLevitateSignal, 'Phase 1 must emit levitate_start signal');
    assert.ok(sawPapersSummon, 'Phase 2 must emit papers_summon signal');
    assert.ok(paperHitSignals >= 6, `Phase 3 barrage must emit paper_hit impacts (got ${paperHitSignals})`);
    assert.ok(sawMasterImpact, 'Phase 3 finisher must emit master_notice_impact at 4.5s');
    assert.ok(sawSuperEnd, 'Super must emit super_end at 5.2s');
    assert.ok(
      maxLevitateY >= FATHER_LEVITATE_Y - 0.15,
      `Father must levitate cleanly up to ~${FATHER_LEVITATE_Y} (got ${maxLevitateY.toFixed(2)})`,
    );
    assert.equal(father.y, 0, 'Father must descend cleanly back to floor y=0 at 5.2s');
    assert.equal(father.action, 'idle', 'Father must return cleanly to idle after Super');
    assert.ok(sawSignatureCallout, 'Father Super must show iconic Rusticate signature callout');
    assert.deepEqual(
      allowedWordsDuringSuper,
      [FATHER_SUPER_SIGNATURE_TEXT],
      'Only the signature Super callout may appear during Father Super (zero generic hit-spam)',
    );

    const totalDamage = startHp - opp.hp;
    assert.equal(
      totalDamage,
      expectedCap,
      `Strict 33% maxHP cap for ${oppId}: expected ${expectedCap}, got ${totalDamage}`,
    );
    assert.equal(father.superDamageDealt, expectedCap);
    assert.ok(
      preMasterDamage > 0 && preMasterDamage < totalDamage,
      `Barrage (${preMasterDamage}) and Master Notice (${totalDamage - preMasterDamage}) should split the 33% cap`,
    );
    assert.equal(opp.action, 'knockdown', 'Surviving opponent must be knocked flat by Master Notice');
  }
});

test('Father Roy Dolphus RUSTICATION ORDER! holds opponent >= 1 HP during barrage and triggers clean KO on Master Notice slam', () => {
  const state = createMatchState('father', 'billa', true);
  const [father, billa] = state.fighters;
  father.shakti = 100;
  billa.hp = 20; // Lower than 33% cap (33 HP)

  const p1In = createEmptyInput();
  p1In.superMove = true;
  stepMatch(state, [p1In, createEmptyInput()], 0.016);

  let earlyKoBeforeMaster = false;
  let sawKoOnMaster = false;

  for (let i = 0; i < 360; i++) {
    const events = stepMatch(state, [createEmptyInput(), createEmptyInput()], 0.016);
    if (state.fatherSuper?.active && state.fatherSuper.elapsed < 4.45 && billa.hp <= 0) {
      earlyKoBeforeMaster = true;
    }
    if (events.some((ev) => ev.type === 'ko')) {
      sawKoOnMaster = true;
    }
    if (state.phase === 'ko_freeze') break;
  }

  assert.equal(earlyKoBeforeMaster, false, 'Barrage must leave opponent >= 1 HP until Master Notice slam');
  assert.ok(sawKoOnMaster, 'Master Notice slam must cleanly trigger KO when HP drops to 0');
  assert.equal(billa.hp, 0);
});

test('Father Super camera choreography frames low-angle levitation, vortex orbit, barrage/slam, and returns to Z=9.2', () => {
  const p1 = computeSuperCameraTarget(0.8, FATHER_SUPER_DURATION, -2.2, 1, 2.2, false, 'father', 1.4);
  const p2 = computeSuperCameraTarget(2.2, FATHER_SUPER_DURATION, -2.2, 1, 2.2, false, 'father', 2.4);
  const p3 = computeSuperCameraTarget(3.6, FATHER_SUPER_DURATION, -2.2, 1, 2.2, false, 'father', 2.4);
  const pEnd = computeSuperCameraTarget(FATHER_SUPER_DURATION, FATHER_SUPER_DURATION, -2.2, 1, 2.2, false, 'father', 0);

  assert.ok(p1.z < 5.5, 'Phase 1 should zoom into low-angle levitation frame');
  assert.ok(p2.lookY > 2.2, 'Phase 2 should elevate camera lookY to frame levitating Father & vortex');
  assert.ok(p3.z > 8.2, 'Phase 3 should widen to frame both levitating Father and opponent');
  assert.ok(Math.abs(pEnd.z - 9.2) < 0.01, 'Camera must return cleanly to standard 2.5D Z=9.2');
});
